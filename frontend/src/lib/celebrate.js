import confetti from 'canvas-confetti';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Confetti burst from both sides; bigger for harder problems.
export function celebrate(difficulty = 'easy') {
  if (reducedMotion()) return;
  const power = { easy: 1, medium: 1.6, hard: 2.4 }[difficulty] || 1;
  const colors = ['#8b5cf6', '#ff4fd8', '#ff8a3d', '#c6ff3d', '#3de0ff'];
  const fire = (originX, angle) => confetti({
    particleCount: Math.round(70 * power), spread: 70, startVelocity: 48, angle,
    origin: { x: originX, y: 0.75 }, colors, scalar: 1.05, ticks: 220, zIndex: 9999,
  });
  fire(0.1, 60);
  fire(0.9, 120);
  if (power > 1.5) setTimeout(() => confetti({ particleCount: 120, spread: 120, origin: { y: 0.4 }, colors, zIndex: 9999 }), 260);
}
