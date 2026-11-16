import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { Toaster } from 'sonner';
import Navbar from './components/Navbar.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import { AppProvider } from './lib/AppContext.jsx';
import { useApp } from './lib/useApp.js';
import LandingPage from './pages/LandingPage.jsx';

// The workspace pulls in the code editor, so it and the other pages load on demand.
const Workspace = lazy(() => import('./App.jsx'));
const AlbumsPage = lazy(() => import('./pages/AlbumsPage.jsx'));
const GuidePage = lazy(() => import('./pages/GuidePage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage.jsx'));
const Login = lazy(() => import('./Login.jsx'));

function PageLoader() {
  return <div className="page-loader" role="status"><span className="loader-orb" /><span>Loading…</span></div>;
}

function AnimatedRoutes() {
  const location = useLocation();
  // The workspace keeps its own state across ?problem= changes, so key by path only.
  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname} className="route" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}>
        <Suspense fallback={<PageLoader />}>
          <Routes location={location}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/app" element={<Workspace />} />
            <Route path="/albums" element={<AlbumsPage />} />
            <Route path="/guide" element={<GuidePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function Shell() {
  const { theme } = useApp();
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar />
      <div id="main"><AnimatedRoutes /></div>
      <CommandPalette />
      <Toaster theme={theme} position="bottom-right" richColors closeButton toastOptions={{ className: 'toast' }} />
    </>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <AppProvider>
          <Shell />
        </AppProvider>
      </MotionConfig>
    </BrowserRouter>
  );
}
