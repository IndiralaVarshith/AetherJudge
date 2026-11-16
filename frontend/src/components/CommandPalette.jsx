import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { AnimatePresence, motion } from 'motion/react';
import { Bookmark, Calendar, Compass, Dices, LayoutGrid, Moon, Code, Trophy, User, LogIn } from 'lucide-react';
import { useApp } from '../lib/useApp.js';
import { albumMeta } from '../lib/meta.js';
import { api } from '../api.js';
import { MOD } from '../lib/keys.js';

let problemCache = null;
let albumCache = null;

// ⌘K / Ctrl+K: jump to any problem, album or page, or run a quick action.
export default function CommandPalette() {
  const { paletteOpen: open, setPaletteOpen: setOpen, toggleTheme, bookmarks, solvedIds } = useApp();
  const navigate = useNavigate();
  const [problems, setProblems] = useState(problemCache || []);
  const [albums, setAlbums] = useState(albumCache || []);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const onKey = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(current => !current);
      } else if (event.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  // Fetch the lists the first time the palette opens; later opens reuse the cache.
  useEffect(() => {
    if (!open) return;
    if (!problemCache) api.get('/problems').then(response => { problemCache = response.data; setProblems(response.data); }).catch(() => {});
    if (!albumCache) api.get('/albums').then(response => { albumCache = response.data; setAlbums(response.data); }).catch(() => {});
  }, [open]);

  const close = () => { setOpen(false); setSearch(''); };
  const go = path => { close(); navigate(path); };
  const random = () => {
    const pool = problems.filter(problem => !solvedIds.has(Number(problem.id)));
    const pick = (pool.length ? pool : problems)[Math.floor(Math.random() * (pool.length || problems.length))];
    if (pick) go(`/app?problem=${pick.id}`);
  };
  const daily = async () => {
    try { const { data } = await api.get('/daily'); go(`/app?problem=${data.id}`); } catch { go('/app'); }
  };

  // Only render the 40 best title matches while typing, so 1,000+ problems stay snappy.
  const query = search.trim().toLowerCase();
  const shownProblems = query ? problems.filter(problem => problem.title.toLowerCase().includes(query)).slice(0, 40) : [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="palette-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={close}>
          <motion.div className="palette" initial={{ opacity: 0, y: -14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.98 }} transition={{ duration: 0.16 }} onMouseDown={event => event.stopPropagation()}>
            <Command label="Command palette" loop>
              <Command.Input autoFocus value={search} onValueChange={setSearch} placeholder="Search problems, albums, pages…" className="palette-input" />
              <Command.List className="palette-list">
                <Command.Empty className="palette-empty">Nothing found. Try another word ✨</Command.Empty>

                {shownProblems.length > 0 && (
                  <Command.Group heading="Problems">
                    {shownProblems.map(problem => (
                      <Command.Item key={problem.id} value={`problem ${problem.id} ${problem.title}`} onSelect={() => go(`/app?problem=${problem.id}`)} className="palette-item">
                        <span className={`dot dot-${problem.difficulty}`} />
                        <span className="palette-title">{problem.title}</span>
                        <span className="palette-meta">{albumMeta(problem.album).emoji} {solvedIds.has(Number(problem.id)) ? '✓ solved' : problem.difficulty}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                <Command.Group heading="Quick actions">
                  <Command.Item value="random surprise problem" onSelect={random} className="palette-item"><Dices size={16} /> Surprise me with a random problem</Command.Item>
                  <Command.Item value="daily problem of the day" onSelect={daily} className="palette-item"><Calendar size={16} /> Today's daily problem</Command.Item>
                  <Command.Item value="toggle theme dark light mode" onSelect={() => { toggleTheme(); close(); }} className="palette-item"><Moon size={16} /> Toggle dark / light</Command.Item>
                </Command.Group>

                <Command.Group heading="Pages">
                  <Command.Item value="guide me roadmap path" onSelect={() => go('/guide')} className="palette-item"><Compass size={16} /> Guide me</Command.Item>
                  <Command.Item value="albums topics" onSelect={() => go('/albums')} className="palette-item"><LayoutGrid size={16} /> Albums</Command.Item>
                  <Command.Item value="workspace editor code" onSelect={() => go('/app')} className="palette-item"><Code size={16} /> Workspace</Command.Item>
                  <Command.Item value="leaderboard ranks" onSelect={() => go('/leaderboard')} className="palette-item"><Trophy size={16} /> Leaderboard</Command.Item>
                  <Command.Item value="profile stats streak" onSelect={() => go('/profile')} className="palette-item"><User size={16} /> My profile</Command.Item>
                  <Command.Item value="sign in login join register" onSelect={() => go('/login')} className="palette-item"><LogIn size={16} /> Sign in / Join</Command.Item>
                </Command.Group>

                {bookmarks.length > 0 && (
                  <Command.Group heading="Bookmarks">
                    {bookmarks.slice(0, 8).map(item => (
                      <Command.Item key={item.id} value={`bookmark ${item.title}`} onSelect={() => go(`/app?problem=${item.id}`)} className="palette-item"><Bookmark size={16} /> {item.title}</Command.Item>
                    ))}
                  </Command.Group>
                )}

                {albums.length > 0 && (
                  <Command.Group heading="Albums">
                    {albums.map(album => (
                      <Command.Item key={album.slug} value={`album ${album.name}`} onSelect={() => go(`/app?album=${album.slug}`)} className="palette-item">
                        <span aria-hidden="true">{albumMeta(album.slug).emoji}</span> {album.name}<span className="palette-meta">{album.total}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
              <div className="palette-foot"><span><kbd className="kbd">↑↓</kbd> move</span><span><kbd className="kbd">↵</kbd> open</span><span><kbd className="kbd">esc</kbd> close</span><span className="palette-foot-right"><kbd className="kbd">{MOD} K</kbd> anywhere</span></div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
