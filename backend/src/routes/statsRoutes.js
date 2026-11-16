const express = require("express");
const router = express.Router();
const pool = require("../db");
const { ALBUMS } = require("../albums");
const { optionalAuth } = require("../middleware/auth");

const XP = { easy: 10, medium: 25, hard: 50 };
const XP_SQL = "CASE p.difficulty WHEN 'easy' THEN 10 WHEN 'medium' THEN 25 ELSE 50 END";

// Stats always belong to the session's user. Guests match nothing, so they see zeros
// (guest progress is not stored; signing up is what saves it).
function userFilter(req) {
  return req.user ? { sql: "s.user_id = $1", params: [req.user.id] } : { sql: "FALSE AND $1::int IS NULL", params: [null] };
}

const dayKey = date => date.toISOString().slice(0, 10);

// Consecutive days (ending today or yesterday) with at least one accepted submission.
function currentStreak(acceptedDays) {
  const days = new Set(acceptedDays);
  const cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function longestStreak(acceptedDays) {
  const sorted = [...new Set(acceptedDays)].sort();
  let best = 0;
  let run = 0;
  let previous = null;
  for (const day of sorted) {
    const date = new Date(`${day}T00:00:00Z`);
    run = previous && date - previous === 86400000 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }
  return best;
}

// GET /api/stats?userId=7 → everything the profile, navbar and progress rings need
router.get("/stats", optionalAuth, async (req, res) => {
  try {
    const filter = userFilter(req);
    const [solvedRows, totals, albumTotals, activity, recent, counts] = await Promise.all([
      pool.query(
        `SELECT p.id, p.difficulty, p.albums
           FROM problems p
          WHERE p.status = 'published'
            AND p.id IN (SELECT s.problem_id FROM submissions s WHERE s.verdict = 'accepted' AND ${filter.sql})`,
        filter.params
      ),
      pool.query("SELECT difficulty, count(*)::int AS n FROM problems WHERE status = 'published' GROUP BY 1"),
      pool.query("SELECT a AS slug, count(*)::int AS n FROM problems, unnest(albums) AS a WHERE status = 'published' GROUP BY 1"),
      pool.query(
        `SELECT to_char(s.created_at, 'YYYY-MM-DD') AS day,
                count(*)::int AS submissions,
                count(*) FILTER (WHERE s.verdict = 'accepted')::int AS accepted
           FROM submissions s
          WHERE ${filter.sql} AND s.created_at > now() - interval '371 days'
          GROUP BY 1 ORDER BY 1`,
        filter.params
      ),
      pool.query(
        `SELECT s.id, s.problem_id, p.title, p.difficulty, s.language, s.status, s.verdict, s.passed_tests, s.total_tests, s.created_at
           FROM submissions s JOIN problems p ON p.id = s.problem_id
          WHERE ${filter.sql}
          ORDER BY s.created_at DESC LIMIT 12`,
        filter.params
      ),
      pool.query(
        `SELECT count(*)::int AS submissions, count(*) FILTER (WHERE s.verdict = 'accepted')::int AS accepted
           FROM submissions s WHERE ${filter.sql}`,
        filter.params
      ),
    ]);

    const solved = { easy: 0, medium: 0, hard: 0, total: 0 };
    const solvedPerAlbum = {};
    let xp = 0;
    for (const row of solvedRows.rows) {
      const level = XP[row.difficulty] ? row.difficulty : "hard";
      solved[level]++;
      solved.total++;
      xp += XP[level];
      for (const slug of row.albums || []) solvedPerAlbum[slug] = (solvedPerAlbum[slug] || 0) + 1;
    }

    const total = { easy: 0, medium: 0, hard: 0, total: 0 };
    for (const row of totals.rows) {
      if (row.difficulty in total) total[row.difficulty] = row.n;
      total.total += row.n;
    }
    const albumTotal = Object.fromEntries(albumTotals.rows.map(row => [row.slug, row.n]));
    const acceptedDays = activity.rows.filter(row => row.accepted > 0).map(row => row.day);

    res.json({
      xp,
      solved,
      total,
      solvedIds: solvedRows.rows.map(row => row.id),
      streak: currentStreak(acceptedDays),
      longestStreak: longestStreak(acceptedDays),
      submissions: counts.rows[0].submissions,
      accepted: counts.rows[0].accepted,
      albums: ALBUMS.map((album, index) => ({
        slug: album.slug,
        name: album.name,
        position: index + 1,
        solved: solvedPerAlbum[album.slug] || 0,
        total: albumTotal[album.slug] || 0,
      })),
      activity: activity.rows,
      recent: recent.rows,
    });
  } catch (err) {
    console.error("Stats error:", err.message);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// GET /api/leaderboard → signed-in users ranked by XP (easy 10, medium 25, hard 50)
router.get("/leaderboard", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username,
              count(*)::int AS solved,
              sum(${XP_SQL})::int AS xp,
              count(*) FILTER (WHERE p.difficulty = 'easy')::int AS easy,
              count(*) FILTER (WHERE p.difficulty = 'medium')::int AS medium,
              count(*) FILTER (WHERE p.difficulty = 'hard')::int AS hard
         FROM (SELECT DISTINCT user_id, problem_id FROM submissions WHERE verdict = 'accepted' AND user_id IS NOT NULL) s
         JOIN users u ON u.id = s.user_id
         JOIN problems p ON p.id = s.problem_id AND p.status = 'published'
        GROUP BY u.id, u.username
        ORDER BY xp DESC, solved DESC, u.id
        LIMIT 50`
    );
    res.json(result.rows.map((row, index) => ({ rank: index + 1, ...row })));
  } catch (err) {
    console.error("Leaderboard error:", err.message);
    res.status(500).json({ error: "Failed to load the leaderboard" });
  }
});

// GET /api/daily → one problem per day, the same for everyone (changes at midnight UTC)
router.get("/daily", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, difficulty, album, tags
         FROM problems
        WHERE status = 'published' AND difficulty IN ('easy', 'medium')
          AND title !~ '^(Codeforces|CodeChef|AtCoder|Kattis) '
        ORDER BY md5(id::text || current_date::text)
        LIMIT 1`
    );
    if (!result.rows[0]) return res.status(404).json({ error: "No problems yet" });
    res.json({ date: dayKey(new Date()), ...result.rows[0] });
  } catch (err) {
    console.error("Daily problem error:", err.message);
    res.status(500).json({ error: "Failed to pick today's problem" });
  }
});

module.exports = router;
