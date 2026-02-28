
import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from './services/db';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import { Loader2 } from 'lucide-react';

// Eager load critical pages
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import Collections from './pages/Collections';
import CollectionDetail from './pages/CollectionDetail';
import Details from './pages/Details';
import TextPage from './pages/TextPage';
import NewsDetails from './pages/NewsDetails';
import Forum from './pages/Forum';
import UserProfile from './pages/UserProfile';
import Premium from './pages/Premium';
import ResetPassword from './pages/ResetPassword';

// Lazy load non-critical pages as requested
const Profile = React.lazy(() => import('./pages/Profile'));
const Messages = React.lazy(() => import('./pages/Messages'));
const Social = React.lazy(() => import('./pages/Social'));
const News = React.lazy(() => import('./pages/News'));

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