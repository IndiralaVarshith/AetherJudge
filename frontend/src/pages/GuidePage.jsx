import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Check, Lock, Play } from 'lucide-react';
import { api, errorMessage } from '../api.js';
import { useApp } from '../lib/useApp.js';
import { albumMeta } from '../lib/meta.js';
import { Aurora, DifficultyPill, Reveal, Ring } from '../components/ui.jsx';

export default function GuidePage() {
  const { solvedIds } = useApp();
  const [guide, setGuide] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/guide').then(response => setGuide(response.data)).catch(err => setError(errorMessage(err, 'Could not load the guide. Is the API running?')));
  }, []);

  const { done, next, currentStage } = useMemo(() => {
    if (!guide) return { done: 0, next: null, currentStage: null };
    const all = guide.stages.flatMap(stage => stage.problems.map(problem => ({ ...problem, stage: stage.slug })));
    const upNext = all.find(problem => !solvedIds.has(Number(problem.id)));
    return { done: all.filter(problem => solvedIds.has(Number(problem.id))).length, next: upNext, currentStage: upNext?.stage };
  }, [guide, solvedIds]);

  return (
    <main className="page">
      <Aurora intensity={0.55} />
      <div className="page-inner narrow">
        <Reveal className="page-head">
          <span className="eyebrow">Guide me</span>
          <h1 className="page-title">Zero to <span className="grad-text">cracked</span>, in order.</h1>
          <p className="page-lead">One path, twelve stages. Each stage teaches one idea and builds on the last. Start with reading input and simple logic, finish with DP, graphs and game theory. Easy first, then a stretch problem to flex.</p>
        </Reveal>

        {guide && (
          <Reveal className="guide-hud">
            <Ring value={guide.total ? done / guide.total : 0} size={84} stroke={8} label={`${done} of ${guide.total} solved`}>
              <b>{Math.round((done / Math.max(1, guide.total)) * 100)}%</b>
            </Ring>
            <div className="guide-hud-text">
              <div className="guide-hud-count"><b>{done}</b> / {guide.total} steps cleared</div>
              {next ? <div className="guide-hud-next">Next up: <b>{next.title}</b> <DifficultyPill level={next.difficulty} /></div> : <div className="guide-hud-next">You finished the whole guide. Legendary. 👑</div>}
            </div>
            {next && <Link className="btn btn-primary" to={`/app?album=${next.stage}&problem=${next.id}`}><Play size={15} /> Continue</Link>}
          </Reveal>
        )}

        {!guide && !error && <div className="guide-skeleton">{Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton block" />)}</div>}
        {error && <div className="alert" role="alert">{error}</div>}

        <ol className="roadmap">
          {guide?.stages.map((stage, stageIndex) => {
            const meta = albumMeta(stage.slug);
            const cleared = stage.problems.filter(problem => solvedIds.has(Number(problem.id))).length;
            const complete = cleared === stage.problems.length;
            const current = stage.slug === currentStage;
            return (
              <motion.li key={stage.slug} className={`stage${complete ? ' complete' : ''}${current ? ' current' : ''}`} style={{ '--album': meta.color }} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.45, delay: Math.min(stageIndex, 3) * 0.04 }}>
                <div className="stage-node" aria-hidden="true">{complete ? <Check size={20} strokeWidth={3} /> : <span>{meta.emoji}</span>}</div>
                <section className="stage-card" aria-labelledby={`stage-${stage.slug}`}>
                  <header className="stage-header">
                    <div>
                      <span className="stage-kicker">STAGE {stage.stage}{current ? ' · YOU ARE HERE' : ''}</span>
                      <h2 id={`stage-${stage.slug}`} className="stage-name">{stage.name}</h2>
                      <p className="stage-goal">{stage.goal}</p>
                    </div>
                    <span className="stage-score">{cleared}/{stage.problems.length}</span>
                  </header>
                  <div className="stage-bar"><i style={{ width: `${(cleared / stage.problems.length) * 100}%` }} /></div>
                  <ul className="learn-chips" aria-label="You will learn">{stage.learn.map(item => <li key={item}>{item}</li>)}</ul>
                  <ol className="stage-list">
                    {stage.problems.map(problem => {
                      const solved = solvedIds.has(Number(problem.id));
                      const isNext = next && Number(next.id) === Number(problem.id);
                      return (
                        <li key={problem.id}>
                          <Link to={`/app?album=${stage.slug}&problem=${problem.id}`} className={`stage-row${solved ? ' solved' : ''}${isNext ? ' next' : ''}`}>
                            <span className="stage-step">{problem.step}</span>
                            <span className="stage-check">{solved ? <Check size={12} strokeWidth={3} /> : isNext ? <Play size={10} /> : null}</span>
                            <span className="stage-row-title">{problem.title}</span>
                            <DifficultyPill level={problem.difficulty} />
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                  <Link className="stage-more" to={`/app?album=${stage.slug}`}>More {meta.emoji} {stage.name} <ArrowRight size={14} /></Link>
                </section>
              </motion.li>
            );
          })}
          {guide && <li className="stage finale"><div className="stage-node" aria-hidden="true"><Lock size={18} /></div><div className="stage-card finale-card">🏁 Finish all twelve stages and you'll have touched every core idea in competitive programming. Then: hard problems in any album, forever.</div></li>}
        </ol>
      </div>
    </main>
  );
}
