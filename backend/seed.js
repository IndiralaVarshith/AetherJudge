const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const problems = [
  // EASY PROBLEMS
  {
    title: "Two Sum",
    description: "Given an array of integers and a target sum, return indices of the two numbers that add to target.",
    difficulty: "easy",
    time_limit: 5,
    memory_limit: 128000,
    test_cases: [
      { input: "2 7\n9", expected_output: "0 1", is_sample: true },
      { input: "3 3\n6", expected_output: "0 1", is_sample: false },
      { input: "1 5\n6", expected_output: "0 1", is_sample: false }
    ]
  },
  {
    title: "Fibonacci Number",
    description: "Given n, compute the nth Fibonacci number (0-indexed: F(0)=0, F(1)=1).",
    difficulty: "easy",
    time_limit: 5,
    memory_limit: 128000,
    test_cases: [
      { input: "5", expected_output: "5", is_sample: true },
      { input: "10", expected_output: "55", is_sample: false },
      { input: "0", expected_output: "0", is_sample: false }
    ]
  },
  {
    title: "Reverse String",
    description: "Given a string, print it in reverse order.",
    difficulty: "easy",
    time_limit: 5,
    memory_limit: 128000,
    test_cases: [
      { input: "hello", expected_output: "olleh", is_sample: true },
      { input: "aether", expected_output: "rehtea", is_sample: false },
      { input: "12345", expected_output: "54321", is_sample: false }
    ]
  },
  {
    title: "Palindrome Check",
    description: "Given a string, print 'yes' if it is a palindrome, otherwise 'no'.",
    difficulty: "easy",
    time_limit: 5,
    memory_limit: 128000,
    test_cases: [
      { input: "madam", expected_output: "yes", is_sample: true },
      { input: "hello", expected_output: "no", is_sample: false },
      { input: "racecar", expected_output: "yes", is_sample: false }
    ]
  },
  {
    title: "Factorial",
    description: "Given a non-negative integer n, print n! (factorial of n).",
    difficulty: "easy",
    time_limit: 5,
    memory_limit: 128000,
    test_cases: [
      { input: "5", expected_output: "120", is_sample: true },
      { input: "0", expected_output: "1", is_sample: false },
      { input: "10", expected_output: "3628800", is_sample: false }
    ]
  },
  
  // MEDIUM PROBLEMS
  {
    title: "Prime Check",
    description: "Given a positive integer n, print 'yes' if it is prime, otherwise 'no'.",
    difficulty: "medium",
    time_limit: 5,
    memory_limit: 128000,
    test_cases: [
      { input: "7", expected_output: "yes", is_sample: true },
      { input: "15", expected_output: "no", is_sample: false },
      { input: "2", expected_output: "yes", is_sample: false }
    ]
  },
  {
    title: "Array Maximum",
    description: "Given n space-separated integers, print the maximum value.",
    difficulty: "easy",
    time_limit: 5,
    memory_limit: 128000,
    test_cases: [
      { input: "5\n1 4 2 8 3", expected_output: "8", is_sample: true },
      { input: "3\n-5 -2 -9", expected_output: "-2", is_sample: false },
      { input: "1\n42", expected_output: "42", is_sample: false }
    ]
  },
  {
    title: "Binary Search",
    description: "Given a sorted array and a target value, print the index of the target if found, otherwise -1.",
    difficulty: "medium",
    time_limit: 5,
    memory_limit: 128000,
    test_cases: [
      { input: "1 3 5 7 9\n5", expected_output: "2", is_sample: true },
      { input: "1 3 5 7 9\n4", expected_output: "-1", is_sample: false },
      { input: "2 4 6 8 10\n10", expected_output: "4", is_sample: false }
    ]
  }
];

async function seed() {
  console.log("🌱 Seeding database with problems...");
  try {
    for (const prob of problems) {
      const existing = await pool.query("SELECT id FROM problems WHERE title = $1", [prob.title]);
      let problemId;
      
      if (existing.rows.length > 0) {
        problemId = existing.rows[0].id;
        console.log(`⚠️  Exists: ${prob.title}`);
      } else {
        const insert = await pool.query(
          "INSERT INTO problems (title, description, difficulty, time_limit, memory_limit) VALUES ($1,$2,$3,$4,$5) RETURNING id",
          [prob.title, prob.description, prob.difficulty, prob.time_limit, prob.memory_limit]
        );
        problemId = insert.rows[0].id;
        console.log(`✅ Created: ${prob.title}`);
      }

      for (const tc of prob.test_cases) {
        const tcExists = await pool.query(
          "SELECT id FROM test_cases WHERE problem_id = $1 AND input = $2",
          [problemId, tc.input]
        );
        
        if (tcExists.rows.length === 0) {
          await pool.query(
            "INSERT INTO test_cases (problem_id, input, expected_output, is_sample) VALUES ($1,$2,$3,$4)",
            [problemId, tc.input, tc.expected_output, tc.is_sample]
          );
        }
      }
      console.log(`   ↳ Seeded ${prob.test_cases.length} test cases`);
    }
    console.log("🎉 Seeding complete!");
  } catch (err) {
    console.error("❌ Seeding failed:", err);
  } finally {
    await pool.end();
  }
}

seed();