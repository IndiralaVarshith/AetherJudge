// One-off repair for databases imported before the Exercism importer skipped huge numbers:
// removes Exercism test cases whose input or output was written in scientific notation
// (e.g. "1.8670996100153877e+32") and refreshes each affected problem's fingerprint.
//
//   node importers/fix-unsafe-numbers.js            (add --dry-run to only report)
require("dotenv").config();
const pool = require("../src/db");
const { testsHash } = require("./normalize");

const SCI = "^-?[0-9]+(\\.[0-9]+)?e[+-][0-9]+$";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const bad = await client.query(
      `SELECT t.id, t.problem_id, p.title FROM test_cases t JOIN problems p ON p.id = t.problem_id
        WHERE p.source = 'exercism' AND (t.input ~* $1 OR t.expected_output ~* $1)`,
      [SCI]
    );
    const problemIds = [...new Set(bad.rows.map(row => row.problem_id))];
    console.log(`Found ${bad.rowCount} broken test case(s) in: ${[...new Set(bad.rows.map(row => row.title))].join(", ") || "none"}`);

    if (bad.rowCount) await client.query("DELETE FROM test_cases WHERE id = ANY($1)", [bad.rows.map(row => row.id)]);
    for (const id of problemIds) {
      const hashes = (await client.query("SELECT DISTINCT pair_hash FROM test_cases WHERE problem_id = $1 AND pair_hash IS NOT NULL", [id])).rows.map(row => row.pair_hash);
      await client.query("UPDATE problems SET test_count = $1, tests_hash = $2 WHERE id = $3", [hashes.length, hashes.length ? testsHash(hashes) : null, id]);
    }
    await client.query(dryRun ? "ROLLBACK" : "COMMIT");
    console.log(dryRun ? "Dry run: nothing changed." : `Removed them and refreshed ${problemIds.length} problem(s).`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error("❌", err.message); process.exitCode = 1; });
