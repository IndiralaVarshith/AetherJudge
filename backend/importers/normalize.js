// Fingerprinting helpers shared by every importer.
// Two problems are "the same" if their fingerprints match, whatever source they came from.
const crypto = require("crypto");

const sha256 = value => crypto.createHash("sha256").update(value, "utf8").digest("hex");

// Statement → comparable form: lowercase, no markup, no punctuation, no digits, single spaces.
// Digits are dropped on purpose so copies that differ only in constants/limits still collide.
function normalizeText(text) {
  return String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\\[a-z]+/g, " ") // LaTeX commands (\le, \dots, ...)
    .replace(/[^\p{L}\s]/gu, " ") // keep letters only
    .replace(/\s+/g, " ")
    .trim();
}

// Test input/output → comparable form: unix newlines, no trailing spaces, no trailing blank lines.
function normalizeIO(text) {
  return String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.trimEnd())
    .join("\n")
    .trim();
}

const textHash = statement => sha256(normalizeText(statement));

// One fingerprint per (input, expected output) pair.
const pairHash = (input, output) => sha256(`${sha256(normalizeIO(input))}:${sha256(normalizeIO(output))}`);

// Fingerprint of the whole test set, independent of order and of repeated tests.
const testsHash = pairHashes => sha256([...new Set(pairHashes)].sort().join("\n"));

function slugify(title) {
  return String(title || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

module.exports = { sha256, normalizeText, normalizeIO, textHash, pairHash, testsHash, slugify };
