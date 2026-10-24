import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Icon from './components/Icon.jsx';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost/api';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async event => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, { email, password }, { withCredentials: true });
      if (response.data.user?.id) localStorage.setItem('userId', String(response.data.user.id));
      navigate('/app');
    } catch (err) {
      setError(err.response?.data?.error || 'Sign in failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="brand-mark"><Icon name="logo" size={18} /></span>
        <h1>Welcome back</h1>
        <p className="auth-copy">Sign in to continue your practice.</p>
        <form className="auth-form" onSubmit={handleLogin}>
          <label><span className="field-label">Email</span><input className="text-input" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
          <label><span className="field-label">Password</span><input className="text-input" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
          {error && <div className="inline-error" role="alert">{error}</div>}
          <button className="primary-button" type="submit" disabled={loading}>{loading ? <><span className="spinner" /> Signing in…</> : 'Sign in'}</button>
        </form>
        <p className="auth-footer">Your session is secured with an HTTP-only cookie.</p>
      </section>
    </main>
  );
}
