// Judges ALL tests of a submission in ONE Judge0 run.
//
// Sending every test as its own Judge0 submission means C, C++ and Java are compiled
// again for each test, and every test pays for a fresh sandbox. On a small server that
// made a 3-test C++ submission take ~24 s. Instead we send a generated Bash script
// (Judge0 language 46) that compiles once and then runs each test with its own time
// limit. Test inputs go in through stdin, one base64 line per test, and each test's
// exit code and output come back framed in stdout.

const axios = require("axios");
const { JUDGE0_URL } = require("./config");

const BASH_LANGUAGE_ID = 46;
const MARK = "@@AJ";

// Commands inside the Judge0 1.13 image, keyed by Judge0 language id (see src/languages.js).
const RUNNERS = {
  71: { file: "script.py", run: "/usr/local/python-3.8.1/bin/python3 script.py" },
  50: {
    file: "main.c",
    compile: "/usr/local/gcc-9.2.0/bin/gcc -std=c17 -O2 main.c -o a.out -lm",
    run: "./a.out",
  },
  54: {
    file: "main.cpp",
    compile: "/usr/local/gcc-9.2.0/bin/g++ -std=c++17 -O2 main.cpp -o a.out",
    run: "env LD_LIBRARY_PATH=/usr/local/gcc-9.2.0/lib64 ./a.out",
  },
  62: {
    file: "Main.java",
    compile: "/usr/local/openjdk13/bin/javac Main.java",
    run: "/usr/local/openjdk13/bin/java Main",
  },
};

const supportsBatch = languageId => Boolean(RUNNERS[languageId]);

const b64 = text => Buffer.from(text ?? "", "utf8").toString("base64");
const unb64 = text => Buffer.from(text || "", "base64").toString("utf8");

// Wall-clock seconds each test may run. Problems store a CPU-time limit; a throttled
// shared VM needs headroom, so allow twice that (at least 2 s).
const testTimeout = timeLimit => Math.max(2, Number(timeLimit) || 5) * 2;

function buildScript(runner, code, timeoutSeconds) {
  const compile = runner.compile
    ? `if ! ${runner.compile} > /dev/null 2> compile.txt; then
  echo "${MARK} COMPILE_ERROR"
  head -c 20000 compile.txt | base64 -w0; echo
  exit 0
fi`
    : "";
  return `cd "$(dirname "$0")"
echo '${b64(code)}' | base64 -d > ${runner.file}
${compile}
i=0
while IFS= read -r line || [ -n "$line" ]; do
  printf '%s' "$line" | base64 -d > in.txt
  start=$(date +%s%N)
  timeout -k 1 ${timeoutSeconds} ${runner.run} < in.txt > out.txt 2> err.txt
  code=$?
  ms=$(( ($(date +%s%N) - start) / 1000000 ))
  echo "${MARK} $i $code $ms"
  head -c 1048576 out.txt | base64 -w0; echo
  [ "$code" -ne 0 ] && break
  i=$((i + 1))
done
`;
}

// Parses the framed stdout into { compileError } or { results: [{ code, ms, stdout }] }.
function parseOutput(stdout) {
  const lines = (stdout || "").split("\n");
  if (lines[0] === `${MARK} COMPILE_ERROR`) return { compileError: unb64(lines[1]) };
  const results = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^@@AJ (\d+) (\d+) (\d+)$/);
    if (!match) continue;
    results.push({ code: Number(match[2]), ms: Number(match[3]), stdout: unb64(lines[i + 1]) });
    i++;
  }
  return { results };
}

async function waitForResult(token) {
  for (;;) {
    const { data } = await axios.get(`${JUDGE0_URL}/submissions/${token}?base64_encoded=false`);
    if (data.status.id > 2) return data;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Runs every test input once. Returns { judge0, compileError?, results, timeoutSeconds }.
async function runBatch({ languageId, code, inputs, timeLimit }) {
  const runner = RUNNERS[languageId];
  const timeoutSeconds = testTimeout(timeLimit);
  const { data } = await axios.post(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=false`, {
    language_id: BASH_LANGUAGE_ID,
    source_code: buildScript(runner, code, timeoutSeconds),
    stdin: inputs.map(input => b64(input)).join("\n") + "\n",
    cpu_time_limit: 15, // per process; each test is bounded by `timeout` above
    wall_time_limit: 90, // whole batch; needs MAX_WALL_TIME_LIMIT >= 90 in judge0.conf
    max_processes_and_or_threads: 120, // the JVM and javac start many threads
    max_file_size: 4096, // KB per file (test inputs and outputs)
  });
  const judge0 = await waitForResult(data.token);
  return { judge0, timeoutSeconds, ...parseOutput(judge0.stdout) };
}

module.exports = { runBatch, supportsBatch, buildScript, parseOutput, testTimeout };
