// Import problems from the TACO dataset (BAAI/TACO on Hugging Face, Apache-2.0).
//
//   npm run import:taco -- --easy 200 --medium 200 --hard 100
//   npm run import:taco -- --dry-run --easy 20 --medium 0 --hard 0
//
// TACO ships as Parquet files of 180–330 MB. Only the columns we need are fetched, one
// block of 1,000 problems at a time (about 40–60 MB each), and the import stops as soon
// as the requested number of problems has been added. Nothing is written to disk.
//
// Flags
//   --easy N / --medium N / --hard N   how many problems to add per difficulty (200/200/100)
//   --include-very-hard                also take VERY_HARD problems (counted as hard)
//   --exclude-sources a,b              origin sites to leave out (default: leetcode,hackerrank,geeksforgeeks)
//   --shards 0,3                       which of the 9 training files to read (default: all, in order)
//   --file path.parquet                read a local Parquet file instead of downloading
//   --max-tests N                      tests kept per problem (10)
//   --max-test-bytes N                 largest single test, input + output (10000)
//   --min-tests N                      problems with fewer usable tests are left out (3)
//   --dry-run                          report what would happen, save nothing
require("dotenv").config();
const { runImport, parseArgs, explainError, pool } = require("./store");
const { sha256 } = require("./normalize");
const { fixTitles } = require("./fix-titles");

const DATASET = "https://huggingface.co/datasets/BAAI/TACO/resolve/main/ALL";
const SHARDS = 9;
const COLUMNS = ["question", "input_output", "difficulty", "name", "source", "tags", "url", "time_limit", "memory_limit", "picture_num"];
const DIFFICULTY = { EASY: "easy", MEDIUM: "medium", MEDIUM_HARD: "hard", HARD: "hard", VERY_HARD: "hard" };
const ORIGIN_LABEL = { codeforces: "Codeforces", codechef: "CodeChef", atcoder: "AtCoder", kattis: "Kattis", hackerearth: "HackerEarth", aizu: "Aizu" };

const titleCase = text => text.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b[a-z]/g, c => c.toUpperCase());

// Most TACO rows have no problem name, so fall back to the origin site's own problem code.
function deriveTitle(row) {
  const name = (row.name || "").trim();
  if (name) {
    const afterContest = name.includes(" - ") ? name.split(" - ").slice(1).join(" - ") : name; // "AtCoder Beginner Contest 169 - Count Median"
    const cleaned = afterContest.replace(/^\d+[_\s]*[A-Z]\d?[.:]\s*/, ""); // "1037_E. Trips"
    return /[A-Z ]/.test(cleaned) ? cleaned.trim() : titleCase(cleaned); // "subly-again" → "Subly Again"
  }
  const url = row.url || "";
  const label = ORIGIN_LABEL[row.source] || titleCase(row.source || "");
  let match;
  if ((match = url.match(/codeforces\.com\/.*?(\d+)\/(?:problem\/)?([A-Z]\d?)\b/))) return `Codeforces ${match[1]}${match[2]}`;
  if ((match = url.match(/codechef\.com\/problems\/([A-Za-z0-9_]+)/))) return `CodeChef ${match[1].toUpperCase()}`;
  if ((match = url.match(/atcoder\.jp\/contests\/[^/]+\/tasks\/([a-z0-9_]+)/))) return `AtCoder ${match[1].toUpperCase().replace(/_/g, " ")}`;
  if ((match = url.match(/kattis\.com\/problems\/([a-z0-9]+)/))) return `${label} ${titleCase(match[1])}`;
  return null;
}

function parseList(text) {
  const items = [];
  for (const match of String(text || "").matchAll(/'([^']+)'|"([^"]+)"/g)) items.push((match[1] || match[2]).trim().toLowerCase());
  return [...new Set(items)].slice(0, 8);
}

const toText = value => (Array.isArray(value) ? value.map(toText).join("\n") : String(value ?? ""));

// Keep the first two tests as visible samples, then the biggest of the rest (they are the
// ones that catch slow solutions), all within the size limit.
function pickTests(inputOutput, opts) {
  let io;
  try { io = JSON.parse(inputOutput); } catch { return { reason: "bad_tests" }; }
  if (io.fn_name) return { reason: "function_style" }; // "implement this function" problems cannot be judged over stdin/stdout
  const inputs = io.inputs || [];
  const outputs = io.outputs || [];
  if (!inputs.length || inputs.length !== outputs.length) return { reason: "bad_tests" };

  const usable = [];
  for (let i = 0; i < inputs.length; i++) {
    const input = toText(inputs[i]);
    const expected = toText(outputs[i]);
    if (input.length + expected.length > opts.maxTestBytes || !expected.trim()) continue;
    usable.push({ input, expected_output: expected, size: input.length + expected.length });
  }
  if (usable.length < opts.minTests) return { reason: "too_few_small_tests" };

  const samples = usable.slice(0, 2);
  const hidden = usable.slice(2).sort((a, b) => b.size - a.size).slice(0, Math.max(0, opts.maxTests - samples.length));
  return {
    tests: [...samples.map(t => ({ ...t, is_sample: true })), ...hidden.map(t => ({ ...t, is_sample: false }))],
  };
}

function toProblem(row, opts) {
  const difficulty = DIFFICULTY[row.difficulty];
  if (!difficulty || (row.difficulty === "VERY_HARD" && !opts.includeVeryHard)) return { reason: "difficulty_not_wanted" };
  if (opts.excludeSources.has(row.source)) return { reason: "source_excluded" };
  if (Number(row.picture_num) > 0) return { reason: "needs_images" };
  const question = (row.question || "").trim();
  if (question.length < 100 || question.length > 6000) return { reason: "statement_length" };
  const title = deriveTitle(row);
  if (!title) return { reason: "no_title" };
  const picked = pickTests(row.input_output, opts);
  if (!picked.tests) return picked;

  const seconds = parseFloat(row.time_limit);
  const megabytes = /megabyte/i.test(row.memory_limit || "") ? parseFloat(row.memory_limit) : NaN;
  return {
    problem: {
      title,
      description: question,
      difficulty,
      timeLimit: Number.isFinite(seconds) ? Math.min(5, Math.max(1, Math.ceil(seconds))) : 5,
      memoryLimit: Number.isFinite(megabytes) ? Math.min(512000, Math.max(64000, Math.round(megabytes * 1000))) : 256000,
      source: "taco",
      sourceId: `${row.source}:${sha256(row.url || question).slice(0, 16)}`,
      sourceUrl: row.url || null,
      license: "Apache-2.0 (TACO dataset)",
      tags: parseList(row.tags),
      tests: picked.tests,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const number = (key, fallback) => (args[key] === undefined ? fallback : Number(args[key]));
  const quota = { easy: number("easy", 200), medium: number("medium", 200), hard: number("hard", 100) };
  const opts = {
    maxTests: number("max-tests", 10),
    maxTestBytes: number("max-test-bytes", 10000),
    minTests: number("min-tests", 3),
    includeVeryHard: Boolean(args["include-very-hard"]),
    excludeSources: new Set(String(args["exclude-sources"] ?? "leetcode,hackerrank,geeksforgeeks").split(",").filter(Boolean)),
  };
  const shards = args.shards ? String(args.shards).split(",").map(Number) : [...Array(SHARDS).keys()];
  const sources = args.file ? [{ file: args.file }] : shards.map(n => ({ url: `${DATASET}/train-${String(n).padStart(5, "0")}-of-${String(SHARDS).padStart(5, "0")}.parquet` }));

  const { asyncBufferFromUrl, asyncBufferFromFile, parquetMetadataAsync, parquetReadObjects } = await import("hyparquet");
  const added = { easy: 0, medium: 0, hard: 0 };
  const filtered = {};
  const done = () => Object.keys(quota).every(level => added[level] >= quota[level]);

  await runImport({ name: "TACO", dryRun: Boolean(args["dry-run"]), options: { minTests: opts.minTests } }, async add => {
    for (const source of sources) {
      if (done()) break;
      const file = source.file ? await asyncBufferFromFile(source.file) : await asyncBufferFromUrl({ url: source.url });
      const metadata = await parquetMetadataAsync(file);
      let rowStart = 0;
      for (const group of metadata.row_groups) {
        const rowEnd = rowStart + Number(group.num_rows);
        if (done()) break;
        const megabytes = group.columns.filter(c => COLUMNS.includes(c.meta_data.path_in_schema[0])).reduce((sum, c) => sum + Number(c.meta_data.total_compressed_size), 0) / 1e6;
        console.log(`⬇️  ${source.file || source.url.split("/").pop()} rows ${rowStart}–${rowEnd} (${megabytes.toFixed(0)} MB)`);
        const rows = await parquetReadObjects({ file, metadata, columns: COLUMNS, rowStart, rowEnd });
        for (const row of rows) {
          const level = DIFFICULTY[row.difficulty];
          if (level && added[level] >= quota[level]) continue; // this difficulty is already full
          const { problem, reason } = toProblem(row, opts);
          if (!problem) { filtered[reason] = (filtered[reason] || 0) + 1; continue; }
          const result = await add(problem);
          if (result.action === "inserted") added[problem.difficulty]++;
          if (done()) break;
        }
        console.log(`   so far: easy ${added.easy}/${quota.easy}, medium ${added.medium}/${quota.medium}, hard ${added.hard}/${quota.hard}`);
        rowStart = rowEnd;
      }
    }
  });
  console.log(`   left out before dedup: ${JSON.stringify(filtered)}`);

  // Replace "Codeforces 1539C"-style titles with real names from public lists.
  if (!args["dry-run"]) {
    const titles = await fixTitles();
    console.log(`🏷️  Real names found for ${titles.renamed} of ${titles.checked} code-style title(s)`);
  }
}

if (require.main === module) {
  main()
    .catch(err => { console.error("❌ TACO import failed:", explainError(err)); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { deriveTitle, pickTests, toProblem, parseList };
