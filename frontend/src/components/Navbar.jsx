import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import Icon from './Icon.jsx';

export default function Navbar() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(current => current === 'dark' ? 'light' : 'dark');

  return (
    <header className="site-header">
      <Link className="brand-lockup" to="/" aria-label="AetherJudge home">
        <span className="brand-mark">A</span>
        <span className="brand-name"><strong>AetherJudge</strong><span>Code with clarity</span></span>
      </Link>
      <nav className="header-nav" aria-label="Main navigation">
        <NavLink className={({ isActive }) => `header-link${isActive ? ' active' : ''}`} to="/app">Workspace</NavLink>
      </nav>
      <div className="header-actions">
        <Link className="header-action" to="/login"><Icon name="user" size={14} /> Sign in</Link>
        <button className="theme-button" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  );
}
