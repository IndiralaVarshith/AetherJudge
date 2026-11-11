require('dotenv').config();

module.exports = {
  REDIS_URL: process.env.REDIS_URL,
  QUEUE_NAME: "code_submission_queue",
  JUDGE0_URL: process.env.JUDGE0_URL,
  MIN_WORKERS: 2,
  MAX_WORKERS: 10
};