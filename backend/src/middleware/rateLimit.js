// Small in-memory rate limiter (no extra dependency). Good enough for a single API
// process; behind several API instances, move the counters to Redis.
function rateLimit({ windowMs, max, key, message }) {
  const hits = new Map();
  // Forget old entries so the map can't grow without bound.
  setInterval(() => {
    const now = Date.now();
    for (const [k, entry] of hits) if (entry.reset <= now) hits.delete(k);
  }, windowMs).unref();

  return (req, res, next) => {
    const id = key(req);
    const now = Date.now();
    let entry = hits.get(id);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(id, entry);
    }
    entry.count++;
    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.reset - now) / 1000));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

module.exports = { rateLimit };
