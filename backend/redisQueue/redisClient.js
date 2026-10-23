const { createClient } = require("redis");
const { REDIS_URL } = require("./config");

const client = createClient({
    url: REDIS_URL
});

client.on("error", (err) => console.log("Redis Error:", err));

async function connectRedis() {
    await client.connect();
    console.log("Redis connected");
}

module.exports = { client, connectRedis };