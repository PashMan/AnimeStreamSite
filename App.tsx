
import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from './services/db';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import { Loader2 } from 'lucide-react';

import Home from './pages/Home';
import Catalog from './pages/Catalog';
import Collections from './pages/Collections';
import CollectionDetail from './pages/CollectionDetail';
import Details from './pages/Details';

// Custom lazy load function that retries on chunk load error
const lazyWithRetry = (componentImport: () => Promise<any>) =>
  lazy(async () => {
    try {
      const component = await componentImport();
      window.sessionStorage.removeItem('retry-lazy-refreshed');
      return component;
    } catch (error) {
      const hasRefreshed = window.sessionStorage.getItem('retry-lazy-refreshed');
      if (!hasRefreshed && error instanceof Error && error.message.includes('Failed to fetch dynamically imported module')) {
        window.sessionStorage.setItem('retry-lazy-refreshed', 'true');
        window.location.reload();
      }
      throw error;
    }
  });

// Lazy load pages
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const TextPage = lazyWithRetry(() => import('./pages/TextPage'));
const News = lazyWithRetry(() => import('./pages/News'));
const NewsDetails = lazyWithRetry(() => import('./pages/NewsDetails'));
const Messages = lazyWithRetry(() => import('./pages/Messages'));
const Social = lazyWithRetry(() => import('./pages/Social'));
const Forum = lazyWithRetry(() => import('./pages/Forum'));
const UserProfile = lazyWithRetry(() => import('./pages/UserProfile'));
const Premium = lazyWithRetry(() => import('./pages/Premium'));
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'));

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
            <Route path="collections" element={<Collections />} />
            <Route path="collections/:id" element={<CollectionDetail />} />
            <Route path="news" element={<News />} />
            <Route path="news/:id" element={<NewsDetails />} />
            <Route path="anime/:id" element={<Details />} />
            <Route path="profile" element={<Profile />} />
            <Route path="user/:id" element={<UserProfile />} />
            <Route path="favorites" element={<Navigate to="/profile" replace />} />
            <Route path="messages" element={<Messages />} />
            <Route path="social" element={<Social />} />
            <Route path="community" element={<Navigate to="/social" replace />} />
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