import { useEffect, useRef, useState } from 'react';
import { animate, motion, useInView } from 'motion/react';
import { albumMeta } from '../lib/meta.js';

// Brand mark: a small gradient prism.
export function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="aj-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" /><stop offset=".55" stopColor="#ff4fd8" /><stop offset="1" stopColor="#ff8a3d" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill="url(#aj-logo)" />
      <path d="M9 22.5 15.2 8h1.6L23 22.5h-3.3l-1.3-3.2h-4.9l-1.3 3.2Zm5.6-6h3.1L16.2 12Z" fill="#0b0618" />
    </svg>
  );
}

// Circular progress ring. `value` is 0..1.
export function Ring({ value = 0, size = 64, stroke = 7, color = 'url(#ring-grad)', children, label }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value || 0));
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label || `${Math.round(clamped * 100)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8b5cf6" /><stop offset="1" stopColor="#ff4fd8" /></linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }} transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

// Number that counts up when it scrolls into view.
export function CountUp({ value = 0, duration = 1.2, suffix = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView) return undefined;
    const controls = animate(0, value, { duration, ease: [0.2, 0.8, 0.2, 1], onUpdate: latest => setShown(Math.round(latest)) });
    return () => controls.stop();
  }, [inView, value, duration]);
  return <span ref={ref}>{shown.toLocaleString()}{suffix}</span>;
}

export function DifficultyPill({ level }) {
  const value = (level || 'easy').toLowerCase();
  return <span className={`pill pill-${value}`}>{value}</span>;
}

export function AlbumChip({ slug, name }) {
  const meta = albumMeta(slug);
  return <span className="album-chip" style={{ '--chip': meta.color }}><span aria-hidden="true">{meta.emoji}</span>{name}</span>;
}

// Soft animated colour blobs behind a page.
export function Aurora({ intensity = 1 }) {
  return (
    <div className="aurora" aria-hidden="true" style={{ opacity: intensity }}>
      <span className="blob blob-a" /><span className="blob blob-b" /><span className="blob blob-c" />
      <span className="grain" />
    </div>
  );
}

// Fade-and-rise wrapper for page sections.
export function Reveal({ children, delay = 0, className = '', as = 'div' }) {
  const Tag = motion[as] || motion.div;
  return (
    <Tag className={className} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.55, delay, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </Tag>
  );
}

export function Kbd({ children }) {
  return <kbd className="kbd">{children}</kbd>;
}
