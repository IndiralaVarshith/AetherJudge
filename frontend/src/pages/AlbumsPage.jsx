import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { api, errorMessage } from '../api.js';
import { useApp } from '../lib/useApp.js';
import { albumMeta } from '../lib/meta.js';
import { Aurora, Reveal, Ring } from '../components/ui.jsx';

export default function AlbumsPage() {
  const { stats } = useApp();
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/albums')
      .then(response => setAlbums(response.data))
      .catch(err => setError(errorMessage(err, 'Could not load albums. Is the API running?')))
      .finally(() => setLoading(false));
  }, []);

  const solvedIn = Object.fromEntries(stats.albums.map(album => [album.slug, album.solved]));

  return (
    <main className="page">
      <Aurora intensity={0.55} />
      <div className="page-inner">
        <Reveal className="page-head">
          <span className="eyebrow">Albums</span>
          <h1 className="page-title">Pick a vibe. <span className="grad-text">Master it.</span></h1>
          <p className="page-lead">Every problem lives in an album. Albums are in the order we'd learn them, and problems inside go easy → hard. Lost? <Link to="/guide" className="link">The guide picks for you</Link>.</p>
        </Reveal>

        {error && <div className="alert" role="alert">{error}</div>}

        <div className="album-grid">
          {loading && Array.from({ length: 8 }, (_, index) => <div key={index} className="album-card skeleton" />)}
          {albums.map((album, index) => {
            const meta = albumMeta(album.slug);
            const solved = solvedIn[album.slug] || 0;
            return (
              <motion.div key={album.slug} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}>
                <Link to={`/app?album=${album.slug}`} className="album-card" style={{ '--album': meta.color }}>
                  <div className="album-card-top">
                    <span className="album-emoji" aria-hidden="true">{meta.emoji}</span>
                    <Ring value={album.total ? solved / album.total : 0} size={52} stroke={5} color={meta.color} label={`${solved} of ${album.total} solved`}>
                      <span className="ring-small">{solved}</span>
                    </Ring>
                  </div>
                  <span className="album-num">ALBUM {String(album.position).padStart(2, '0')}</span>
                  <h2 className="album-title">{album.name}</h2>
                  <p className="album-tagline">{meta.tagline}</p>
                  <p className="album-desc">{album.description}</p>
                  <div className="album-mix">
                    <span className="mix"><i className="e" style={{ flexGrow: album.easy }} /><i className="m" style={{ flexGrow: album.medium }} /><i className="h" style={{ flexGrow: album.hard }} /></span>
                    <span className="mix-legend"><b className="t-easy">{album.easy}</b> easy · <b className="t-medium">{album.medium}</b> med · <b className="t-hard">{album.hard}</b> hard</span>
                  </div>
                  <span className="album-go">{album.total} problems <ArrowRight size={15} /></span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
