import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Compass, Flame, LayoutGrid, LogOut, Moon, Search, Sun, Trophy, User, Zap, Code } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../lib/useApp.js';
import { levelFor } from '../lib/meta.js';
import { setUser } from '../lib/storage.js';
import { api } from '../api.js';
import { Logo } from './ui.jsx';
import { MOD } from '../lib/keys.js';

const LINKS = [
  { to: '/guide', label: 'Guide me', icon: Compass },
  { to: '/albums', label: 'Albums', icon: LayoutGrid },
  { to: '/app', label: 'Workspace', icon: Code },
  { to: '/leaderboard', label: 'Ranks', icon: Trophy },
];

export default function Navbar() {
  const { user, stats, theme, toggleTheme, setPaletteOpen } = useApp();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const level = levelFor(stats.xp);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = event => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false); };
    const onKey = event => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  const signOut = async () => {
    setMenuOpen(false);
    try { await api.post('/auth/logout'); } catch { /* the local sign-out still counts */ }
    setUser(null);
    toast('Signed out. See you soon 👋');
    navigate('/');
  };

  return (
    <header className="nav">
      <Link className="nav-brand" to="/" aria-label="AetherJudge home">
        <Logo size={30} />
        <span className="nav-brand-name">Aether<b>Judge</b></span>
      </Link>

      <nav className="nav-links" aria-label="Main">
        {LINKS.map(({ to, label, icon: IconComponent }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <IconComponent size={15} strokeWidth={2.2} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="nav-actions">
        <button type="button" className="search-trigger" onClick={() => setPaletteOpen(true)} aria-label="Open command palette">
          <Search size={14} /><span>Search anything</span><kbd className="kbd">{MOD} K</kbd>
        </button>

        <Link to="/profile" className={`streak-chip${stats.streak > 0 ? ' lit' : ''}`} title={stats.streak > 0 ? `${stats.streak}-day streak` : 'Solve a problem today to start a streak'}>
          <Flame size={15} strokeWidth={2.4} /><b>{stats.streak}</b>
        </Link>
        <Link to="/profile" className="xp-chip" title={`Level ${level.level} · ${level.title}`}>
          <Zap size={14} strokeWidth={2.4} /><b>{stats.xp}</b><span>XP</span>
        </Link>

        <button type="button" className="icon-button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }} style={{ display: 'grid' }}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </motion.span>
          </AnimatePresence>
        </button>

        {user ? (
          <div className="user-menu" ref={menuRef}>
            <button type="button" className="avatar-button" onClick={() => setMenuOpen(open => !open)} aria-expanded={menuOpen} aria-haspopup="menu" aria-label="Account menu">
              <span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span>
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div className="menu" role="menu" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.15 }}>
                  <div className="menu-head"><b>@{user.username}</b><span>Lv {level.level} · {level.title}</span></div>
                  <Link role="menuitem" className="menu-item" to="/profile" onClick={() => setMenuOpen(false)}><User size={15} /> Profile</Link>
                  <button role="menuitem" type="button" className="menu-item" onClick={signOut}><LogOut size={15} /> Sign out</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <Link className="btn btn-primary btn-sm" to="/login">Join free</Link>
        )}
      </div>
    </header>
  );
}
