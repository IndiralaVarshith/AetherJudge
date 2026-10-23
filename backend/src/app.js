require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { connectRedis } = require("../redisQueue/redisClient");
const submitRoutes = require("./routes/submitRoutes");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/authRoutes");
const problemRoutes = require("./routes/problemRoutes");
const pool = require("./db"); // ✅ Ensure this matches your db.js export

const app = express();

// ✅ Middleware
app.use(cors({
  origin: "http://localhost:5173", // Frontend dev server
  credentials: true // ✅ Allows cookies to be sent cross-origin
}));
app.use(express.json());
app.use(cookieParser()); // ✅ Parses incoming cookies

// ✅ Routes
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api", submitRoutes);
app.use("/api/problems", problemRoutes);

// ✅ Server-Sent Events endpoint for real-time verdict streaming
app.get("/api/submissions/:id/stream", (req, res) => {
  // Critical headers for SSE + Nginx compatibility
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // ✅ Prevents Nginx from buffering SSE
  res.setHeader("Access-Control-Allow-Origin", "*"); // CORS for dev

  const submissionId = req.params.id;
  let interval = null;

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ status: "connected", submissionId, message: "Streaming started" })}\n\n`);

  const pollVerdict = async () => {
    try {
      const result = await pool.query(
        "SELECT status, verdict, passed_tests, total_tests, created_at FROM submissions WHERE id = $1",
        [submissionId]
      );

      if (result.rows[0]) {
        res.write(`data: ${JSON.stringify(result.rows[0])}\n\n`);

        // Stop polling when submission reaches terminal state
        const terminalStatuses = ["completed", "failed", "rejected"];
        if (terminalStatuses.includes(result.rows[0].status)) {
          if (interval) clearInterval(interval);
          res.end();
        }
      }
    } catch (err) {
      console.error("❌ SSE poll error:", err);
      res.write(`data: ${JSON.stringify({ error: "Failed to fetch verdict", details: err.message })}\n\n`);
    }
  };

  // Poll immediately, then every 2 seconds
  pollVerdict();
  interval = setInterval(pollVerdict, 2000);

  // Cleanup on client disconnect
  req.on("close", () => {
    console.log(`🔌 SSE client disconnected: submission ${submissionId}`);
    if (interval) clearInterval(interval);
    res.end();
  });

  // Handle stream errors
  res.on("error", (err) => {
    console.error("❌ SSE stream error:", err);
    if (interval) clearInterval(interval);
    res.end();
  });
});

// ✅ Catch-all for undefined routes (404) - MUST be after all routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ✅ Global Error Handler (MUST be last)
app.use((err, req, res, next) => {
  console.error("❌ Unhandled Error:", err.message);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

async function start() {
  await connectRedis();
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

start();