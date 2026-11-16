import { useMemo, useState } from 'react';
import { Bookmark, Check, Dices, Search } from 'lucide-react';
import { useApp } from '../lib/useApp.js';
import { albumMeta } from '../lib/meta.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'todo', label: 'To do' },
  { id: 'solved', label: 'Solved' },
  { id: 'saved', label: 'Saved' },
];

// Problems arrive already in learning order (album by album, easy → hard).
export default function ProblemSidebar({ problems, albums, album, onAlbumChange, selectedId, onSelect, onRandom, loading }) {
  const { solvedIds, isBookmarked } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [difficulty, setDifficulty] = useState('');

  const albumNames = Object.fromEntries(albums.map(item => [item.slug, item.name]));
  const current = albums.find(item => item.slug === album);
  const solvedHere = problems.filter(problem => solvedIds.has(Number(problem.id))).length;

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return problems
      .map((problem, index) => ({ ...problem, position: index + 1 }))
      .filter(problem => !query || problem.title.toLowerCase().includes(query))
      .filter(problem => !difficulty || problem.difficulty === difficulty)
      .filter(problem => filter === 'all'
        || (filter === 'solved' && solvedIds.has(Number(problem.id)))
        || (filter === 'todo' && !solvedIds.has(Number(problem.id)))
        || (filter === 'saved' && isBookmarked(problem.id)));
  }, [problems, search, difficulty, filter, solvedIds, isBookmarked]);

  const grouped = !album && !search && filter === 'all' && !difficulty;
  const progress = problems.length ? solvedHere / problems.length : 0;

  return (
    <aside className="pane sidebar" aria-label="Problem list">
      <div className="sidebar-top">
        <div className="sidebar-title-row">
          <h2 className="sidebar-title">{current ? <><span aria-hidden="true">{albumMeta(current.slug).emoji}</span> {current.name}</> : 'All problems'}</h2>
          <button type="button" className="mini-button" onClick={onRandom} title="Random unsolved problem" aria-label="Random unsolved problem"><Dices size={15} /></button>
        </div>
        <div className="sidebar-progress" aria-label={`${solvedHere} of ${problems.length} solved`}>
          <span className="bar"><i style={{ width: `${progress * 100}%` }} /></span>
          <span className="sidebar-progress-text">{solvedHere}/{problems.length}</span>
        </div>
        <select className="field select" value={album} onChange={event => onAlbumChange(event.target.value)} aria-label="Album">
          <option value="">🌈 All albums, in order</option>
          {albums.map(item => <option key={item.slug} value={item.slug}>{albumMeta(item.slug).emoji} {item.position}. {item.name} ({item.total})</option>)}
        </select>
        <label className="field-search">
          <Search size={14} />
          <input className="field" type="search" placeholder="Search problems" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search problems" />
        </label>
        <div className="segmented" role="tablist" aria-label="Filter">
          {FILTERS.map(item => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}
        </div>
        <div className="diff-filter" role="group" aria-label="Difficulty">
          {['easy', 'medium', 'hard'].map(level => (
            <button key={level} type="button" className={`diff-toggle ${level}${difficulty === level ? ' active' : ''}`} aria-pressed={difficulty === level} onClick={() => setDifficulty(current => (current === level ? '' : level))}>{level}</button>
          ))}
        </div>
      </div>

      <div className="problem-list">
        {loading && Array.from({ length: 10 }, (_, index) => <div key={index} className="row-skeleton"><span className="sk" /></div>)}
        {!loading && visible.map((problem, index) => {
          const solved = solvedIds.has(Number(problem.id));
          const active = Number(selectedId) === Number(problem.id);
          const heading = grouped && problem.album !== visible[index - 1]?.album;
          return (
            <div key={problem.id}>
              {heading && <div className="list-heading"><span aria-hidden="true">{albumMeta(problem.album).emoji}</span> {albumNames[problem.album] || 'Other'}</div>}
              <button type="button" className={`problem-row${active ? ' active' : ''}${solved ? ' solved' : ''}`} onClick={() => onSelect(problem)} aria-current={active ? 'true' : undefined}>
                <span className="row-num">{problem.position}</span>
                <span className="row-title">{problem.title}</span>
                {isBookmarked(problem.id) && <Bookmark size={12} className="row-saved" aria-label="Bookmarked" />}
                {solved ? <span className="row-check" aria-label="Solved"><Check size={11} strokeWidth={3} /></span> : <span className={`dot dot-${problem.difficulty}`} title={problem.difficulty} />}
              </button>
            </div>
          );
        })}
        {!loading && visible.length === 0 && <div className="empty small">Nothing here yet. Try another filter 👀</div>}
      </div>
    </aside>
  );
}
