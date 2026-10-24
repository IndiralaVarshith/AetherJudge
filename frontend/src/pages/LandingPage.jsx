import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';

export default function LandingPage() {
  return (
    <main className="landing-page">
      <div className="landing-wrap">
        <section className="landing-hero">
          <div>
            <span className="eyebrow">A focused space to get better</span>
            <h1 className="hero-title">Solve the problem.<br /><em>Find your flow.</em></h1>
            <p className="hero-description">
              AetherJudge brings thoughtful problem practice and a fast, focused code editor into one workspace. Write, run, and submit without losing your momentum.
            </p>
            <div className="hero-actions">
              <Link className="primary-link" to="/app">Open workspace <Icon name="play" size={14} /></Link>
              <Link className="secondary-link" to="/login">Sign in <Icon name="user" size={14} /></Link>
            </div>
            <p className="hero-note">Python · C++ · Java · Powered by Judge0</p>
          </div>
          <div className="hero-preview" aria-label="Preview of the AetherJudge coding workspace">
            <div className="preview-topbar"><span className="preview-dots"><i /><i /><i /></span><span>Two Sum · Python</span><span>Ready</span></div>
            <div className="preview-body">
              <div className="preview-side"><div className="preview-line selected" /><div className="preview-line" /><div className="preview-line short" /><div className="preview-line" /><div className="preview-line short" /></div>
              <div className="preview-editor">
                <div><b>def</b> two_sum(nums, target):</div>
                <div>&nbsp;&nbsp;seen = {'{}'}</div>
                <div>&nbsp;&nbsp;<b>for</b> i, num <b>in</b> <span>enumerate</span>(nums):</div>
                <div>&nbsp;&nbsp;&nbsp;&nbsp;need = target - num</div>
                <div>&nbsp;&nbsp;&nbsp;&nbsp;<b>if</b> need <b>in</b> seen:</div>
                <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>return</b> [seen[need], i]</div>
              </div>
            </div>
            <div className="preview-verdict"><strong>✓ ACCEPTED</strong><span>12 ms · 4/4 tests</span></div>
          </div>
        </section>
        <div className="landing-stats" aria-label="Platform features">
          <div className="stat-item"><strong>Focused workspace</strong><span>Problem, editor, and results together</span></div>
          <div className="stat-item"><strong>Instant feedback</strong><span>Run code in an isolated sandbox</span></div>
          <div className="stat-item"><strong>Your pace</strong><span>Practice across three languages</span></div>
        </div>
      </div>
    </main>
  );
}
