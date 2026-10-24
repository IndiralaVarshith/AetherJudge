import Icon from './Icon.jsx';

export default function ProblemSidebar({ problems, selectedId, onSelect, solvedIds, loading, search, onSearch }) {
  const filtered = problems.filter(problem => problem.title.toLowerCase().includes(search.toLowerCase()));
  return (
    <aside className="problem-sidebar" aria-label="Problem list">
      <div className="side-heading"><h2 className="section-title">Problems</h2><span className="section-meta">{problems.length} total</span></div>
      <div className="sidebar-search">
        <label className="search-wrap">
          <Icon name="search" size={14} />
          <input className="text-input" type="search" placeholder="Search problems" value={search} onChange={event => onSearch(event.target.value)} aria-label="Search problems" />
        </label>
      </div>
      <div className="problem-list">
        {loading && <div className="empty-state">Loading problems…</div>}
        {!loading && filtered.map(problem => {
          const difficulty = (problem.difficulty || 'easy').toLowerCase();
          const solved = solvedIds.has(Number(problem.id));
          return (
            <button key={problem.id} type="button" className={`problem-item${Number(selectedId) === Number(problem.id) ? ' active' : ''}`} onClick={() => onSelect(problem)} aria-current={Number(selectedId) === Number(problem.id) ? 'page' : undefined}>
              <span className={`problem-status${solved ? ' solved' : ''}`} aria-label={solved ? 'Solved' : 'Not solved'}>{solved && <Icon name="check" size={10} strokeWidth={2.4} />}</span>
              <span className="problem-item-copy"><span className="problem-item-title">{problem.title}</span></span>
              <span className={`difficulty-dot ${difficulty}`} title={difficulty} />
            </button>
          );
        })}
        {!loading && filtered.length === 0 && <div className="empty-state">No problems match “{search}”.</div>}
      </div>
    </aside>
  );
}
