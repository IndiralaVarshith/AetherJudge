const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /api/problems → List all problems
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, title, difficulty, time_limit, memory_limit FROM problems ORDER BY id"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch problems" });
  }
});

// GET /api/problems/:id → Problem details + test cases
router.get("/:id", async (req, res) => {
  try {
    const problem = await pool.query("SELECT * FROM problems WHERE id = $1", [req.params.id]);
    if (!problem.rows[0]) return res.status(404).json({ error: "Problem not found" });

    const testCases = await pool.query(
      "SELECT id, input, expected_output, is_sample FROM test_cases WHERE problem_id = $1",
      [req.params.id]
    );

    res.json({ ...problem.rows[0], test_cases: testCases.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch problem details" });
  }
});

// POST /api/problems → Admin-only creation
router.post("/", async (req, res) => {
  try {
    if (req.headers["x-admin-secret"] !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { title, description, difficulty, time_limit, memory_limit, test_cases } = req.body;
    if (!title || !description || !Array.isArray(test_cases)) {
      return res.status(400).json({ error: "Invalid problem data" });
    }

    const problemRes = await pool.query(
      `INSERT INTO problems (title, description, difficulty, time_limit, memory_limit)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [title, description, difficulty || "medium", time_limit || 5, memory_limit || 128000]
    );
    const problemId = problemRes.rows[0].id;

    await Promise.all(
      test_cases.map(tc =>
        pool.query(
          `INSERT INTO test_cases (problem_id, input, expected_output, is_sample)
           VALUES ($1, $2, $3, $4)`,
          [problemId, tc.input, tc.expected_output, tc.is_sample || false]
        )
      )
    );

    res.status(201).json({ message: "Problem created", id: problemId });
  } catch (err) {
    console.error("Create problem error:", err);
    res.status(500).json({ error: "Failed to create problem" });
  }
});

module.exports = router;