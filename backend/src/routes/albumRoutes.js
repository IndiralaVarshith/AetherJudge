const express = require("express");
const router = express.Router();
const pool = require("../db");
const { ALBUMS, SLUGS } = require("../albums");

const ALBUM_ORDER = "array_position($1::text[], album)";

// GET /api/albums → every album in learning order, with problem counts per difficulty
router.get("/albums", async (req, res) => {
  try {
    const counts = await pool.query(
      `SELECT a AS slug,
              count(*)::int AS total,
              count(*) FILTER (WHERE difficulty = 'easy')::int AS easy,
              count(*) FILTER (WHERE difficulty = 'medium')::int AS medium,
              count(*) FILTER (WHERE difficulty = 'hard')::int AS hard
         FROM problems, unnest(albums) AS a
        WHERE status = 'published'
        GROUP BY a`
    );
    const bySlug = Object.fromEntries(counts.rows.map(row => [row.slug, row]));
    res.json(
      ALBUMS.map((album, index) => ({
        slug: album.slug,
        name: album.name,
        description: album.description,
        position: index + 1,
        total: bySlug[album.slug]?.total || 0,
        easy: bySlug[album.slug]?.easy || 0,
        medium: bySlug[album.slug]?.medium || 0,
        hard: bySlug[album.slug]?.hard || 0,
      }))
    );
  } catch (err) {
    console.error("List albums error:", err.message);
    res.status(500).json({ error: "Failed to fetch albums" });
  }
});

// GET /api/guide → the "Guide me" path: one stage per album, in learning order, each with a
// short hand-picked run of problems (easy first, then medium, then a stretch problem).
// Picks prefer problems with real titles, then shorter (usually simpler) statements.
router.get("/guide", async (req, res) => {
  try {
    const picks = await pool.query(
      `SELECT id, title, difficulty, album, tags, rank FROM (
         SELECT id, title, difficulty, album, tags,
                row_number() OVER (
                  PARTITION BY album, difficulty
                  ORDER BY CASE WHEN title ~ '^(Codeforces|CodeChef|AtCoder) ' THEN 1 ELSE 0 END,
                           CASE source WHEN 'manual' THEN 0 WHEN 'exercism' THEN 1 ELSE 2 END,
                           length(description), test_count DESC, id
                ) AS rank
           FROM problems
          WHERE status = 'published' AND album IS NOT NULL
       ) ranked
       WHERE rank <= 12
       ORDER BY ${ALBUM_ORDER}, CASE difficulty WHEN 'easy' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, rank`,
      [SLUGS]
    );

    let step = 0;
    const stages = ALBUMS.map((album, index) => {
      const problems = [];
      for (const level of ["easy", "medium", "hard"]) {
        const wanted = album.picks[level] || 0;
        const chosen = picks.rows.filter(row => row.album === album.slug && row.difficulty === level).slice(0, wanted);
        problems.push(...chosen);
      }
      return {
        stage: index + 1,
        slug: album.slug,
        name: album.name,
        goal: album.goal,
        learn: album.learn,
        problems: problems.map(problem => ({ step: ++step, id: problem.id, title: problem.title, difficulty: problem.difficulty })),
      };
    }).filter(stage => stage.problems.length);

    res.json({ total: step, stages });
  } catch (err) {
    console.error("Guide error:", err.message);
    res.status(500).json({ error: "Failed to build the guide" });
  }
});

module.exports = router;
