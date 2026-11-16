require('dotenv').config();
const jwt = require("jsonwebtoken");

const isProduction = process.env.NODE_ENV === "production";
const SESSION_DAYS = 7;

// The signing secret. Production refuses to run without a real one.
function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (isProduction) throw new Error("FATAL: JWT_SECRET must be set in production");
  return "dev_secret_change_in_prod";
}

// Session cookie settings.
// Locally the site and API share "localhost", so a plain SameSite=Lax cookie works over HTTP.
// In production the frontend (e.g. Vercel) and the API usually live on different sites, which
// requires SameSite=None + Secure, and therefore HTTPS on the API. Override with
// COOKIE_SAMESITE / COOKIE_SECURE if your setup differs.
function cookieOptions() {
  const sameSite = process.env.COOKIE_SAMESITE || (isProduction ? "none" : "lax");
  const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : isProduction;
  return { httpOnly: true, secure, sameSite, path: "/", maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 };
}

function signSession(user) {
  return jwt.sign({ userId: user.id }, getSecret(), { expiresIn: `${SESSION_DAYS}d` });
}

function readToken(req) {
  const header = req.headers.authorization;
  const bearer = header && header.startsWith("Bearer ") ? header.slice(7) : null;
  return req.cookies?.token || bearer;
}

// Who is making this request: { id } for a valid session, or null for a guest.
function sessionUser(req) {
  const token = readToken(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getSecret());
    return Number.isInteger(payload.userId) ? { id: payload.userId } : null;
  } catch {
    return null; // expired or tampered: treat as signed out
  }
}

// Sets req.user (or null) and always continues. For pages guests may also use.
function optionalAuth(req, res, next) {
  req.user = sessionUser(req);
  next();
}

// Only signed-in users get through.
function requireAuth(req, res, next) {
  req.user = sessionUser(req);
  if (!req.user) return res.status(401).json({ error: "Please sign in" });
  next();
}

module.exports = { optionalAuth, requireAuth, signSession, cookieOptions, sessionUser };
