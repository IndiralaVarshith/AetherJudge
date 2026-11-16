import { createContext, useContext } from 'react';

export const AppContext = createContext(null);

// App-wide state (user, stats, theme, bookmarks, command palette). See AppContext.jsx.
export const useApp = () => useContext(AppContext);
