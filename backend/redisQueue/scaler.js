

require('dotenv').config();
const { fork } = require("child_process");
const { client, connectRedis } = require("./redisClient");
const { QUEUE_NAME, MIN_WORKERS, MAX_WORKERS } = require("./config");

let workers = [];

function spawnWorker() {
    const worker = fork("./worker.js");
    workers.push(worker);
}

function killWorker() {
    const worker = workers.pop();
    if (worker) worker.kill();
}

async function monitorQueue() {
    await connectRedis();

    console.log("Scaler started...");

    // start with minimum workers
    for (let i = 0; i < MIN_WORKERS; i++) {
        spawnWorker();
    }

    setInterval(async () => {
        const queueLength = await client.lLen(QUEUE_NAME);

        console.log("Queue length:", queueLength, "| Workers:", workers.length);

        // scale up
        if (queueLength > workers.length * 5 && workers.length < MAX_WORKERS) {
            console.log("Scaling UP...");
            spawnWorker();
        }

        // scale down
        if (queueLength < workers.length && workers.length > MIN_WORKERS) {
            console.log("Scaling DOWN...");
            killWorker();
        }

    }, 3000);
}

monitorQueue();