import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Bookmark, Flame, Send, Target, Trophy, Zap } from 'lucide-react';
import { useApp } from '../lib/useApp.js';
import { albumMeta, levelFor, prettyVerdict } from '../lib/meta.js';
import { Aurora, CountUp, DifficultyPill, Reveal, Ring } from '../components/ui.jsx';

const WEEKS = 26;

// GitHub-style activity grid for the last 26 weeks.
function Heatmap({ activity }) {
  const byDay = useMemo(() => Object.fromEntries(activity.map(row => [row.day, row])), [activity]);
  const cells = useMemo(() => {
    const today = new Date();
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (WEEKS * 7 - 1) - end.getUTCDay());
    const list = [];
    for (let date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
      const key = date.toISOString().slice(0, 10);
      list.push({ key, count: byDay[key]?.submissions || 0, accepted: byDay[key]?.accepted || 0 });
    }
    return list;
  }, [byDay]);
  const level = count => (count === 0 ? 0 : count < 2 ? 1 : count < 4 ? 2 : count < 7 ? 3 : 4);
  return (
    <div className="heatmap-wrap">
      <div className="heatmap" role="img" aria-label="Submission activity over the last six months">
        {cells.map(cell => <span key={cell.key} className={`hm hm-${level(cell.count)}`} title={`${cell.key}: ${cell.count} submission${cell.count === 1 ? '' : 's'}, ${cell.accepted} accepted`} />)}
      </div>
      <div className="heatmap-legend"><span>less</span>{[0, 1, 2, 3, 4].map(value => <span key={value} className={`hm hm-${value}`} />)}<span>more</span></div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, stats, statsReady, bookmarks } = useApp();
  const level = levelFor(stats.xp);
  const name = user ? `@${user.username}` : 'Guest coder';
  const rate = stats.submissions ? Math.round((stats.accepted / stats.submissions) * 100) : 0;

  return (
    <main className="page">
      <Aurora intensity={0.5} />
      <div className="page-inner">
        <Reveal className="profile-hero">
          <div className="profile-avatar"><span>{(user?.username || 'G').slice(0, 1).toUpperCase()}</span><b className="profile-level">Lv {level.level}</b></div>
          <div className="profile-id">
            <h1 className="page-title small">{name}</h1>
            <p className="profile-title">{level.title}</p>
            <div className="xp-bar" aria-label={`${stats.xp} XP, ${level.toNext} to next level`}>
              <motion.i initial={{ width: 0 }} animate={{ width: `${level.progress * 100}%` }} transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }} />
            </div>
            <p className="xp-text"><b>{stats.xp} XP</b> · {level.toNext} XP to Lv {level.level + 1}</p>
            {!user && <p className="guest-note">You're practising as a guest. <Link className="link" to="/login">Create an account</Link> to get on the leaderboard and keep your progress on any device.</p>}
          </div>
        </Reveal>

        <div className="kpi-grid">
          {[
            { icon: Flame, label: 'Current streak', value: stats.streak, suffix: stats.streak === 1 ? ' day' : ' days', tone: 'orange' },
            { icon: Trophy, label: 'Longest streak', value: stats.longestStreak, suffix: stats.longestStreak === 1 ? ' day' : ' days', tone: 'pink' },
            { icon: Target, label: 'Problems solved', value: stats.solved.total, tone: 'lime' },
            { icon: Send, label: 'Acceptance rate', value: rate, suffix: '%', tone: 'cyan' },
          ].map(({ icon: IconComponent, label, value, suffix, tone }, index) => (
            <Reveal key={label} delay={index * 0.05} className={`kpi tone-${tone}`}>
              <IconComponent size={20} />
              <b>{statsReady ? <CountUp value={value} suffix={suffix || ''} /> : '–'}</b>
              <span>{label}</span>
            </Reveal>
          ))}
        </div>

        <div className="profile-grid">
          <Reveal className="card">
            <h2 className="card-title">Solved by difficulty</h2>
            <div className="diff-rings">
              {['easy', 'medium', 'hard'].map(levelName => (
                <div key={levelName} className="diff-ring">
                  <Ring value={stats.total[levelName] ? stats.solved[levelName] / stats.total[levelName] : 0} size={96} stroke={9} color={`var(--${levelName})`} label={`${stats.solved[levelName]} of ${stats.total[levelName]} ${levelName}`}>
                    <b>{stats.solved[levelName]}</b><small>/{stats.total[levelName]}</small>
                  </Ring>
                  <span className={`t-${levelName}`}>{levelName}</span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal className="card" delay={0.05}>
            <h2 className="card-title">Activity</h2>
            <Heatmap activity={stats.activity} />
          </Reveal>

          <Reveal className="card span-2" delay={0.08}>
            <h2 className="card-title">Album progress</h2>
            <div className="album-progress">
              {stats.albums.map(album => {
                const meta = albumMeta(album.slug);
                const share = album.total ? album.solved / album.total : 0;
                return (
                  <Link key={album.slug} to={`/app?album=${album.slug}`} className="ap-row">
                    <span className="ap-emoji" aria-hidden="true">{meta.emoji}</span>
                    <span className="ap-name">{album.name}</span>
                    <span className="ap-bar"><motion.i style={{ background: meta.color }} initial={{ width: 0 }} whileInView={{ width: `${Math.max(share * 100, album.solved ? 2 : 0)}%` }} viewport={{ once: true }} transition={{ duration: 0.9 }} /></span>
                    <span className="ap-count">{album.solved}/{album.total}</span>
                  </Link>
                );
              })}
            </div>
          </Reveal>

          <Reveal className="card" delay={0.05}>
            <h2 className="card-title">Recent submissions</h2>
            {stats.recent.length === 0 && <div className="empty small">Nothing yet. <Link className="link" to="/guide">Start the guide</Link> and your history shows up here.</div>}
            <div className="recent">
              {stats.recent.map(item => (
                <Link key={item.id} to={`/app?problem=${item.problem_id}`} className={`recent-row ${item.verdict === 'accepted' ? 'good' : item.verdict ? 'bad' : ''}`}>
                  <span className="recent-title">{item.title}</span>
                  <span className="recent-verdict">{prettyVerdict(item.verdict || item.status)}</span>
                  <span className="recent-when">{new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                </Link>
              ))}
            </div>
          </Reveal>

          <Reveal className="card" delay={0.08}>
            <h2 className="card-title"><Bookmark size={16} /> Bookmarks</h2>
            {bookmarks.length === 0 && <div className="empty small">Tap the bookmark icon on any problem to save it for later.</div>}
            <div className="recent">
              {bookmarks.map(item => (
                <Link key={item.id} to={`/app?problem=${item.id}`} className="recent-row">
                  <span className="recent-title">{item.title}</span>
                  <DifficultyPill level={item.difficulty} />
                </Link>
              ))}
            </div>
          </Reveal>
        </div>

        <p className="xp-rules"><Zap size={13} /> XP: easy +10 · medium +25 · hard +50, once per problem. Streaks count days with at least one accepted solution (UTC).</p>
      </div>
    </main>
  );
}
