import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Calendar, Command, Compass, Flame, Gauge, Keyboard, LayoutGrid, Sparkles, Target, Trophy, Zap } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../lib/useApp.js';
import { albumMeta } from '../lib/meta.js';
import { Aurora, CountUp, DifficultyPill, Reveal } from '../components/ui.jsx';
import { MOD } from '../lib/keys.js';

const ROTATING = ['arrays', 'strings', 'graphs', 'DP', 'greedy', 'trees', 'bits'];

const CODE_LINES = [
  ['kw', 'def '], ['fn', 'two_sum'], ['p', '(nums, target):'], ['nl'],
  ['p', '    seen = {}'], ['nl'],
  ['kw', '    for '], ['p', 'i, x '], ['kw', 'in '], ['fn', 'enumerate'], ['p', '(nums):'], ['nl'],
  ['kw', '        if '], ['p', 'target - x '], ['kw', 'in '], ['p', 'seen:'], ['nl'],
  ['kw', '            return '], ['p', '[seen[target - x], i]'], ['nl'],
  ['p', '        seen[x] = i'],
];

// Types out a tiny solution, then flashes an "Accepted" sticker. Loops.
function TypingCode() {
  const total = CODE_LINES.reduce((sum, [kind, text]) => sum + (kind === 'nl' ? 1 : text.length), 0);
  const [reduced] = useState(() => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));
  const [shown, setShown] = useState(() => (reduced ? total : 0));
  useEffect(() => {
    if (reduced) return undefined; // show the finished code, no typing loop
    const timer = setInterval(() => setShown(current => (current >= total + 40 ? 0 : current + 1)), 38);
    return () => clearInterval(timer);
  }, [total, reduced]);

  let budget = shown;
  const parts = [];
  CODE_LINES.forEach(([kind, text], index) => {
    if (budget <= 0) return;
    if (kind === 'nl') { parts.push(<br key={index} />); budget -= 1; return; }
    const slice = text.slice(0, budget);
    budget -= slice.length;
    parts.push(<span key={index} className={`tok-${kind}`}>{slice}</span>);
  });
  const done = shown >= total;

  return (
    <div className="code-card">
      <div className="code-card-bar"><span className="traffic"><i /><i /><i /></span><span>two_sum.py</span><span className="code-card-lang">Python</span></div>
      <pre className="code-card-body">{parts}{!done && <span className="caret" />}</pre>
      <AnimatePresence>
        {done && (
          <motion.div className="sticker sticker-accepted" initial={{ scale: 0.4, rotate: -18, opacity: 0 }} animate={{ scale: 1, rotate: -6, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 16 }}>
            ✓ ACCEPTED <b>+10 XP</b>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RotatingWord() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex(current => (current + 1) % ROTATING.length), 1800);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className="rotator" aria-live="off">
      <AnimatePresence mode="wait">
        <motion.span key={ROTATING[index]} className="rotator-word" initial={{ y: '70%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '-70%', opacity: 0 }} transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}>
          {ROTATING[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const FEATURES = [
  { icon: Compass, title: 'Guide me', body: 'A 132-step path from "print hello" to graphs and DP. No more "what do I solve next?"', to: '/guide', span: 'wide', tone: 'violet' },
  { icon: Flame, title: 'Streaks & XP', body: 'Easy +10, medium +25, hard +50. Keep the flame alive daily.', to: '/profile', tone: 'orange' },
  { icon: LayoutGrid, title: '12 albums', body: 'Arrays, strings, DP, graphs… one vibe at a time.', to: '/albums', tone: 'pink' },
  { icon: Zap, title: 'Live verdicts', body: 'Watch tests pass in real time. Confetti on every W.', to: '/app', tone: 'lime' },
  { icon: Command, title: `${MOD} K everything`, body: 'Jump to any problem, album or page from the keyboard.', tone: 'cyan' },
  { icon: Target, title: 'Zen mode & timer', body: 'Hide everything except you and the code. Race the clock if you dare.', to: '/app', span: 'wide', tone: 'violet' },
];

export default function LandingPage() {
  const { stats, setPaletteOpen } = useApp();
  const [albums, setAlbums] = useState([]);
  const [daily, setDaily] = useState(null);

  useEffect(() => {
    api.get('/albums').then(response => setAlbums(response.data)).catch(() => {});
    api.get('/daily').then(response => setDaily(response.data)).catch(() => {});
  }, []);

  const totalProblems = stats.total.total || albums.reduce((sum, album) => Math.max(sum, album.total), 0);

  return (
    <main className="landing">
      <Aurora />

      <section className="hero">
        <div className="hero-copy">
          <motion.span className="eyebrow-pill" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Sparkles size={13} /> {totalProblems ? `${totalProblems.toLocaleString()} problems` : 'Free forever'} · Python · C · C++ · Java
          </motion.span>
          <motion.h1 className="hero-headline" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}>
            Stop doomscrolling.<br />Start cooking <RotatingWord />.
          </motion.h1>
          <motion.p className="hero-sub" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
            AetherJudge is the coding gym that actually feels good. Follow a path, build a streak, stack XP, and watch your brain level up one accepted solution at a time.
          </motion.p>
          <motion.div className="hero-ctas" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Link className="btn btn-primary btn-lg" to="/guide">Start the guide <ArrowRight size={17} /></Link>
            <Link className="btn btn-ghost btn-lg" to={daily ? `/app?problem=${daily.id}` : '/app'}><Calendar size={17} /> Daily problem</Link>
          </motion.div>
          <motion.div className="hero-meta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
            <button type="button" className="hint-button" onClick={() => setPaletteOpen(true)}><Keyboard size={14} /> Press <kbd className="kbd">{MOD} K</kbd> to search anything</button>
          </motion.div>
        </div>

        <motion.div className="hero-visual" initial={{ opacity: 0, scale: 0.94, rotate: 2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: 0.2, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}>
          <TypingCode />
          <motion.div className="float-card float-streak" animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
            <Flame size={18} /> <b>7 day</b> streak
          </motion.div>
          <motion.div className="float-card float-rank" animate={{ y: [0, 9, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}>
            <Trophy size={16} /> Lv 4 · <b>Stack Surfer</b>
          </motion.div>
          {daily && (
            <motion.div className="float-card float-daily" animate={{ y: [0, -6, 0] }} transition={{ duration: 4.6, repeat: Infinity, ease: 'easeInOut', delay: 1.1 }}>
              <span className="float-label">TODAY</span>
              <b>{daily.title}</b>
              <DifficultyPill level={daily.difficulty} />
            </motion.div>
          )}
        </motion.div>
      </section>

      <section className="marquee" aria-label="Albums">
        <div className="marquee-track">
          {[...albums, ...albums].map((album, index) => (
            <Link key={`${album.slug}-${index}`} to={`/app?album=${album.slug}`} className="marquee-item" tabIndex={index >= albums.length ? -1 : 0} aria-hidden={index >= albums.length || undefined}>
              <span aria-hidden="true">{albumMeta(album.slug).emoji}</span> {album.name} <i>{album.total}</i>
            </Link>
          ))}
        </div>
      </section>

      <section className="stats-band">
        <Reveal className="stat"><b><CountUp value={totalProblems || 1000} /></b><span>problems, zero duplicates</span></Reveal>
        <Reveal className="stat" delay={0.08}><b><CountUp value={albums.length || 12} /></b><span>topic albums</span></Reveal>
        <Reveal className="stat" delay={0.16}><b><CountUp value={132} /></b><span>steps in the guide</span></Reveal>
        <Reveal className="stat" delay={0.24}><b><CountUp value={4} /></b><span>languages</span></Reveal>
      </section>

      <section className="section">
        <Reveal className="section-head">
          <span className="eyebrow">Why it hits different</span>
          <h2 className="section-title-lg">Built for the grind.<br /><span className="grad-text">Designed for the vibe.</span></h2>
        </Reveal>
        <div className="bento">
          {FEATURES.map(({ icon: IconComponent, title, body, to, span, tone }, index) => {
            const inner = (
              <>
                <span className={`bento-icon tone-${tone}`}><IconComponent size={22} strokeWidth={2.2} /></span>
                <h3>{title}</h3>
                <p>{body}</p>
                {to && <span className="bento-cta">Open <ArrowRight size={14} /></span>}
              </>
            );
            return (
              <Reveal key={title} delay={index * 0.05} className={`bento-cell${span === 'wide' ? ' wide' : ''} tone-${tone}`}>
                {to ? <Link to={to} className="bento-link">{inner}</Link> : <button type="button" className="bento-link" onClick={() => setPaletteOpen(true)}>{inner}</button>}
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="section">
        <Reveal className="section-head">
          <span className="eyebrow">How it works</span>
          <h2 className="section-title-lg">Three steps. That's the whole tutorial.</h2>
        </Reveal>
        <div className="steps">
          {[
            ['01', 'Pick your path', 'Follow the guide in order, or dive into any album that sparks joy.', Compass],
            ['02', 'Write & run', 'Monaco editor, custom input, instant output. Your code autosaves per problem.', Gauge],
            ['03', 'Get the W', 'Submit, watch every test light up green, collect XP, keep the streak.', Trophy],
          ].map(([number, title, body, IconComponent], index) => (
            <Reveal key={number} delay={index * 0.08} className="step-card">
              <span className="step-num">{number}</span>
              <IconComponent size={22} />
              <h3>{title}</h3>
              <p>{body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <Reveal className="final-cta-card">
          <h2>Your future self is already<br /><span className="grad-text">thanking you.</span></h2>
          <p>No paywall. No ads. Just you, the code and a very satisfying green checkmark.</p>
          <div className="hero-ctas center">
            <Link className="btn btn-primary btn-lg" to="/login">Create free account <ArrowRight size={17} /></Link>
            <Link className="btn btn-ghost btn-lg" to="/app">Just let me code</Link>
          </div>
        </Reveal>
      </section>

      <footer className="footer">
        <span>Aether<b>Judge</b> · made for people who like the green checkmark</span>
        <span>Problems from TACO (Apache-2.0) & Exercism (MIT)</span>
      </footer>
    </main>
  );
}
