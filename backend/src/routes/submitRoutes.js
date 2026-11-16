const express = require("express");
const axios = require("axios");
const router = express.Router();
const { addJob } = require("../../redisQueue/queueService");
const { JUDGE0_URL } = require("../../redisQueue/config");
const pool = require("../db");
const { LANGUAGES, judge0Fields } = require("../languages");

// GET /api/languages → the languages and versions the judge runs
router.get("/languages", (req, res) => {
  res.json(Object.entries(LANGUAGES).map(([key, entry]) => ({ key, label: entry.label })));
});

// Run a single custom input through the same private Judge0 service used by the worker.
router.post("/run", async (req, res) => {
  const { code, language, stdin = "" } = req.body;
  const fields = judge0Fields(language);
  if (!code || !code.trim()) return res.status(400).json({ error: "Code is required" });
  if (!fields) return res.status(400).json({ error: "Invalid language" });

  try {
    const result = await axios.post(
      `${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`,
      { source_code: code, ...fields, stdin, cpu_time_limit: 5 },
      { timeout: 30000 }
    );
    res.json(result.data);
  } catch (err) {
    const status = err.response?.status || 502;
    res.status(status).json({ error: err.response?.data?.error || "Code execution service is unavailable" });
  }
});

router.post("/submit", async (req, res) => {
  try {
    const { code, language, problemId = 1, userId = null } = req.body;

    const fields = judge0Fields(language);

    if (!code || code.trim() === "") {
      return res.status(400).json({ error: "Code is required" });
    }

    if (!fields) {
      return res.status(400).json({ error: "Invalid language" });
    }

    // Store in DB
    const dbResult = await pool.query(
      `INSERT INTO submissions (user_id, problem_id, code, language, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [userId, problemId, code, language, "pending"]
    );

    const submissionId = dbResult.rows[0].id;

    // ✅ FIX: Send problem_id + fix typo
    const job = {
      id: submissionId,
      code,
      language_id: fields.language_id,
      compiler_options: fields.compiler_options || null,
      problem_id: problemId
    };

    await addJob(job);

    console.log("✅ Job stored + queued:", submissionId);

    res.json({
      message: "Job queued",
      submissionId
    });

  } catch (err) {
    console.error("❌ SUBMIT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/submissions/history → List user's submissions
router.get("/submissions/history", async (req, res) => {
  try {
    const userId = req.query.userId;
    const result = userId === "null"
      ? await pool.query(
        "SELECT id, problem_id, language, status, verdict, passed_tests, total_tests, created_at FROM submissions WHERE user_id IS NULL ORDER BY created_at DESC LIMIT 20"
      )
      : await pool.query(
        "SELECT id, problem_id, language, status, verdict, passed_tests, total_tests, created_at FROM submissions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20",
        [userId || 1]
      );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});
module.exports = router;
