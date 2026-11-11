require('dotenv').config();
const jwt = require("jsonwebtoken");

const isProduction = process.env.NODE_ENV === "production";

function authenticateToken(req, res, next) {
  // Read from HTTP-only cookie or Authorization header
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  const token = req.cookies?.token || bearerToken;
  
  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    if (isProduction) {
      console.error("FATAL: JWT_SECRET environment variable is missing in production!");
      return res.status(500).json({ error: "Internal authentication configuration error" });
    }
  }

  const secretToUse = jwtSecret || "dev_secret_change_in_prod";

  jwt.verify(token, secretToUse, (err, user) => {
    if (err) {
      console.error("❌ JWT Verification Failed:", err.message);
      if (res.clearCookie) res.clearCookie("token");
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
}

module.exports = authenticateToken;