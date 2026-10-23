require('dotenv').config();

module.exports = {
  REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6380",
  QUEUE_NAME: "code_submission_queue",
  JUDGE0_URL: process.env.JUDGE0_URL || "http://localhost:2358",
  MIN_WORKERS: 2,
  MAX_WORKERS: 10
};