// Visual identity for each album and the XP levels. Purely presentational.

export const ALBUM_META = {
  basics: { emoji: '🧱', color: '#3de0ff', tagline: 'where it all begins' },
  math: { emoji: '🧮', color: '#a78bfa', tagline: 'numbers go brrr' },
  strings: { emoji: '🧵', color: '#ff4fd8', tagline: 'text, but make it logic' },
  arrays: { emoji: '📦', color: '#ff8a3d', tagline: 'lists on lists' },
  'sorting-searching': { emoji: '🔎', color: '#4ade80', tagline: 'find it fast' },
  greedy: { emoji: '🤑', color: '#fbbf24', tagline: 'take the best, leave the rest' },
  'data-structures': { emoji: '🗂️', color: '#60a5fa', tagline: 'pick the right box' },
  'bit-manipulation': { emoji: '⚡', color: '#c6ff3d', tagline: 'think in 0s and 1s' },
  'dynamic-programming': { emoji: '🧠', color: '#f472b6', tagline: 'remember everything' },
  graphs: { emoji: '🕸️', color: '#22d3ee', tagline: 'everything is connected' },
  trees: { emoji: '🌳', color: '#86efac', tagline: 'roots, leaves, recursion' },
  games: { emoji: '🎮', color: '#fb7185', tagline: 'outplay the other player' },
};

export const albumMeta = slug => ALBUM_META[slug] || { emoji: '✨', color: '#a78bfa', tagline: '' };

export const XP_FOR = { easy: 10, medium: 25, hard: 50 };

const LEVEL_TITLES = [
  'Fresh Spawn', 'Loop Rookie', 'Bug Squasher', 'Stack Surfer', 'Algo Apprentice',
  'Recursion Wizard', 'Graph Goblin', 'DP Demon', 'Big-O Boss', 'Legendary Compiler',
];

// Level n needs 25·(n−1)² XP: 0, 25, 100, 225, 400, …
export function levelFor(xp = 0) {
  const level = Math.floor(Math.sqrt(xp / 25)) + 1;
  const floor = 25 * (level - 1) ** 2;
  const next = 25 * level ** 2;
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    progress: (xp - floor) / (next - floor),
    toNext: next - xp,
  };
}

export const prettyVerdict = verdict => (verdict || '').replaceAll('_', ' ');

export const VERDICT_VIBES = {
  accepted: ['Absolutely cooked it 🔥', 'Clean. Very clean. ✨', 'W submission 🏆', 'Main character energy 💅', 'Big brain moment 🧠'],
  wrong_answer: ['So close. Check the edge cases 👀', 'Not quite. Re-read the statement 📜', 'Plot twist: the answer differs 🌀'],
  time_limit_exceeded: ['Too slow, bestie. Think about Big-O ⏳', 'The judge got bored waiting 💤'],
  runtime_error: ['It crashed. Check indexes and input parsing 💥', 'Runtime said no 🙅'],
  compilation_error: ['It didn\'t compile. Check the error line 🛠️', 'Compiler said nope. Typo hunt time 🔍'],
};

export const vibe = verdict => {
  const lines = VERDICT_VIBES[verdict] || ['Judge has spoken.'];
  return lines[Math.floor(Math.random() * lines.length)];
};
