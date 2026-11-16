const express = require("express");
const axios = require("axios");
const router = express.Router();
const { addJob } = require("../../redisQueue/queueService");
const { JUDGE0_URL } = require("../../redisQueue/config");
const pool = require("../db");
const { LANGUAGES, judge0Fields } = require("../languages");
const { optionalAuth } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");

// Every request here knows who is asking (req.user = { id } or null for guests).
router.use(optionalAuth);

// Judge0 is the scarce resource on a free server: cap how fast one person can use it.
const judgeLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20,
  key: req => (req.user ? `user:${req.user.id}` : `ip:${req.ip}`),
  message: "You're running code very fast. Wait a minute and try again.",
});
const MAX_CODE_BYTES = 64 * 1024;

// GET /api/languages → the languages and versions the judge runs
router.get("/languages", (req, res) => {
  res.json(Object.entries(LANGUAGES).map(([key, entry]) => ({ key, label: entry.label })));
});

// Run a single custom input through the same private Judge0 service used by the worker.
router.post("/run", judgeLimiter, async (req, res) => {
  const { code, language, stdin = "" } = req.body;
  const fields = judge0Fields(language);
  if (!code || !code.trim()) return res.status(400).json({ error: "Code is required" });
  if (Buffer.byteLength(code) > MAX_CODE_BYTES) return res.status(413).json({ error: "Code is too long (64 KB max)" });
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

router.post("/submit", judgeLimiter, async (req, res) => {
  try {
    const { code, language } = req.body;
    const problemId = parseInt(req.body.problemId, 10);
    // The owner comes from the session cookie, never from the request body.
    const userId = req.user ? req.user.id : null;
    if (!Number.isInteger(problemId)) return res.status(400).json({ error: "Invalid problem" });
    if (code && Buffer.byteLength(code) > MAX_CODE_BYTES) return res.status(413).json({ error: "Code is too long (64 KB max)" });

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
    res.status(500).json({ error: "Submission failed. Please try again." });
  }
});

// GET /api/submissions/history → the signed-in user's latest submissions.
// Guests get an empty list: their submissions are judged but not kept as history.
router.get("/submissions/history", async (req, res) => {
  try {
    if (!req.user) return res.json([]);
    const result = await pool.query(
      "SELECT id, problem_id, language, status, verdict, passed_tests, total_tests, created_at FROM submissions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});
module.exports = router;
