require('dotenv').config();

const { getJob } = require("./queueService");
const { connectRedis } = require("./redisClient");
const pool = require("../src/db"); // ✅ DB connection
const { submitToJudge0, getResult } = require("./judge0Service");
const { runBatch, supportsBatch } = require("./batchRunner");

let isShuttingDown = false;
let currentJobId = null;

// Compare line by line, ignoring trailing spaces and trailing blank lines.
const normalizeOutput = text =>
  (text || "").replace(/\r\n?/g, "\n").split("\n").map(line => line.trimEnd()).join("\n").trim();

async function saveVerdict(submissionId, verdict, passed, totalTests, token) {
  await pool.query(
    `UPDATE submissions
     SET status=$1, verdict=$2, passed_tests=$3, total_tests=$4, judge0_token=$5
     WHERE id=$6`,
    ["completed", verdict, passed, totalTests, token || null, submissionId]
  );
  console.log(`✅ Job ${submissionId} → ${verdict} (${passed}/${totalTests})`);
}

// Judges all tests in one Judge0 run (see batchRunner.js). Tests are checked in order
// and judging stops at the first failure, like the per-test path.
async function judgeBatch(job, problem, tests) {
  let attempt = 0;
  for (;;) {
    try {
      const run = await runBatch({
        languageId: job.language_id,
        code: job.code,
        inputs: tests.map(tc => tc.input),
        timeLimit: problem.time_limit,
      });
      return { ...scoreBatch(run, tests), judge0: run.judge0 };
    } catch (err) {
      attempt++;
      console.warn(`⚠️ Judge0 batch attempt ${attempt}/3 failed: ${err.message}`);
      if (attempt >= 3) throw err;
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

function scoreBatch(run, tests) {
  if (run.compileError !== undefined) return { verdict: "compilation_error", passed: 0 };
  const status = run.judge0.status.id;
  let passed = 0;
  for (let i = 0; i < tests.length; i++) {
    const test = run.results[i];
    // The whole batch ran out of time before reaching this test.
    if (!test) return { verdict: status === 3 ? "runtime_error" : "time_limit_exceeded", passed };
    const timedOut = test.code === 124 || (test.code === 137 && test.ms >= run.timeoutSeconds * 1000);
    if (timedOut) return { verdict: "time_limit_exceeded", passed };
    if (test.code !== 0) return { verdict: "runtime_error", passed };
    if (normalizeOutput(test.stdout) !== normalizeOutput(tests[i].expected_output)) {
      return { verdict: "wrong_answer", passed };
    }
    passed++;
  }
  return { verdict: "accepted", passed };
}

async function processJob(job) {
  currentJobId = job.id; // ✅ Track active job at start
  const submissionId = job.id;
  console.log(`🚀 Processing job: ${submissionId}`);

  let result = null;

  try {
    await pool.query(
      "UPDATE submissions SET status=$1 WHERE id=$2",
      ["processing", submissionId]
    );

    // 1. Fetch problem & test cases
    const problemRes = await pool.query(
      "SELECT * FROM problems WHERE id = $1",
      [job.problem_id]
    );

    if (!problemRes.rows[0]) {
      throw new Error("Problem not found");
    }

    const testCases = await pool.query(
      "SELECT input, expected_output FROM test_cases WHERE problem_id = $1 ORDER BY id",
      [job.problem_id]
    );

    const totalTests = testCases.rows.length;
    let passed = 0;
    let verdict = "accepted";

    // 2a. Usual path: compile once and run every test in a single Judge0 run.
    if (totalTests > 0 && supportsBatch(job.language_id)) {
      const outcome = await judgeBatch(job, problemRes.rows[0], testCases.rows);
      ({ passed, verdict } = outcome);
      result = outcome.judge0;
      await saveVerdict(submissionId, verdict, passed, totalTests, result?.token);
      return;
    }

    // 2b. Fallback: one Judge0 submission per test, with retries.
    for (const tc of testCases.rows) {
      let attempts = 0;
      const maxAttempts = 3;
      let success = false;

      while (attempts < maxAttempts && !success) {
        try {
          attempts++;

          const token = await submitToJudge0(
            job.code,
            job.language_id,
            tc.input,
            job.compiler_options
          );

          result = await getResult(token);
          const statusId = result.status.id;

          // ✅ NEW DEBUGGING + COMPARISON LOGIC
          // Compare line by line, ignoring trailing spaces and trailing blank lines.
          const normalizeOutput = text => (text || "").replace(/\r\n?/g, "\n").split("\n").map(line => line.trimEnd()).join("\n").trim();
          const actualOutput = normalizeOutput(result.stdout);
          const expectedOutput = normalizeOutput(tc.expected_output);

          console.log(`\n📊 Test Case Comparison:`);
          console.log(`   Expected: "${expectedOutput}"`);
          console.log(`   Actual:   "${actualOutput}"`);
          console.log(`   Match: ${actualOutput === expectedOutput}`);
          console.log(`   Expected length: ${expectedOutput.length}`);
          console.log(`   Actual length: ${actualOutput.length}\n`);

          if (statusId === 3) { // Accepted by Judge0
            if (actualOutput === expectedOutput) {
              passed++;
              success = true;
              console.log(`✅ Test case PASSED`);
            } else {
              verdict = "wrong_answer";
              success = true;
              console.log(`❌ Test case FAILED - Output mismatch`);
              break;
            }

          } else if (statusId === 4) {
            verdict = "wrong_answer";
            success = true;
            break;

          } else if (statusId === 5) {
            verdict = "time_limit_exceeded";
            success = true;
            break;

          } else if (statusId >= 6) {
            verdict = "runtime_error";
            success = true;
            break;
          }

        } catch (err) {
          console.warn(
            `⚠️ Judge0 attempt ${attempts}/${maxAttempts} failed: ${err.message}`
          );

          if (attempts < maxAttempts) {
            await new Promise(r =>
              setTimeout(r, 2000 * attempts)
            );
          }
        }
      } // end while

      // ✅ If retries exhausted for this test case
      if (!success) {
        verdict = "runtime_error";
        break;
      }
    }

    // ✅ Handle no test cases
    if (totalTests === 0) {
      verdict = "accepted";
      passed = 0;
    }

    // 3. Update DB with verdict
    await saveVerdict(submissionId, verdict, passed, totalTests, result?.token);

  } catch (err) {
    // ✅ Move to DLQ after complete processing failure
    console.error(`❌ Worker ERROR: ${err.message}`);

    await pool.query(
      "UPDATE submissions SET status=$1, verdict=$2 WHERE id=$3",
      ["failed", "runtime_error", submissionId]
    );

    await pool.query(
      `INSERT INTO failed_jobs 
       (original_submission_id, error_message, retry_count, job_data)
       VALUES ($1, $2, $3, $4)`,
      [
        submissionId,
        err.message,
        3,
        JSON.stringify(job)
      ]
    );

    console.log(
      `💀 Job ${submissionId} moved to Dead Letter Queue`
    );

  } finally {
    // ✅ Clear current job after full completion
    currentJobId = null;

    if (isShuttingDown) {
      console.log("🛑 Shutdown complete - exiting");
      process.exit(0);
    }
  }
}

async function startWorker() {
  try {
    await connectRedis();

    console.log("👷 Worker started. PID:", process.pid);

    while (true) {
      try {
        const job = await getJob();

        if (!job) {
          console.log("⏳ Waiting for jobs...");
          await new Promise(res => setTimeout(res, 2000));
          continue;
        }

        console.log("📥 Job received:", job.id);

        await processJob(job);

      } catch (err) {
        console.error(
          "❌ WORKER LOOP ERROR:",
          err.message
        );
      }
    }

  } catch (err) {
    console.error(
      "❌ FAILED TO START WORKER:",
      err.message
    );
  }
}

startWorker();

// ✅ Graceful shutdown
process.on("SIGTERM", async () => {
  console.log(
    "🛑 SIGTERM received - shutting down gracefully..."
  );

  isShuttingDown = true;

  if (currentJobId) {
    console.log(
      `⏳ Waiting for job ${currentJobId} to complete...`
    );

    // Wait max 30 sec
    setTimeout(() => {
      console.log("⚠️ Force shutdown after timeout");
      process.exit(1);
    }, 30000);

  } else {
    console.log(
      "✅ No active job - shutting down immediately"
    );
    process.exit(0);
  }
});

process.on("SIGINT", async () => {
  console.log(
    "🛑 SIGINT received - shutting down gracefully..."
  );
  isShuttingDown = true;
  process.exit(0);
});