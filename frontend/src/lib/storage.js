// Small, crash-proof wrappers around localStorage. Private windows and blocked storage
// throw on access, so every read and write is guarded and falls back to a default.

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the feature just won't persist */
  }
}

export function remove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// The signed-in user (or null for the guest account).
export function getUser() {
  try {
    const id = Number(localStorage.getItem('userId'));
    if (!id) return null;
    return { id, username: localStorage.getItem('username') || 'coder' };
  } catch {
    return null;
  }
}

export function setUser(user) {
  try {
    if (user) {
      localStorage.setItem('userId', String(user.id));
      localStorage.setItem('username', user.username || '');
    } else {
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
    }
  } catch { /* ignore */ }
  window.dispatchEvent(new Event('aj:user'));
}

export const draftKey = (problemId, language) => `aj:draft:${problemId}:${language}`;
export const noteKey = problemId => `aj:note:${problemId}`;
