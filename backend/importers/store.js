// Shared "add a problem, but only if we don't already have it" logic.
//
// Every importer (TACO, Exercism, later the AI generator) hands its problems to
// importProblem(). A problem goes through four checks, cheapest first:
//
//   1. same source + source id      → skip          (re-running an import adds nothing)
//   2. same statement fingerprint   → skip          (copies with formatting differences)
//   3. same tests                   → skip / review (same problem, different wording)
//   4. similar wording (pg_trgm)    → skip / review (near copies and paraphrases)
//      or the same title            → review
//
// "review" problems are stored with status = 'review' and duplicate_of = <id>, so they
// stay hidden from users until someone approves them. Nothing borderline is dropped silently.
const fs = require("fs");
const path = require("path");
const pool = require("../src/db");
const { normalizeText, normalizeIO, textHash, pairHash, testsHash, slugify } = require("./normalize");

const DEFAULTS = {
  reviewSimilarity: 0.6, // wording at least this similar → hold for review
  duplicateSimilarity: 0.92, // wording at least this similar → treat as the same problem
  minSharedTests: 3, // fewer shared tests than this proves nothing ("1" → "1" is everywhere)
  sharedTestsRatio: 0.6, // share of the incoming tests that must already exist elsewhere
  normTextLength: 3000, // how much of the statement the similarity search looks at
};

// ── Schema + fingerprints for rows that existed before the dedup columns ──────────────
async function ensureSchema(client) {
  const sql = fs.readFileSync(path.join(__dirname, "../init.sql"), "utf8");
  await client.query(sql);
  const trgm = await client.query("SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'");
  return { hasTrgm: trgm.rowCount > 0 };
}

async function backfillFingerprints(client, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const tests = await client.query("SELECT id, input, expected_output FROM test_cases WHERE pair_hash IS NULL");
  for (const row of tests.rows) {
    await client.query("UPDATE test_cases SET pair_hash = $1 WHERE id = $2", [pairHash(row.input, row.expected_output), row.id]);
  }

  const problems = await client.query("SELECT id, title, description FROM problems WHERE text_hash IS NULL ORDER BY id");
  let conflicts = 0;
  for (const row of problems.rows) {
    const hashes = (await client.query("SELECT DISTINCT pair_hash FROM test_cases WHERE problem_id = $1", [row.id])).rows.map(r => r.pair_hash);
    const norm = normalizeText(row.description);
    await client.query("SAVEPOINT backfill");
    try {
      await client.query(
        `UPDATE problems SET text_hash = $1, norm_text = $2, tests_hash = $3, test_count = $4,
                slug = COALESCE(slug, $5) WHERE id = $6`,
        [textHash(row.description), norm.slice(0, opts.normTextLength), hashes.length ? testsHash(hashes) : null, hashes.length, await freeSlug(client, row.title), row.id]
      );
      await client.query("RELEASE SAVEPOINT backfill");
    } catch (err) {
      // Two existing problems with the same statement: leave the later one unfingerprinted.
      await client.query("ROLLBACK TO SAVEPOINT backfill");
      conflicts++;
      console.warn(`⚠️  Problem #${row.id} "${row.title}" duplicates an existing statement (${err.code || err.message})`);
    }
  }
  return { tests: tests.rowCount, problems: problems.rowCount - conflicts, conflicts };
}

async function freeSlug(client, title) {
  const base = slugify(title) || "problem";
  const taken = new Set((await client.query("SELECT slug FROM problems WHERE slug = $1 OR slug LIKE $2", [base, `${base}-%`])).rows.map(r => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

// ── Preparing an incoming problem ─────────────────────────────────────────────────────
function prepare(problem, opts) {
  const seen = new Set();
  const tests = [];
  for (const test of problem.tests || []) {
    const input = normalizeIO(test.input);
    const expected = normalizeIO(test.expected_output);
    if (expected === "") continue; // nothing to compare against
    const hash = pairHash(input, expected);
    if (seen.has(hash)) continue; // repeated test inside the same problem
    seen.add(hash);
    tests.push({ input, expected_output: expected, is_sample: Boolean(test.is_sample), pair_hash: hash });
  }
  if (tests.length && !tests.some(t => t.is_sample)) tests[0].is_sample = true;

  const norm = normalizeText(problem.description);
  return {
    ...problem,
    tests,
    norm,
    normText: norm.slice(0, opts.normTextLength),
    textHash: textHash(problem.description),
    testsHash: tests.length ? testsHash(tests.map(t => t.pair_hash)) : null,
  };
}

// ── The four checks ───────────────────────────────────────────────────────────────────
async function findDuplicate(client, p, opts) {
  if (p.sourceId) {
    const same = await client.query("SELECT id FROM problems WHERE source = $1 AND source_id = $2", [p.source, p.sourceId]);
    if (same.rows[0]) return { verdict: "skip", reason: "already_imported", id: same.rows[0].id };
  }

  const sameText = await client.query("SELECT id, source, test_count FROM problems WHERE text_hash = $1", [p.textHash]);
  if (sameText.rows[0]) return { verdict: "skip", reason: "same_statement", ...sameText.rows[0], upgradable: true };

  if (p.tests.length >= opts.minSharedTests) {
    const sameTests = await client.query("SELECT id FROM problems WHERE tests_hash = $1 AND test_count >= $2 ORDER BY id LIMIT 1", [p.testsHash, opts.minSharedTests]);
    if (sameTests.rows[0]) return { verdict: "skip", reason: "same_tests", id: sameTests.rows[0].id };

    const overlap = await client.query(
      `SELECT problem_id AS id, COUNT(DISTINCT pair_hash)::int AS shared
         FROM test_cases WHERE pair_hash = ANY($1) GROUP BY problem_id ORDER BY shared DESC, problem_id LIMIT 1`,
      [p.tests.map(t => t.pair_hash)]
    );
    const hit = overlap.rows[0];
    if (hit && hit.shared >= opts.minSharedTests && hit.shared >= opts.sharedTestsRatio * p.tests.length) {
      return { verdict: "review", reason: "shared_tests", id: hit.id, similarity: hit.shared / p.tests.length };
    }
  }

  let sameTitle = null;
  if (!/\d/.test(p.title)) { // titles that are just an origin code ("Codeforces 1539C") say nothing
    const titled = await client.query("SELECT id FROM problems WHERE lower(title) = lower($1) ORDER BY id LIMIT 1", [p.title]);
    if (titled.rows[0]) sameTitle = { verdict: "review", reason: "same_title", id: titled.rows[0].id, similarity: null };
  }

  if (opts.hasTrgm && p.normText.length >= 40) {
    const similar = await client.query(
      `SELECT id, source, test_count, similarity(norm_text, $1) AS sim
         FROM problems WHERE norm_text % $1 ORDER BY sim DESC, id LIMIT 1`,
      [p.normText]
    );
    const hit = similar.rows[0];
    if (hit && hit.sim >= opts.duplicateSimilarity) return { verdict: "skip", reason: "near_identical_wording", ...hit, similarity: hit.sim, upgradable: true };
    if (hit && hit.sim >= opts.reviewSimilarity) return { verdict: "review", reason: "similar_wording", id: hit.id, similarity: hit.sim };
  }
  return sameTitle;
}

async function insertTests(client, problemId, tests) {
  for (const t of tests) {
    await client.query(
      "INSERT INTO test_cases (problem_id, input, expected_output, is_sample, pair_hash) VALUES ($1, $2, $3, $4, $5)",
      [problemId, t.input, t.expected_output, t.is_sample, t.pair_hash]
    );
  }
}

// Returns { action, id?, duplicateOf?, reason?, similarity? } where action is one of
// inserted | review | skipped | upgraded | invalid.
async function importProblem(client, problem, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const p = prepare(problem, opts);
  if (!p.title || !p.description || !p.source) return { action: "invalid", reason: "missing_title_or_description" };
  if (p.tests.length < (opts.minTests || 1)) return { action: "invalid", reason: "too_few_tests" };

  const dup = await findDuplicate(client, p, opts);

  if (dup && dup.verdict === "skip") {
    // Same problem, but the incoming copy has more tests: keep the richer test set.
    // Hand-written problems are never touched.
    if (opts.allowUpgrade !== false && dup.upgradable && dup.source !== "manual" && p.tests.length > dup.test_count) {
      await client.query("DELETE FROM test_cases WHERE problem_id = $1", [dup.id]);
      await insertTests(client, dup.id, p.tests);
      await client.query("UPDATE problems SET tests_hash = $1, test_count = $2 WHERE id = $3", [p.testsHash, p.tests.length, dup.id]);
      return { action: "upgraded", id: dup.id, reason: dup.reason };
    }
    return { action: "skipped", duplicateOf: dup.id, reason: dup.reason, similarity: dup.similarity };
  }

  const review = dup && dup.verdict === "review";
  const inserted = await client.query(
    `INSERT INTO problems (title, description, difficulty, time_limit, memory_limit, slug, source, source_id, source_url,
                           license, tags, status, text_hash, tests_hash, test_count, norm_text, duplicate_of, similarity)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
    [
      p.title, p.description, p.difficulty || "medium", p.timeLimit || 5, p.memoryLimit || 128000,
      await freeSlug(client, p.title), p.source, p.sourceId || null, p.sourceUrl || null, p.license || null,
      p.tags || [], review ? "review" : "published", p.textHash, p.testsHash, p.tests.length, p.normText,
      review ? dup.id : null, review ? dup.similarity : null,
    ]
  );
  const id = inserted.rows[0].id;
  await insertTests(client, id, p.tests);
  return review
    ? { action: "review", id, duplicateOf: dup.id, reason: dup.reason, similarity: dup.similarity }
    : { action: "inserted", id };
}

// ── Running a whole import ────────────────────────────────────────────────────────────
// `produce(add)` is the importer: it calls `await add(problem)` for each candidate and may
// stop early. Everything runs in one transaction, so --dry-run can roll the lot back while
// still comparing each problem against the ones "added" earlier in the same run.
async function runImport({ name, dryRun = false, options = {} }, produce) {
  const client = await pool.connect();
  const stats = { inserted: 0, review: 0, upgraded: 0, skipped: {}, invalid: {} };
  try {
    await client.query("BEGIN");
    const { hasTrgm } = await ensureSchema(client);
    if (!hasTrgm) console.warn("⚠️  pg_trgm is not available: the similar-wording check is off for this run.");
    else await client.query("SELECT set_config('pg_trgm.similarity_threshold', $1, false)", [String(options.reviewSimilarity || DEFAULTS.reviewSimilarity)]);
    const backfilled = await backfillFingerprints(client, options);
    if (backfilled.problems || backfilled.tests) console.log(`🔎 Fingerprinted ${backfilled.problems} existing problem(s), ${backfilled.tests} test case(s)`);

    const add = async problem => {
      await client.query("SAVEPOINT one_problem");
      try {
        const result = await importProblem(client, problem, { ...options, hasTrgm });
        await client.query("RELEASE SAVEPOINT one_problem");
        if (result.action === "skipped" || result.action === "invalid") {
          stats[result.action][result.reason] = (stats[result.action][result.reason] || 0) + 1;
        } else {
          stats[result.action]++;
        }
        if (result.action === "review") {
          console.log(`🟡 Held for review: "${problem.title}" looks like #${result.duplicateOf} (${result.reason}${result.similarity == null ? "" : `, ${(result.similarity * 100).toFixed(0)}%`})`);
        }
        return result;
      } catch (err) {
        await client.query("ROLLBACK TO SAVEPOINT one_problem");
        stats.invalid.error = (stats.invalid.error || 0) + 1;
        console.warn(`⚠️  Could not import "${problem.title}": ${err.message}`);
        return { action: "invalid", reason: "error" };
      }
    };

    await produce(add, stats);
    await client.query(dryRun ? "ROLLBACK" : "COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  console.log(`\n📦 ${name} import ${dryRun ? "(dry run, nothing saved)" : "finished"}`);
  console.log(`   added:           ${stats.inserted}`);
  console.log(`   held for review: ${stats.review}`);
  console.log(`   tests upgraded:  ${stats.upgraded}`);
  console.log(`   duplicates skipped: ${JSON.stringify(stats.skipped)}`);
  console.log(`   not usable:         ${JSON.stringify(stats.invalid)}`);
  return stats;
}

// Add a single problem (used by the admin API) with the same duplicate checks as the importers.
async function addProblem(problem, options = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const hasTrgm = (await client.query("SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'")).rowCount > 0;
    if (hasTrgm) await client.query("SELECT set_config('pg_trgm.similarity_threshold', $1, true)", [String(options.reviewSimilarity || DEFAULTS.reviewSimilarity)]);
    const result = await importProblem(client, problem, { ...options, hasTrgm, allowUpgrade: false });
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Tiny `--flag value` / `--flag` parser so the importers need no extra dependency.
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) args[key] = true;
    else { args[key] = next; i++; }
  }
  return args;
}

// Connection failures arrive as an AggregateError with an empty message, so spell them out.
function explainError(err) {
  const code = err.code || err.errors?.[0]?.code;
  if (code === "ECONNREFUSED") {
    return `cannot reach PostgreSQL at ${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 5433}. Is the database running?`;
  }
  return err.message || err.errors?.map(e => e.message).join("; ") || String(code || err);
}

module.exports = { DEFAULTS, ensureSchema, backfillFingerprints, importProblem, addProblem, runImport, parseArgs, explainError, pool };
