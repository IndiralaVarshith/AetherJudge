require('dotenv').config();
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const pool = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_in_prod";

// ✅ Cookie options (secure: false for localhost HTTP, change to true for HTTPS later)
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false, // ️ Set to TRUE when you add HTTPS/Nginx SSL
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
};

router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields required" });
    }

    const hashed = await bcrypt.hash(password, 12); // ✅ Increased cost for security
    const result = await pool.query(
      "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email",
      [username, email, hashed]
    );

    const token = jwt.sign({ userId: result.rows[0].id }, JWT_SECRET, { expiresIn: "24h" });
    
    // ✅ Set cookie instead of returning token in body
    res.cookie("token", token, COOKIE_OPTIONS);
    res.json({ message: "Registered", user: result.rows[0] });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    
    if (!user.rows[0] || !(await bcrypt.compare(password, user.rows[0].password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.rows[0].id }, JWT_SECRET, { expiresIn: "24h" });
    
    res.cookie("token", token, COOKIE_OPTIONS);
    res.json({ message: "Logged in", user: { id: user.rows[0].id, username: user.rows[0].username, email: user.rows[0].email } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ✅ Logout endpoint (clears cookie)
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});

module.exports = router;