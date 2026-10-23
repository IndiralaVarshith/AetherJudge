const Redis = require("ioredis");

const redis = new Redis();

async function test() {
    await redis.set("test", "hello");
    const value = await redis.get("test");
    console.log("Redis working:", value);
    process.exit(0);
}

test();