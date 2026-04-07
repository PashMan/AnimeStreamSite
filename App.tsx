
import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from './services/db';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import { Loader2 } from 'lucide-react';

// Eager load critical pages (test)
import Home from './pages/Home';

// Lazy load non-critical pages as requested
const Catalog = React.lazy(() => import('./pages/Catalog'));
const Collections = React.lazy(() => import('./pages/Collections'));
const CollectionDetail = React.lazy(() => import('./pages/CollectionDetail'));
const CommunityCollectionDetail = React.lazy(() => import('./pages/CommunityCollectionDetail'));
const Details = React.lazy(() => import('./pages/Details'));
const TextPage = React.lazy(() => import('./pages/TextPage'));
const NewsDetails = React.lazy(() => import('./pages/NewsDetails'));
const Forum = React.lazy(() => import('./pages/Forum'));
const UserProfile = React.lazy(() => import('./pages/UserProfile'));
const Premium = React.lazy(() => import('./pages/Premium'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Messages = React.lazy(() => import('./pages/Messages'));
const Social = React.lazy(() => import('./pages/Social'));
const ClubDetail = React.lazy(() => import('./pages/ClubDetail'));
const News = React.lazy(() => import('./pages/News'));
const AdminPanel = React.lazy(() => import('./pages/AdminPanel'));
const DebugLogs = React.lazy(() => import('./pages/DebugLogs'));

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
          <Route path="/debug-logs" element={<DebugLogs />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="catalog" element={<Catalog />} />
            <Route path="collections" element={<Collections />} />
            <Route path="collections/:id" element={<CollectionDetail />} />
            <Route path="collections/community/:id" element={<CommunityCollectionDetail />} />
            <Route path="news" element={<News />} />
            <Route path="news/:id" element={<NewsDetails />} />
            <Route path="anime/:id" element={<Details />} />
            <Route path="anime/:id/episode/:episode" element={<Details />} />
            <Route path="profile" element={<Profile />} />
            <Route path="user/:id" element={<UserProfile />} />
            <Route path="favorites" element={<Navigate to="/profile" replace />} />
            <Route path="messages" element={<Messages />} />
            <Route path="social" element={<Social />} />
            <Route path="club/:id" element={<ClubDetail />} />
            <Route path="community" element={<Navigate to="/social" replace />} />
            <Route path="forum" element={<Forum />} />
            <Route path="forum/:topicId" element={<Forum />} />
            <Route path="premium" element={<Premium />} />
            <Route path="admin" element={<AdminPanel />} />
            <Route path="debug" element={<Navigate to="/debug-logs" replace />} />
            
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