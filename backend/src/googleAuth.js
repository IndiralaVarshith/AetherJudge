// "Continue with Google" sign-in.
//
// The browser gets a signed ID token from Google (Google Identity Services) and posts it
// to POST /api/auth/google. We verify it with Google's official library: the signature,
// that it was issued for OUR client id, that it hasn't expired, and that Google has
// verified the email. Only then do we trust who the person is.
require("dotenv").config();
const { OAuth2Client } = require("google-auth-library");
const pool = require("./db");

const clientId = () => process.env.GOOGLE_CLIENT_ID || "";
let client = null;
const getClient = () => (client ||= new OAuth2Client(clientId()));

const isConfigured = () => Boolean(clientId());

// Returns { googleId, email, name } or throws.
async function verifyGoogleToken(idToken) {
  const ticket = await getClient().verifyIdToken({ idToken, audience: clientId() });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new Error("Google token has no account id or email");
  if (!payload.email_verified) throw new Error("Google has not verified this email");
  return { googleId: payload.sub, email: payload.email.toLowerCase(), name: payload.given_name || payload.name || "" };
}

// A free username based on the person's name or email, e.g. "ana_smith" or "ana_smith2".
async function freeUsername(db, { name, email }) {
  const fromName = String(name).normalize("NFKD").replace(/[^A-Za-z0-9_]/g, "");
  const fromEmail = email.split("@")[0].replace(/[^A-Za-z0-9_]/g, "_");
  let base = (fromName.length >= 3 ? fromName : fromEmail).slice(0, 16).toLowerCase();
  if (base.length < 3) base = `coder${base}`;
  const taken = new Set((await db.query(
    "SELECT lower(username) AS u FROM users WHERE lower(username) = $1 OR lower(username) LIKE $2",
    [base, `${base}%`]
  )).rows.map(row => row.u));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 10000; n++) if (!taken.has(`${base}${n}`)) return `${base}${n}`;
  return `${base.slice(0, 10)}${Date.now().toString(36).slice(-6)}`;
}

// Sign in an existing Google user, link Google to an existing email account, or create
// a new account. Returns { user, created }.
async function findOrCreateGoogleUser(profile, db = pool) {
  const fields = "id, username, email, created_at";
  const byGoogle = await db.query(`SELECT ${fields} FROM users WHERE google_id = $1`, [profile.googleId]);
  if (byGoogle.rows[0]) return { user: byGoogle.rows[0], created: false };

  // Same verified email as a password account: link them, so it's one account either way.
  const byEmail = await db.query(
    `UPDATE users SET google_id = $1 WHERE lower(email) = $2 AND google_id IS NULL RETURNING ${fields}`,
    [profile.googleId, profile.email]
  );
  if (byEmail.rows[0]) return { user: byEmail.rows[0], created: false };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const username = await freeUsername(db, profile);
      const created = await db.query(
        `INSERT INTO users (username, email, password, google_id) VALUES ($1, $2, NULL, $3) RETURNING ${fields}`,
        [username, profile.email, profile.googleId]
      );
      return { user: created.rows[0], created: true };
    } catch (err) {
      if (err.code !== "23505") throw err; // someone took the name a moment ago: try again
    }
  }
  throw new Error("Could not create an account for this Google user");
}

module.exports = { isConfigured, clientId, verifyGoogleToken, findOrCreateGoogleUser, freeUsername };
