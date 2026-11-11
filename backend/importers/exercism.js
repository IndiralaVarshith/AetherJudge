// Import exercises from Exercism's problem-specifications repository (MIT licence).
//
//   npm run import:exercism
//   npm run import:exercism -- --dry-run
//
// Exercism describes each exercise as "call this function with these arguments, expect
// this value". AetherJudge judges programs over stdin/stdout, so an exercise is only
// imported when it converts cleanly:
//   • every test calls the same function,
//   • every argument is a number, a true/false value, a one-line string, or a flat list of those,
//   • the expected answer is one of the same (whole numbers only, no decimals).
// Each argument becomes one input line (lists are space-separated), and an "Input / Output"
// section describing that layout is added to the statement. Everything else is left out
// and counted in the summary.
//
// Safe to run on a schedule: exercises that are already in the database are skipped.
//
// Flags
//   --only slug1,slug2   import just these exercises
//   --min-tests N        exercises with fewer usable tests are left out (3)
//   --max-tests N        tests kept per exercise, spread evenly over its cases (20)
//   --dry-run            report what would happen, save nothing
require("dotenv").config();
const { runImport, parseArgs, explainError, pool } = require("./store");

const REPO = "exercism/problem-specifications";
const RAW = `https://raw.githubusercontent.com/${REPO}/main/exercises`;
const HEADERS = { "User-Agent": "problem-importer", Accept: "application/vnd.github+json" };

async function fetchText(url, { optional = false } = {}) {
  const response = await fetch(url, { headers: HEADERS });
  if (response.status === 404 && optional) return null;
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.text();
}

// One request lists the whole repository, so we know which files exist per exercise.
async function listExercises() {
  const tree = JSON.parse(await fetchText(`https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`));
  const exercises = new Map();
  for (const entry of tree.tree) {
    const match = entry.path.match(/^exercises\/([^/]+)\/([^/]+)$/);
    if (!match) continue;
    if (!exercises.has(match[1])) exercises.set(match[1], new Set());
    exercises.get(match[1]).add(match[2]);
  }
  return exercises;
}

// ── Converting one exercise ───────────────────────────────────────────────────────────
function flattenCases(node, out = []) {
  for (const item of node.cases || []) {
    if (Array.isArray(item.cases)) flattenCases(item, out);
    else out.push(item);
  }
  return out;
}

const isScalar = value => ["number", "string", "boolean"].includes(typeof value);

// Returns the text for one value, or null when it cannot be written on a single line.
function encode(value, { insideList = false } = {}) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : null;
  if (typeof value === "string") {
    if (/[\r\n]/.test(value) || value !== value.trim()) return null;
    if (insideList && (value === "" || /\s/.test(value))) return null; // would be ambiguous in a space-separated list
    return value;
  }
  if (Array.isArray(value) && !insideList) {
    const parts = value.map(item => (isScalar(item) ? encode(item, { insideList: true }) : null));
    return parts.includes(null) ? null : parts.join(" ");
  }
  return null;
}

function describe(values) {
  const sample = values.find(v => !(Array.isArray(v) && v.length === 0));
  const kind = v => (typeof v === "number" ? "an integer" : typeof v === "boolean" ? "`true` or `false`" : "a string");
  if (Array.isArray(sample)) return `${typeof sample[0] === "number" ? "integers" : typeof sample[0] === "boolean" ? "`true`/`false` values" : "words"} separated by spaces`;
  if (sample === undefined) return "a list separated by spaces";
  return kind(sample);
}

const words = name => String(name).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();

// Keep at most `max` tests, spread evenly so every group of cases stays represented.
function spread(tests, max) {
  if (tests.length <= max) return tests;
  return Array.from({ length: max }, (_, i) => tests[Math.round((i * (tests.length - 1)) / (max - 1))]);
}

function convert(slug, canonical, instructions, title, maxTests = 20) {
  let cases = flattenCases(canonical);
  const replaced = new Set(cases.map(c => c.reimplements).filter(Boolean)); // newer versions of corrected tests
  cases = cases.filter(c => !replaced.has(c.uuid));
  // Tests that expect an error have no output to compare.
  cases = cases.filter(c => !(c.expected && typeof c.expected === "object" && !Array.isArray(c.expected) && "error" in c.expected));
  if (!cases.length) return { reason: "no_plain_tests" };

  const properties = new Set(cases.map(c => c.property));
  if (properties.size !== 1) return { reason: "several_functions" };
  const keys = Object.keys(cases[0].input || {});
  if (!keys.length) return { reason: "no_input" };
  if (cases.some(c => Object.keys(c.input || {}).join("|") !== keys.join("|"))) return { reason: "varying_arguments" };

  const tests = [];
  for (const testCase of cases) {
    const lines = keys.map(key => encode(testCase.input[key]));
    const expected = Array.isArray(testCase.expected)
      ? (testCase.expected.every(isScalar) ? testCase.expected.map(item => encode(item, { insideList: typeof item !== "string" })) : [null])
      : [encode(testCase.expected)];
    if (lines.includes(null)) return { reason: "complex_input" };
    if (expected.includes(null)) return { reason: "complex_output" };
    // An empty input line (empty string or empty list) is easy to misread from stdin, and an
    // empty answer cannot be compared: leave just that test out.
    if (lines.includes("") || expected.join("") === "") continue;
    const numbersOnly = Array.isArray(testCase.expected) && testCase.expected.every(item => typeof item === "number");
    tests.push({ input: lines.join("\n"), expected_output: expected.join(numbersOnly ? " " : "\n") });
  }

  if (tests.length < 1) return { reason: "no_plain_tests" };
  const outputs = cases.map(c => c.expected);
  const listOutput = outputs.find(Array.isArray);
  const outputLine = listOutput
    ? (outputs.flat().every(v => typeof v === "number") ? "Print the resulting integers on one line, separated by spaces." : "Print each resulting item on its own line.")
    : `Print ${describe(outputs)}: the result of "${words(canonical.cases?.length ? cases[0].property : slug)}".`;
  const format = [
    "## Input",
    ...keys.map((key, index) => `Line ${index + 1}: ${words(key)} — ${describe(cases.map(c => c.input[key]))}`),
    "",
    "## Output",
    outputLine,
  ].join("\n");

  return {
    problem: {
      title,
      description: `${instructions.trim()}\n\n${format}`,
      difficulty: "easy",
      source: "exercism",
      sourceId: slug,
      sourceUrl: `https://github.com/${REPO}/tree/main/exercises/${slug}`,
      license: "MIT (Exercism problem-specifications)",
      tags: ["exercism"],
      tests: spread(tests, maxTests).map((test, index) => ({ ...test, is_sample: index < 2 })),
    },
  };
}

// Exercism writes statements as Markdown with a "# Instructions" heading we do not need.
const cleanMarkdown = text => String(text || "").replace(/^#\s+(Instructions|Description|Introduction)\s*$/gim, "").replace(/\n{3,}/g, "\n\n").trim();

async function loadExercise(slug, files, maxTests) {
  const [canonical, meta, instructions, introduction] = await Promise.all([
    fetchText(`${RAW}/${slug}/canonical-data.json`),
    files.has("metadata.toml") ? fetchText(`${RAW}/${slug}/metadata.toml`) : null,
    fetchText(`${RAW}/${slug}/${files.has("instructions.md") ? "instructions.md" : "description.md"}`),
    files.has("introduction.md") ? fetchText(`${RAW}/${slug}/introduction.md`) : null,
  ]);
  const title = meta?.match(/^title\s*=\s*"(.+)"\s*$/m)?.[1] || slug.replace(/-/g, " ").replace(/\b[a-z]/g, c => c.toUpperCase());
  const statement = [cleanMarkdown(introduction), cleanMarkdown(instructions)].filter(Boolean).join("\n\n");
  return convert(slug, JSON.parse(canonical), statement, title, maxTests);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const only = args.only ? new Set(String(args.only).split(",")) : null;
  const minTests = args["min-tests"] === undefined ? 3 : Number(args["min-tests"]);
  const maxTests = args["max-tests"] === undefined ? 20 : Number(args["max-tests"]);

  const all = await listExercises();
  const candidates = [...all.entries()]
    .filter(([slug, files]) => files.has("canonical-data.json") && !files.has(".deprecated") && (files.has("instructions.md") || files.has("description.md")))
    .filter(([slug]) => !only || only.has(slug))
    .sort(([a], [b]) => a.localeCompare(b));
  console.log(`🔎 ${candidates.length} Exercism exercises have test data`);

  const leftOut = {};
  await runImport({ name: "Exercism", dryRun: Boolean(args["dry-run"]), options: { minTests } }, async add => {
    const batchSize = 8; // download a few at a time, add them in a stable order
    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      const loaded = await Promise.all(batch.map(([slug, files]) => loadExercise(slug, files, maxTests).catch(err => ({ reason: "download_failed", error: err.message }))));
      for (let j = 0; j < batch.length; j++) {
        const { problem, reason } = loaded[j];
        if (!problem) { leftOut[reason] = (leftOut[reason] || 0) + 1; continue; }
        await add(problem);
      }
    }
  });
  console.log(`   could not be converted to input/output: ${JSON.stringify(leftOut)}`);
}

if (require.main === module) {
  main()
    .catch(err => { console.error("❌ Exercism import failed:", explainError(err)); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { convert, encode, flattenCases };
