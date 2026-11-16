import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, AtSign, Eye, EyeOff, Flame, LoaderCircle, Lock, Mail, Sparkles, Trophy, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from './api.js';
import { setUser } from './lib/storage.js';
import { Aurora, Logo } from './components/ui.jsx';
import GoogleButton from './components/GoogleButton.jsx';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('join');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const joining = mode === 'join';

  const finish = (user, isNew) => {
    setUser(user);
    toast.success(isNew ? `Welcome to the gym, @${user.username} 🎉` : `Welcome back, @${user.username} 👋`);
    navigate(isNew ? '/guide' : '/app');
  };

  const signInWithGoogle = async credential => {
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/google', { credential });
      finish(response.data.user, response.data.created);
    } catch (err) {
      setError(errorMessage(err, 'Google sign-in failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const submit = async event => {
    event.preventDefault();
    setError('');
    // Same rules as the server, checked here first for instant feedback.
    if (joining && !/^[A-Za-z0-9_]{3,20}$/.test(username.trim())) { setError('Username must be 3–20 characters: letters, numbers or _.'); return; }
    if (joining && password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
    setLoading(true);
    try {
      const response = joining
        ? await api.post('/auth/register', { username: username.trim(), email: email.trim(), password })
        : await api.post('/auth/login', { email: email.trim(), password });
      finish(response.data.user, joining);
    } catch (err) {
      const fallback = err.response ? 'Something went wrong. Please try again.' : 'Could not reach AetherJudge. Is the API running?';
      setError(errorMessage(err, fallback));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth">
      <Aurora />
      <div className="auth-grid">
        <section className="auth-pitch" aria-hidden="true">
          <Logo size={44} />
          <h2>Your coding era<br /><span className="grad-text">starts here.</span></h2>
          <ul className="perks">
            <li><Flame size={18} /> Daily streaks that actually motivate</li>
            <li><Zap size={18} /> XP and levels for every problem</li>
            <li><Trophy size={18} /> A spot on the leaderboard</li>
            <li><Sparkles size={18} /> Progress synced to your account</li>
          </ul>
        </section>

        <motion.section className="auth-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <div className="auth-switch" role="tablist" aria-label="Account">
            {[['join', 'Join free'], ['signin', 'Sign in']].map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={mode === id} className={mode === id ? 'active' : ''} onClick={() => { setMode(id); setError(''); }}>
                {mode === id && <motion.span layoutId="auth-pill" className="auth-pill" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
                <span>{label}</span>
              </button>
            ))}
          </div>

          <h1 className="auth-title">{joining ? 'Create your account' : 'Welcome back'}</h1>
          <p className="auth-sub">{joining ? 'Takes 10 seconds. No credit card, no spam.' : 'Pick up right where you left off.'}</p>

          <GoogleButton onCredential={signInWithGoogle} onError={setError} />

          <form className="auth-form" onSubmit={submit}>
            <AnimatePresence initial={false}>
              {joining && (
                <motion.label key="username" className="input-wrap" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <span className="label">Username</span>
                  <span className="input-icon"><AtSign size={16} /><input className="field" value={username} onChange={event => setUsername(event.target.value.replace(/\s/g, ''))} autoComplete="username" placeholder="cracked_coder" required={joining} maxLength={20} /></span>
                </motion.label>
              )}
            </AnimatePresence>
            <label className="input-wrap">
              <span className="label">Email</span>
              <span className="input-icon"><Mail size={16} /><input className="field" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></span>
            </label>
            <label className="input-wrap">
              <span className="label">Password</span>
              <span className="input-icon">
                <Lock size={16} />
                <input className="field" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete={joining ? 'new-password' : 'current-password'} placeholder={joining ? 'At least 8 characters' : '••••••••'} required />
                <button type="button" className="reveal-button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </span>
            </label>
            {error && <div className="alert" role="alert">{error}</div>}
            <button className="btn btn-primary btn-lg full" type="submit" disabled={loading}>
              {loading ? <LoaderCircle size={17} className="spin" /> : null}
              {joining ? 'Create account' : 'Sign in'} {!loading && <ArrowRight size={17} />}
            </button>
          </form>
          <p className="auth-foot">{joining ? 'Already have an account?' : 'New here?'} <button type="button" className="link-button" onClick={() => setMode(joining ? 'signin' : 'join')}>{joining ? 'Sign in' : 'Join free'}</button></p>
        </motion.section>
      </div>
    </main>
  );
}
