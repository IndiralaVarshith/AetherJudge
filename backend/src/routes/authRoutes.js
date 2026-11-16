require('dotenv').config();
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const pool = require("../db");
const { optionalAuth, signSession, cookieOptions } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");
const { isConfigured, clientId, verifyGoogleToken, findOrCreateGoogleUser } = require("../googleAuth");

const USERNAME = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PUBLIC_FIELDS = "id, username, email, created_at";

// Slow down password guessing and mass sign-ups.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  key: req => `${req.ip}|${String(req.body?.email || "").toLowerCase()}`,
  message: "Too many sign-in attempts. Wait 15 minutes and try again.",
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 10, key: req => req.ip,
  message: "Too many accounts created from this network. Try again later.",
});

function validate({ username, email, password }) {
  if (!USERNAME.test(username || "")) return "Username must be 3–20 characters: letters, numbers or _.";
  if (!EMAIL.test(email || "") || email.length > 254) return "Enter a valid email address.";
  if (typeof password !== "string" || password.length < 8) return "Password must be at least 8 characters.";
  if (Buffer.byteLength(password) > 72) return "Password must be at most 72 characters."; // bcrypt ignores the rest
  return null;
}

function startSession(res, user) {
  res.cookie("token", signSession(user), cookieOptions());
}

router.post("/register", registerLimiter, async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = req.body.password;
    const problem = validate({ username, email, password });
    if (problem) return res.status(400).json({ error: problem });

    // Usernames are unique regardless of letter case.
    const taken = await pool.query(
      "SELECT lower(username) = lower($1) AS name_taken, lower(email) = $2 AS email_taken FROM users WHERE lower(username) = lower($1) OR lower(email) = $2",
      [username, email]
    );
    if (taken.rows.some(row => row.email_taken)) return res.status(409).json({ error: "An account with this email already exists. Sign in instead." });
    if (taken.rows.some(row => row.name_taken)) return res.status(409).json({ error: "That username is taken. Try another." });

    const hashed = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING ${PUBLIC_FIELDS}`,
      [username, email, hashed]
    );
    startSession(res, result.rows[0]);
    res.status(201).json({ message: "Registered", user: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That username or email is already taken." });
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const result = await pool.query("SELECT id, username, email, password, created_at FROM users WHERE lower(email) = $1", [email]);
    const user = result.rows[0];

    // Same message for "no such email", "wrong password" and "Google-only account" (no
    // password set), so emails can't be probed.
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: `Wrong email or password.${isConfigured() ? " If you joined with Google, use Continue with Google." : ""}` });
    }
    startSession(res, user);
    res.json({ message: "Logged in", user: { id: user.id, username: user.username, email: user.email, created_at: user.created_at } });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Sign in failed. Please try again." });
  }
});

// GET /api/auth/config → public sign-in settings for the frontend. The Google client id is
// public by design (it appears in every page that shows the Google button).
router.get("/config", (req, res) => {
  res.json({ googleClientId: isConfigured() ? clientId() : null });
});

const googleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30, key: req => req.ip,
  message: "Too many sign-in attempts. Wait 15 minutes and try again.",
});

// POST /api/auth/google { credential } → sign in (or sign up) with a Google ID token.
router.post("/google", googleLimiter, async (req, res) => {
  if (!isConfigured()) return res.status(503).json({ error: "Google sign-in is not set up on this server." });
  const credential = String(req.body?.credential || "");
  if (!credential) return res.status(400).json({ error: "Missing Google credential." });

  let profile;
  try {
    profile = await verifyGoogleToken(credential);
  } catch (err) {
    console.warn("Google token rejected:", err.message);
    return res.status(401).json({ error: "Google sign-in failed. Please try again." });
  }

  try {
    const { user, created } = await findOrCreateGoogleUser(profile);
    startSession(res, user);
    res.status(created ? 201 : 200).json({ message: created ? "Registered" : "Logged in", created, user });
  } catch (err) {
    console.error("Google sign-in error:", err.message);
    res.status(500).json({ error: "Sign in failed. Please try again." });
  }
});

// GET /api/auth/me → { user } for the signed-in user, or { user: null } for guests.
// Called on every page load, so "nobody signed in" is a normal answer, not an error.
router.get("/me", optionalAuth, async (req, res) => {
  try {
    if (!req.user) return res.json({ user: null });
    const result = await pool.query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [req.user.id]);
    if (!result.rows[0]) {
      res.clearCookie("token", { ...cookieOptions(), maxAge: undefined });
      return res.json({ user: null }); // account deleted since the cookie was issued
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("Me error:", err.message);
    res.status(500).json({ error: "Could not load your account" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", { ...cookieOptions(), maxAge: undefined });
  res.json({ message: "Logged out" });
});

module.exports = router;
