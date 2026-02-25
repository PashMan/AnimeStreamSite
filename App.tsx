
import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './services/db';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import { Loader2 } from 'lucide-react';

import Details from './pages/Details';

import Home from './pages/Home';
import Catalog from './pages/Catalog';

// Lazy load pages
const Profile = lazy(() => import('./pages/Profile'));
const TextPage = lazy(() => import('./pages/TextPage'));
const News = lazy(() => import('./pages/News'));
const NewsDetails = lazy(() => import('./pages/NewsDetails'));
const Messages = lazy(() => import('./pages/Messages'));
const Social = lazy(() => import('./pages/Social'));
const Forum = lazy(() => import('./pages/Forum'));
const Premium = lazy(() => import('./pages/Premium'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-dark">
    <Loader2 className="w-10 h-10 text-primary animate-spin" />
  </div>
);

const AuthEventHandler = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, _session: any) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password');
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return null;
};

const App: React.FC = () => {
  useEffect(() => {
    // Remove the initial loader once the React app mounts
    const loader = document.querySelector('.loader-overlay');
    if (loader) {
      loader.remove();
    }
  }, []);

  return (
    <Router>
      <AuthEventHandler />
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="catalog" element={<Catalog />} />
            <Route path="news" element={<News />} />
            <Route path="news/:id" element={<NewsDetails />} />
            <Route path="anime/:id" element={<Details />} />
            <Route path="profile" element={<Profile />} />
            <Route path="messages" element={<Messages />} />
            <Route path="social" element={<Social />} />
            <Route path="forum" element={<Forum />} />
            <Route path="forum/:topicId" element={<Forum />} />
            <Route path="premium" element={<Premium />} />
            
            {/* Footer Pages */}
            <Route path="privacy" element={<TextPage />} />
            <Route path="terms" element={<TextPage />} />
            <Route path="dmca" element={<TextPage />} />
            <Route path="faq" element={<TextPage />} />
            <Route path="contact" element={<TextPage />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
};

export default App;