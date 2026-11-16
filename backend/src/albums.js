// Albums: topic collections ("Strings", "Arrays", ...) listed in the order a learner should
// meet them. The same list drives three things:
//   • which album(s) every problem belongs to,
//   • the order problems are listed in (album order → easy before hard),
//   • the stages of the "Guide me" page.
//
// A problem gets its albums from its tags when it has any. Many imported problems carry no
// tags, so those are matched on words in the title and statement instead; anything that
// matches nothing lands in the first album. Edit the rules here, then run `npm run albums`
// to re-sort every problem.

const ALBUMS = [
  {
    slug: "basics",
    name: "Basics & Implementation",
    description: "Read input, follow the rules in the statement, print the answer.",
    goal: "Get comfortable turning a plain-English statement into working code.",
    learn: ["Reading input and printing output", "Loops and conditions", "Simulating a process step by step", "Handling edge cases"],
    picks: { easy: 10, medium: 2, hard: 0 },
    tags: ["implementation", "ad-hoc", "fundamentals", "exercism"],
    words: [],
  },
  {
    slug: "math",
    name: "Math & Number Theory",
    description: "Divisors, primes, remainders, counting and a little geometry.",
    goal: "Spot the arithmetic pattern so you can compute the answer instead of simulating it.",
    learn: ["Divisibility, GCD and LCM", "Prime numbers and factorisation", "Modular arithmetic", "Counting and simple combinatorics"],
    picks: { easy: 6, medium: 4, hard: 2 },
    tags: ["mathematics", "number theory", "combinatorics", "probability", "geometry", "polynomials and generating functions"],
    words: [[/\bprimes?\b/g, 3], [/\bdivis(or|ible|ibility)/g, 2], [/\b(gcd|lcm)\b|greatest common divisor|least common multiple/g, 3], [/\bmodulo\b|\bremainder\b/g, 2], [/\bfactorial|fibonacci\b/g, 3], [/\bdigits?\b/g, 1], [/\bmultiples?\b/g, 1], [/\b(triangle|circle|rectangle|polygon|coordinates?)\b/g, 1], [/\bprobability\b/g, 3]],
  },
  {
    slug: "strings",
    name: "Strings",
    description: "Characters, words, palindromes, substrings and text processing.",
    goal: "Handle text confidently: scan it, count it, compare it and rebuild it.",
    learn: ["Walking through characters", "Counting letters and frequencies", "Palindromes and reversal", "Substrings and simple pattern matching"],
    picks: { easy: 6, medium: 4, hard: 2 },
    tags: ["string algorithms"],
    words: [[/\bstrings?\b/g, 2], [/\bsubstrings?\b/g, 3], [/\bpalindrom/g, 3], [/\b(lowercase|uppercase)\b/g, 2], [/\bcharacters?\b/g, 1], [/\b(vowels?|consonants?|anagrams?)\b/g, 3], [/\bletters?\b/g, 1], [/\bwords?\b/g, 1]],
  },
  {
    slug: "arrays",
    name: "Arrays",
    description: "Lists of numbers: scanning, prefix sums, subarrays and grids.",
    goal: "Process a list in one or two passes and keep the right running information.",
    learn: ["Traversal, minimum and maximum", "Prefix sums", "Subarrays and two pointers", "Matrices and grids"],
    picks: { easy: 6, medium: 4, hard: 2 },
    tags: ["matrices"],
    words: [[/\barrays?\b/g, 2], [/\bsubarrays?\b/g, 3], [/\bsequence\b/g, 1], [/\bpermutations?\b/g, 1], [/\b(matrix|grid)\b/g, 2], [/\bn integers\b/g, 1], [/\belements?\b/g, 1], [/\bprefix\b/g, 1]],
  },
  {
    slug: "sorting-searching",
    name: "Sorting & Searching",
    description: "Put things in order, then find what you need quickly.",
    goal: "Know when sorting first makes a problem easy, and when to search instead of scan.",
    learn: ["Sorting with custom order", "Binary search on a sorted list", "Binary search on the answer", "Trying all possibilities (brute force) sensibly"],
    picks: { easy: 6, medium: 4, hard: 2 },
    tags: ["sorting", "complete search", "divide and conquer"],
    words: [[/\bsort(ed|ing)?\b/g, 2], [/\bbinary search\b/g, 4], [/\bk-?th (smallest|largest)\b/g, 3], [/\b(ascending|descending|non-decreasing|non-increasing)\b/g, 1], [/\bswaps?\b/g, 1]],
  },
  {
    slug: "greedy",
    name: "Greedy & Constructive",
    description: "Make the best local choice, or build an answer that fits the rules.",
    goal: "Learn to argue why a simple choice at each step gives the best overall result.",
    learn: ["Choosing the locally best option", "Sorting by the right key before choosing", "Exchange arguments (why greedy works)", "Constructing any valid answer"],
    picks: { easy: 6, medium: 4, hard: 2 },
    tags: ["greedy algorithms", "constructive algorithms"],
    words: [[/\b(minimum|maximum|smallest|largest) (possible )?number of\b/g, 1], [/\bif there are (several|multiple) (answers|solutions)\b|\bprint any\b/g, 2]],
  },
  {
    slug: "data-structures",
    name: "Data Structures",
    description: "Stacks, queues, heaps, hash maps and range queries.",
    goal: "Pick the structure that makes the repeated operation fast.",
    learn: ["Stacks and queues", "Hash maps and sets", "Heaps / priority queues", "Answering many queries efficiently"],
    picks: { easy: 5, medium: 4, hard: 2 },
    tags: ["data structures", "amortized analysis", "range queries", "segment trees revisited", "sweep line algorithms"],
    words: [[/\b(stack|queue|deque|heap)\b/g, 3], [/\b(brackets?|parenthes[ie]s)\b/g, 3], [/\bqueries\b/g, 1], [/\bq queries\b/g, 2]],
  },
  {
    slug: "bit-manipulation",
    name: "Bit Manipulation",
    description: "Think in binary: AND, OR, XOR and shifts.",
    goal: "Use binary representation and XOR tricks to simplify problems.",
    learn: ["Binary representation", "AND, OR, XOR and shifts", "XOR properties", "Using bits as small sets"],
    picks: { easy: 4, medium: 3, hard: 1 },
    tags: ["bit manipulation"],
    words: [[/\bxor\b|⊕|\\oplus/g, 3], [/\bbitwise\b/g, 3], [/\bbinary representation\b/g, 3], [/\bbits?\b/g, 1]],
  },
  {
    slug: "dynamic-programming",
    name: "Dynamic Programming",
    description: "Break a problem into overlapping smaller ones and reuse the answers.",
    goal: "Define a state, write the transition, and fill the table in the right order.",
    learn: ["Recursion with memoisation", "One-dimensional DP", "Two-dimensional DP (grids, two sequences)", "Counting ways and best-value problems"],
    picks: { easy: 5, medium: 5, hard: 3 },
    tags: ["dynamic programming"],
    words: [[/\bnumber of (different |distinct )?ways\b/g, 2], [/\bsubsequences?\b/g, 2], [/\bknapsack\b/g, 4], [/\bminimum (total )?cost\b/g, 1]],
  },
  {
    slug: "graphs",
    name: "Graphs",
    description: "Cities and roads, friends and links: traversal, shortest paths, connectivity.",
    goal: "Model a situation as nodes and edges, then explore it with BFS or DFS.",
    learn: ["Representing a graph", "Breadth-first and depth-first search", "Connected components", "Shortest paths"],
    picks: { easy: 4, medium: 5, hard: 3 },
    tags: ["graph algorithms", "graph traversal", "shortest paths", "spanning trees", "flows and cuts", "strong connectivity"],
    words: [[/\bgraphs?\b/g, 3], [/\b(vertices|vertex)\b/g, 2], [/\bedges?\b/g, 2], [/\bshortest (path|route)\b/g, 3], [/\bconnected\b/g, 1], [/\b(roads?|cities)\b/g, 1], [/\bnodes?\b/g, 1]],
  },
  {
    slug: "trees",
    name: "Trees",
    description: "Rooted trees, subtrees, parents and leaves.",
    goal: "Traverse a tree and combine answers from children into the parent.",
    learn: ["Tree traversal", "Depth, parent and subtree sizes", "Combining results from children", "Paths between two nodes"],
    picks: { easy: 3, medium: 4, hard: 3 },
    tags: ["tree algorithms"],
    words: [[/\btrees?\b/g, 1], [/\b(subtree|rooted|binary tree)\b/g, 3], [/\b(leaf|leaves)\b/g, 1], [/\bancestor\b/g, 3]],
  },
  {
    slug: "games",
    name: "Game Theory",
    description: "Two players, perfect play: who wins?",
    goal: "Reason about winning and losing positions when both players play optimally.",
    learn: ["Winning and losing positions", "Working backwards from the end", "Parity arguments", "Classic games such as Nim"],
    picks: { easy: 3, medium: 3, hard: 2 },
    tags: ["game theory"],
    words: [[/\b(play|plays|playing) optimally\b/g, 4], [/\bboth players\b/g, 3], [/\bwins the game\b|\bwho (will )?wins?\b/g, 2], [/\btake turns\b|\balternat(e|ing) turns\b/g, 2]],
  },
];

const SLUGS = ALBUMS.map(album => album.slug);
const TAG_TO_ALBUM = new Map(ALBUMS.flatMap(album => album.tags.map(tag => [tag, album.slug])));
const MIN_WORD_SCORE = 4; // how strongly the wording must point at an album before we trust it

// Returns { albums: [slug, ...], album: primarySlug }.
// The primary album is the most advanced one a problem belongs to: a problem tagged both
// "implementation" and "dynamic programming" is practised under Dynamic Programming.
function classify({ title, description, tags }) {
  const fromTags = [...new Set((tags || []).map(tag => TAG_TO_ALBUM.get(String(tag).toLowerCase())).filter(Boolean))];
  let albums = fromTags;

  // Only tagged as "basics" (or not tagged at all): let the wording place it more precisely.
  if (!albums.length || albums.every(slug => slug === "basics")) {
    // The title counts three times; very short statements need less evidence.
    const text = `${`${title || ""}\n`.repeat(3)}${description || ""}`.toLowerCase();
    const needed = (description || "").length < 400 ? 2 : MIN_WORD_SCORE;
    const scored = ALBUMS.map(album => ({
      slug: album.slug,
      score: album.words.reduce((sum, [pattern, weight]) => sum + weight * Math.min(3, (text.match(pattern) || []).length), 0),
    })).filter(entry => entry.score >= needed).sort((a, b) => b.score - a.score);
    const byWords = scored.slice(0, 2).map(entry => entry.slug);
    albums = byWords.length ? [...new Set([...byWords, ...albums])] : ["basics"];
    if (byWords.length) return { albums: albums.sort((a, b) => SLUGS.indexOf(a) - SLUGS.indexOf(b)), album: byWords[0] };
  }

  albums.sort((a, b) => SLUGS.indexOf(a) - SLUGS.indexOf(b));
  return { albums, album: albums[albums.length - 1] };
}

// (Re)assign albums. By default only problems that have none yet; `force` redoes all of them.
async function assignAlbums(db, { force = false } = {}) {
  const rows = (await db.query(`SELECT id, title, description, tags FROM problems ${force ? "" : "WHERE album IS NULL"}`)).rows;
  for (const row of rows) {
    const { albums, album } = classify(row);
    await db.query("UPDATE problems SET albums = $1, album = $2 WHERE id = $3", [albums, album, row.id]);
  }
  return rows.length;
}

// SQL fragment for ordering inside an album: easy → hard, then clearer sources and real
// titles before origin codes such as "Codeforces 1539C", then shorter statements first
// (a rough but useful stand-in for "simpler").
const ORDER_IN_ALBUM = `
  CASE difficulty WHEN 'easy' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
  CASE source WHEN 'manual' THEN 0 WHEN 'exercism' THEN 1 ELSE 2 END,
  CASE WHEN title ~ '^(Codeforces|CodeChef|AtCoder) ' THEN 1 ELSE 0 END,
  length(description),
  id`;

if (require.main === module) {
  require("dotenv").config();
  const pool = require("./db");
  assignAlbums(pool, { force: true })
    .then(async count => {
      const summary = await pool.query("SELECT album, count(*)::int AS n FROM problems WHERE status = 'published' GROUP BY 1");
      const counts = Object.fromEntries(summary.rows.map(row => [row.album, row.n]));
      console.log(`📚 Sorted ${count} problems into albums:`);
      for (const album of ALBUMS) console.log(`   ${album.name.padEnd(26)} ${counts[album.slug] || 0}`);
    })
    .catch(err => { console.error("❌ Could not assign albums:", err.message || err.code); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { ALBUMS, SLUGS, classify, assignAlbums, ORDER_IN_ALBUM };
