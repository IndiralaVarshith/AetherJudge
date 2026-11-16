import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { AnimatePresence, motion } from 'motion/react';
import { Bookmark, BookmarkCheck, Check, ChevronLeft, ChevronRight, Clock, Copy, Cpu, ExternalLink, FileText, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../lib/useApp.js';
import { load, noteKey, save } from '../lib/storage.js';
import { albumMeta } from '../lib/meta.js';
import { AlbumChip, DifficultyPill } from './ui.jsx';

// Imported statements mix Markdown, LaTeX ($n$, $$...$$) and contest-style headings
// such as "-----Input-----". Normalise the headings so they render as real ones.
function toMarkdown(text = '') {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/^-{3,}\s*([A-Za-z][A-Za-z ]{1,40}?)\s*-{3,}\s*$/gm, '\n### $1\n')
    .replace(/\$\$\$(.+?)\$\$\$/g, '$$$1$$'); // Codeforces uses $$$x$$$ for inline maths
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error('Could not copy. Your browser blocked clipboard access.');
    }
  };
  return (
    <button type="button" className="mini-button" onClick={copy} aria-label={label}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

// Keyed by problem id by the parent, so each problem gets its own fresh notes state.
function Notes({ problemId }) {
  const [text, setText] = useState(() => load(noteKey(problemId), ''));
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    if (saved) return undefined;
    const timer = setTimeout(() => { save(noteKey(problemId), text); setSaved(true); }, 400);
    return () => clearTimeout(timer);
  }, [text, saved, problemId]);
  return (
    <div className="notes">
      <p className="notes-hint">Private scratchpad for this problem. Ideas, edge cases, the trick you'll forget by tomorrow. Saved on this device. {saved ? '✓ saved' : 'saving…'}</p>
      <textarea className="notes-input" value={text} onChange={event => { setText(event.target.value); setSaved(false); }} placeholder={'e.g.\n- sort first, then two pointers\n- watch out: n can be 1\n- O(n log n) is fine for n ≤ 2·10^5'} aria-label="Notes for this problem" />
    </div>
  );
}

export default function ProblemPanel({ problem, loading, error, position, count, onPrev, onNext, albums }) {
  const { isBookmarked, toggleBookmark, solvedIds } = useApp();
  const [tab, setTab] = useState('description');

  if (loading && !problem) return <section className="pane problem-pane"><div className="pane-skeleton"><span className="sk sk-title" /><span className="sk" /><span className="sk" /><span className="sk short" /><span className="sk" /><span className="sk short" /></div></section>;
  if (error) return <section className="pane problem-pane"><div className="pane-pad"><div className="alert" role="alert">{error}</div></div></section>;
  if (!problem) return <section className="pane problem-pane"><div className="empty">Pick a problem from the list to get started ✨</div></section>;

  const examples = (problem.test_cases || []).filter(test => test.is_sample).slice(0, 3);
  const bookmarked = isBookmarked(problem.id);
  const solved = solvedIds.has(Number(problem.id));
  const albumNames = Object.fromEntries((albums || []).map(album => [album.slug, album.name]));

  return (
    <section className="pane problem-pane" aria-label="Problem">
      <div className="pane-tabs">
        <button type="button" className={`pane-tab${tab === 'description' ? ' active' : ''}`} onClick={() => setTab('description')}><FileText size={14} /> Problem</button>
        <button type="button" className={`pane-tab${tab === 'notes' ? ' active' : ''}`} onClick={() => setTab('notes')}><StickyNote size={14} /> Notes</button>
        <span className="pane-tabs-spacer" />
        <span className="pane-position">{position}/{count}</span>
        <button type="button" className="mini-button" onClick={onPrev} disabled={position <= 1} aria-label="Previous problem"><ChevronLeft size={15} /></button>
        <button type="button" className="mini-button" onClick={onNext} disabled={position >= count} aria-label="Next problem"><ChevronRight size={15} /></button>
      </div>

      <div className="pane-scroll">
        <AnimatePresence mode="wait">
          <motion.div key={`${problem.id}-${tab}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="pane-pad">
            {tab === 'notes' ? <Notes key={problem.id} problemId={problem.id} /> : (
              <>
                <div className="problem-head">
                  <h1 className="problem-title">{problem.title}{solved && <span className="solved-badge" title="Solved"><Check size={14} strokeWidth={3} /></span>}</h1>
                  <button type="button" className={`icon-button${bookmarked ? ' on' : ''}`} onClick={() => { toggleBookmark(problem); toast(bookmarked ? 'Removed from bookmarks' : 'Bookmarked 🔖'); }} aria-pressed={bookmarked} aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this problem'}>
                    {bookmarked ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
                  </button>
                </div>
                <div className="problem-meta">
                  <DifficultyPill level={problem.difficulty} />
                  {problem.album && <AlbumChip slug={problem.album} name={albumNames[problem.album] || albumMeta(problem.album).tagline} />}
                  <span className="meta-chip"><Clock size={12} /> {problem.time_limit || 5}s</span>
                  <span className="meta-chip"><Cpu size={12} /> {Math.round((problem.memory_limit || 128000) / 1000)} MB</span>
                  {problem.test_count > 0 && <span className="meta-chip">{problem.test_count} tests</span>}
                </div>
                {(problem.tags || []).filter(tag => tag !== 'exercism').length > 0 && (
                  <div className="tag-row">{problem.tags.filter(tag => tag !== 'exercism').map(tag => <span key={tag} className="tag">#{tag.replaceAll(' ', '-')}</span>)}</div>
                )}

                <article className="markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{toMarkdown(problem.description)}</ReactMarkdown>
                </article>

                {examples.length > 0 && (
                  <section className="examples" aria-label="Examples">
                    <h3 className="examples-title">Examples</h3>
                    {examples.map((test, index) => (
                      <div className="example" key={test.id || index}>
                        <div className="example-col">
                          <div className="example-label">Input {index + 1}<CopyButton text={test.input} label={`Copy input ${index + 1}`} /></div>
                          <pre>{test.input || '(empty)'}</pre>
                        </div>
                        <div className="example-col">
                          <div className="example-label">Output {index + 1}<CopyButton text={test.expected_output} label={`Copy output ${index + 1}`} /></div>
                          <pre>{test.expected_output}</pre>
                        </div>
                      </div>
                    ))}
                  </section>
                )}

                {problem.source_url && (
                  <p className="source-line">Source: <a href={problem.source_url} target="_blank" rel="noreferrer">{new URL(problem.source_url).hostname.replace(/^www\./, '')} <ExternalLink size={11} /></a>{problem.license ? ` · ${problem.license}` : ''}</p>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
