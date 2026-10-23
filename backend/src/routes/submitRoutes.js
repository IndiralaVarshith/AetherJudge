const express = require("express");
const router = express.Router();
const { addJob } = require("../../redisQueue/queueService");
const pool = require("../db");

router.post("/submit", async (req, res) => {
  try {
    const { code, language, problemId = 1, userId = 1 } = req.body;

    const languageMap = {
      python: 71,
      cpp: 54,
      java: 62
    };

    if (!code || code.trim() === "") {
      return res.status(400).json({ error: "Code is required" });
    }

    if (!language || !languageMap[language]) {
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
      language_id: languageMap[language], // ✅ Fixed: "lan guage_id" → "language_id"
      problem_id: problemId               // ✅ Added: worker needs this
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
    const userId = req.query.userId || 1; // Replace with auth middleware
    const result = await pool.query(
      "SELECT id, problem_id, language, status, verdict, passed_tests, total_tests, created_at FROM submissions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20",
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});
module.exports = router;