export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

// Label for the platform's command key: ⌘ on Apple devices, Ctrl elsewhere.
export const MOD = isMac ? '⌘' : 'Ctrl';
