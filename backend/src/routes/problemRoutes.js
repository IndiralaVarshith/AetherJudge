const express = require("express");
const router = express.Router();
const pool = require("../db");
const { addProblem } = require("../../importers/store");
const { SLUGS, ORDER_IN_ALBUM } = require("../albums");

// Columns that are safe to show to users (fingerprints and review data stay server-side).
const PUBLIC_COLUMNS = "id, slug, title, difficulty, time_limit, memory_limit, tags, album, albums, source, source_url, license";

// GET /api/problems → List published problems in learning order:
// album by album (see src/albums.js), easy before hard inside each album.
// Optional filters: ?album=strings&difficulty=easy&tag=sorting&q=search+text&limit=50&offset=0
router.get("/", async (req, res) => {
  try {
    const where = ["status = 'published'"];
    const params = [SLUGS];
    if (req.query.album) { params.push(String(req.query.album).toLowerCase()); where.push(`$${params.length} = ANY(albums)`); }
    if (req.query.difficulty) { params.push(String(req.query.difficulty).toLowerCase()); where.push(`difficulty = $${params.length}`); }
    if (req.query.tag) { params.push(String(req.query.tag).toLowerCase()); where.push(`$${params.length} = ANY(tags)`); }
    if (req.query.q) { params.push(`%${String(req.query.q)}%`); where.push(`title ILIKE $${params.length}`); }

    let paging = "";
    const limit = parseInt(req.query.limit, 10);
    if (Number.isInteger(limit) && limit > 0) {
      params.push(Math.min(limit, 500));
      paging += ` LIMIT $${params.length}`;
      const offset = parseInt(req.query.offset, 10);
      if (Number.isInteger(offset) && offset > 0) { params.push(offset); paging += ` OFFSET $${params.length}`; }
    }

    // When filtering to one album, its own problems come before ones that only also belong to it.
    const albumFirst = req.query.album ? "CASE WHEN album = $2 THEN 0 ELSE 1 END, " : "";
    const result = await pool.query(
      `SELECT ${PUBLIC_COLUMNS} FROM problems WHERE ${where.join(" AND ")}
        ORDER BY ${albumFirst}COALESCE(array_position($1::text[], album), 999), ${ORDER_IN_ALBUM}${paging}`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error("List problems error:", err.message);
    res.status(500).json({ error: "Failed to fetch problems" });
  }
});

// GET /api/problems/:id → Problem details + SAMPLE test cases only.
// Hidden test cases never leave the server: the worker reads them straight from the database.
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(404).json({ error: "Problem not found" });

    const problem = await pool.query(
      `SELECT ${PUBLIC_COLUMNS}, description, test_count, created_at FROM problems WHERE id = $1 AND status = 'published'`,
      [id]
    );
    if (!problem.rows[0]) return res.status(404).json({ error: "Problem not found" });

    const testCases = await pool.query(
      "SELECT id, input, expected_output, is_sample FROM test_cases WHERE problem_id = $1 AND is_sample = true ORDER BY id",
      [id]
    );

    res.json({ ...problem.rows[0], test_cases: testCases.rows });
  } catch (err) {
    console.error("Problem details error:", err.message);
    res.status(500).json({ error: "Failed to fetch problem details" });
  }
});

// POST /api/problems → Admin-only creation, with the same duplicate checks as the importers
router.post("/", async (req, res) => {
  try {
    // Refuse outright when no admin secret is configured (an unset secret must not match a missing header).
    const secret = process.env.ADMIN_SECRET;
    if (!secret || req.headers["x-admin-secret"] !== secret) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { title, description, difficulty, time_limit, memory_limit, tags, test_cases } = req.body;
    if (!title || !description || !Array.isArray(test_cases) || !test_cases.length) {
      return res.status(400).json({ error: "Invalid problem data" });
    }

    const result = await addProblem({
      title,
      description,
      difficulty: difficulty || "medium",
      timeLimit: time_limit || 5,
      memoryLimit: memory_limit || 128000,
      tags: Array.isArray(tags) ? tags.map(tag => String(tag).toLowerCase()) : [],
      source: "manual",
      tests: test_cases.map(tc => ({ input: tc.input, expected_output: tc.expected_output, is_sample: Boolean(tc.is_sample) })),
    });

    if (result.action === "inserted") return res.status(201).json({ message: "Problem created", id: result.id });
    if (result.action === "review") {
      return res.status(202).json({ message: "Problem saved but held for review: it looks like an existing problem", id: result.id, duplicate_of: result.duplicateOf, reason: result.reason });
    }
    if (result.action === "skipped" || result.action === "upgraded") {
      return res.status(409).json({ error: "This problem already exists", duplicate_of: result.duplicateOf ?? result.id, reason: result.reason });
    }
    res.status(400).json({ error: "Invalid problem data", reason: result.reason });
  } catch (err) {
    console.error("Create problem error:", err);
    res.status(500).json({ error: "Failed to create problem" });
  }
});

module.exports = router;
