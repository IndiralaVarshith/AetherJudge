const { addJob } = require("./queueService");

async function handleSubmission(req, res) {
    const { code, language_id } = req.body;

    const job = {
        id: Date.now(),
        code,
        language_id
    };

    await addJob(job);

    res.json({
        message: "Queued successfully",
        jobId: job.id
    });
}

module.exports = { handleSubmission };