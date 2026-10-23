require('dotenv').config();
const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  // ✅ Read from HTTP-only cookie
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET || "dev_secret_change_in_prod", (err, user) => {
    if (err) {
      console.error("❌ JWT Verification Failed:", err.message);
      res.clearCookie("token"); // ✅ Clear invalid cookie
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
}

module.exports = authenticateToken;