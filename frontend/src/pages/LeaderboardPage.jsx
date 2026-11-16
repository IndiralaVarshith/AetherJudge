import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Crown, Medal, Zap } from 'lucide-react';
import { api, errorMessage } from '../api.js';
import { useApp } from '../lib/useApp.js';
import { levelFor } from '../lib/meta.js';
import { Aurora, Reveal } from '../components/ui.jsx';

export default function LeaderboardPage() {
  const { user } = useApp();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/leaderboard').then(response => setRows(response.data)).catch(err => setError(errorMessage(err, 'Could not load the leaderboard.')));
  }, []);

  const podium = (rows || []).slice(0, 3);
  const rest = (rows || []).slice(3);
  const order = [1, 0, 2]; // silver, gold, bronze

  return (
    <main className="page">
      <Aurora intensity={0.55} />
      <div className="page-inner narrow">
        <Reveal className="page-head center">
          <span className="eyebrow">Leaderboard</span>
          <h1 className="page-title">Who's <span className="grad-text">cooking</span> the hardest?</h1>
          <p className="page-lead">Ranked by XP from unique problems solved. Easy +10, medium +25, hard +50.</p>
        </Reveal>

        {error && <div className="alert" role="alert">{error}</div>}
        {rows && rows.length === 0 && (
          <div className="card empty-board">
            <Crown size={34} />
            <h2>The throne is empty 👀</h2>
            <p>Nobody signed in has solved a problem yet. Be the first name up here.</p>
            <Link className="btn btn-primary" to={user ? '/guide' : '/login'}>{user ? 'Start solving' : 'Create an account'}</Link>
          </div>
        )}

        {podium.length > 0 && (
          <div className="podium">
            {order.filter(position => podium[position]).map(position => {
              const row = podium[position];
              return (
                <motion.div key={row.id} className={`podium-spot place-${position + 1}`} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + position * 0.12, type: 'spring', stiffness: 200, damping: 20 }}>
                  <span className="podium-avatar">{row.username.slice(0, 1).toUpperCase()}{position === 0 && <Crown size={22} className="podium-crown" />}</span>
                  <b className="podium-name">@{row.username}</b>
                  <span className="podium-xp"><Zap size={13} /> {row.xp} XP</span>
                  <div className="podium-block"><span>{position + 1}</span></div>
                </motion.div>
              );
            })}
          </div>
        )}

        {rest.length > 0 && (
          <div className="card board">
            {rest.map(row => (
              <div key={row.id} className={`board-row${user && Number(user.id) === Number(row.id) ? ' me' : ''}`}>
                <span className="board-rank">{row.rank <= 10 ? <Medal size={14} /> : null}{row.rank}</span>
                <span className="board-name">@{row.username}<small>Lv {levelFor(row.xp).level}</small></span>
                <span className="board-split"><b className="t-easy">{row.easy}</b>/<b className="t-medium">{row.medium}</b>/<b className="t-hard">{row.hard}</b></span>
                <span className="board-xp">{row.xp} XP</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
