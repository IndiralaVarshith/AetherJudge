require('dotenv').config(); // ✅ Load env vars
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER || "admin",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "aetherjudge",
  password: process.env.DB_PASSWORD || "admin123",
  port: parseInt(process.env.DB_PORT || 5433, 10),
});

module.exports = pool;