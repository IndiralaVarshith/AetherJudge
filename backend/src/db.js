require('dotenv').config();
const { Pool } = require("pg");

const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  if (!process.env.DB_PASSWORD) {
    throw new Error("FATAL: DB_PASSWORD must be explicitly provided in production!");
  }
  if (!process.env.DB_USER) {
    throw new Error("FATAL: DB_USER must be explicitly provided in production!");
  }
}

const pool = new Pool({
  user: process.env.DB_USER || "admin",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "aetherjudge",
  password: process.env.DB_PASSWORD || (isProduction ? undefined : "admin123"),
  port: parseInt(process.env.DB_PORT || (isProduction ? 5432 : 5433), 10),
});

module.exports = pool;