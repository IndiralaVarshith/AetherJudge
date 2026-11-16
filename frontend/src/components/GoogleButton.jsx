import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../lib/useApp.js';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let scriptPromise = null;
let configPromise = null;

// Load Google Identity Services once per page.
function loadScript() {
  scriptPromise ||= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => { scriptPromise = null; reject(new Error('Could not load Google sign-in')); };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// The server says whether Google sign-in is set up (and with which client id).
const loadConfig = () => (configPromise ||= api.get('/auth/config').then(response => response.data).catch(() => ({ googleClientId: null })));

// Google's own "Continue with Google" button. Renders nothing when the server has no
// GOOGLE_CLIENT_ID, so the page still works before Google is configured.
export default function GoogleButton({ onCredential, onError }) {
  const { theme } = useApp();
  const ref = useRef(null);
  const callbackRef = useRef(onCredential);
  const [clientId, setClientId] = useState(null);

  useEffect(() => { callbackRef.current = onCredential; });

  useEffect(() => {
    let alive = true;
    loadConfig().then(config => { if (alive) setClientId(config.googleClientId); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!clientId) return undefined;
    let alive = true;
    loadScript()
      .then(() => {
        if (!alive || !ref.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: response => callbackRef.current(response.credential),
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        ref.current.innerHTML = '';
        window.google.accounts.id.renderButton(ref.current, {
          type: 'standard', shape: 'pill', size: 'large', text: 'continue_with', logo_alignment: 'left',
          theme: theme === 'light' ? 'outline' : 'filled_black',
          width: Math.min(380, ref.current.offsetWidth || 380),
        });
      })
      .catch(err => onError?.(err.message));
    return () => { alive = false; };
  }, [clientId, theme, onError]);

  if (!clientId) return null;
  return (
    <>
      <div className="google-button" ref={ref} />
      <div className="auth-divider" role="separator"><span>or use email</span></div>
    </>
  );
}
