import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { getUser, load, save, setUser } from './storage.js';
import { AppContext } from './useApp.js';

const EMPTY_STATS = {
  xp: 0, streak: 0, longestStreak: 0, submissions: 0, accepted: 0,
  solved: { easy: 0, medium: 0, hard: 0, total: 0 },
  total: { easy: 0, medium: 0, hard: 0, total: 0 },
  solvedIds: [], albums: [], activity: [], recent: [],
};

// App-wide state: who is signed in, their stats (XP, streak, solved problems),
// theme, bookmarks and the command palette.
export function AppProvider({ children }) {
  const [user, setUserState] = useState(getUser);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [statsReady, setStatsReady] = useState(false);
  const [theme, setTheme] = useState(() => load('aj:theme', 'dark'));
  const [bookmarks, setBookmarks] = useState(() => load('aj:bookmarks', []));
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#faf8ff' : '#07060d');
    save('aj:theme', theme);
  }, [theme]);

  useEffect(() => {
    const sync = () => setUserState(getUser());
    window.addEventListener('aj:user', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('aj:user', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // The session cookie is the source of truth. The copy in localStorage only avoids a
  // flash of "signed out" while this check runs; an expired session clears it.
  useEffect(() => {
    api.get('/auth/me')
      .then(response => setUser(response.data.user || null))
      .catch(() => { /* API unreachable: keep the cached state until it's back */ });
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const response = await api.get('/stats');
      setStats(response.data);
      return response.data;
    } catch {
      return null;
    } finally {
      setStatsReady(true);
    }
  }, []);

  // Load stats from the API whenever the signed-in user changes (data fetching, not derived state).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refreshStats(); }, [refreshStats, user]);

  const toggleBookmark = useCallback(problem => {
    setBookmarks(current => {
      const exists = current.some(item => item.id === problem.id);
      const next = exists ? current.filter(item => item.id !== problem.id) : [{ id: problem.id, title: problem.title, difficulty: problem.difficulty }, ...current];
      save('aj:bookmarks', next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    user, stats, statsReady, refreshStats,
    solvedIds: new Set(stats.solvedIds.map(Number)),
    theme, toggleTheme: () => setTheme(current => (current === 'dark' ? 'light' : 'dark')),
    bookmarks, toggleBookmark, isBookmarked: id => bookmarks.some(item => item.id === id),
    paletteOpen, setPaletteOpen,
  }), [user, stats, statsReady, refreshStats, theme, bookmarks, toggleBookmark, paletteOpen]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
