require('dotenv').config();
const pool = require('./src/db'); // Adjust path if needed

async function test() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log("✅ Database connected successfully:", res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  }
}
test();