import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import 'katex/dist/katex.min.css';
import './styles/tokens.css';
import './styles/app.css';
import AppRouter from './AppRouter.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>
);
