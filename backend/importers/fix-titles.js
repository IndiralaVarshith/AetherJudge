// Replace code-style titles ("Codeforces 1539C", "AtCoder ABC169 E") with the problem's
// real name, looked up from free public sources:
//   • Codeforces: the official API, codeforces.com/api/problemset.problems
//   • AtCoder:    the community AtCoder Problems dataset, kenkoooo.com/atcoder/resources/problems.json
// Problems not found in either list keep their current title.
//
//   npm run fix:titles              (add --dry-run to only report)
//   npm run fix:titles -- --deep    (also ask individual Codeforces contests; downloads a few MB each)
//
// The TACO importer runs this automatically after each import.
require("dotenv").config();
const pool = require("../src/db");
const { slugify } = require("./normalize");

const HEADERS = { "User-Agent": "problem-importer" };
const CODE_TITLE = "^(Codeforces|AtCoder) ";

async function fetchJson(url) {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

// Both lists are loaded once per run. A failed source is reported and skipped.
async function loadNameSources() {
  const names = { codeforces: new Map(), atcoder: new Map() };
  try {
    const data = await fetchJson("https://codeforces.com/api/problemset.problems");
    for (const p of data.result?.problems || []) names.codeforces.set(`${p.contestId}${p.index}`, p.name);
  } catch (err) {
    console.warn(`⚠️  Codeforces names unavailable: ${err.message}`);
  }
  try {
    const data = await fetchJson("https://kenkoooo.com/atcoder/resources/problems.json");
    for (const p of data) names.atcoder.set(p.id, p.name);
  } catch (err) {
    console.warn(`⚠️  AtCoder names unavailable: ${err.message}`);
  }
  return names;
}

function realName(url, names) {
  let match;
  if ((match = String(url || "").match(/codeforces\.com\/.*?(\d+)\/(?:problem\/)?([A-Z]\d?)\b/))) {
    return names.codeforces.get(`${match[1]}${match[2]}`) || null;
  }
  if ((match = String(url || "").match(/atcoder\.jp\/contests\/[^/]+\/tasks\/([a-z0-9_]+)/))) {
    return names.atcoder.get(match[1]) || null;
  }
  return null;
}

async function freeSlug(client, title, ownId) {
  const base = slugify(title) || "problem";
  const taken = new Set((await client.query(
    "SELECT slug FROM problems WHERE (slug = $1 OR slug LIKE $2) AND id <> $3", [base, `${base}-%`, ownId]
  )).rows.map(row => row.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

// The problemset list leaves out some problems (mostly the second copy of problems shared
// between Div. 1 and Div. 2 rounds). With --deep, ask each such contest directly, spaced
// out to respect Codeforces' limit of one call every two seconds. Codeforces only serves
// the full scoreboard for this call (a few MB per contest), so it is opt-in.
async function fillMissingCodeforces(rows, names) {
  const contests = new Set();
  for (const row of rows) {
    const match = String(row.source_url || "").match(/codeforces\.com\/.*?(\d+)\/(?:problem\/)?([A-Z]\d?)\b/);
    if (match && !names.codeforces.has(`${match[1]}${match[2]}`)) contests.add(match[1]);
  }
  for (const contestId of contests) {
    try {
      const data = await fetchJson(`https://codeforces.com/api/contest.standings?contestId=${contestId}`);
      for (const p of data.result?.problems || []) names.codeforces.set(`${contestId}${p.index}`, p.name);
    } catch (err) {
      console.warn(`⚠️  Codeforces contest ${contestId}: ${err.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 2100));
  }
  return contests.size;
}

// Returns { checked, renamed, missing }.
async function fixTitles({ dryRun = false, deep = false, names } = {}) {
  const sources = names || await loadNameSources();
  const client = await pool.connect();
  const result = { checked: 0, renamed: 0, missing: 0 };
  try {
    await client.query("BEGIN");
    const rows = (await client.query("SELECT id, title, source_url FROM problems WHERE title ~ $1 ORDER BY id", [CODE_TITLE])).rows;
    result.checked = rows.length;
    const asked = deep ? await fillMissingCodeforces(rows, sources) : 0;
    if (asked) console.log(`🔎 Asked ${asked} Codeforces contest(s) directly for names missing from the problem list`);
    for (const row of rows) {
      const name = realName(row.source_url, sources)?.replace(/\s+/g, " ").trim();
      if (!name) { result.missing++; continue; }
      await client.query("UPDATE problems SET title = $1, slug = $2 WHERE id = $3", [name, await freeSlug(client, name, row.id), row.id]);
      result.renamed++;
    }
    await client.query(dryRun ? "ROLLBACK" : "COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return result;
}

if (require.main === module) {
  const dryRun = process.argv.includes("--dry-run");
  const deep = process.argv.includes("--deep");
  fixTitles({ dryRun, deep })
    .then(({ checked, renamed, missing }) => {
      console.log(`🏷️  ${checked} code-style titles checked: ${renamed} renamed${dryRun ? " (dry run, nothing saved)" : ""}, ${missing} not found in the public lists.`);
    })
    .catch(err => { console.error("❌ Could not fix titles:", err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { fixTitles, loadNameSources, realName };
