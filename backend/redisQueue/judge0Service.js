const axios = require("axios");
const { JUDGE0_URL } = require("./config"); // ✅ Load from config

async function submitToJudge0(code, language_id, stdin = "") {
  const response = await axios.post(
    `${JUDGE0_URL}/submissions?base64_encoded=false&wait=false`,
    {
      source_code: code,
      language_id: language_id,
      stdin: stdin, // ✅ Use the passed stdin value
      cpu_time_limit: 5,
      memory_limit: 128000
    }
  );
  return response.data.token;
}

async function getResult(token) {
  while (true) {
    const res = await axios.get(
      `${JUDGE0_URL}/submissions/${token}?base64_encoded=false`
    );
    if (res.data.status.id <= 2) {
      await new Promise(res => setTimeout(res, 1000));
      continue;
    }
    return res.data;
  }
}

module.exports = { submitToJudge0, getResult };