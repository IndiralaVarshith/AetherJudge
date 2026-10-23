const { client } = require("./redisClient");
const { QUEUE_NAME } = require("./config");

async function addJob(job) {
    console.log("🔥 addJob called with:", job);
    const jobKey = `job:${job.id}`;

    //Store job with initial status
    await client.hSet(jobKey, {
        status: "pending",
        code: job.code,
        language_id: job.language_id
    });

    //Push to queue (keep your existing logic)
    await client.rPush(QUEUE_NAME, JSON.stringify(job));

    console.log("📥 Job stored + queued:", job.id);
}

async function getJob() {
    const result = await client.brPop(QUEUE_NAME, 0); // 0 = wait forever

    if (!result) return null;

    const jobData = result.element; // important
    return JSON.parse(jobData);
}

module.exports = { addJob, getJob };