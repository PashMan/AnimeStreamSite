
import React, { useEffect, Suspense, Component, ErrorInfo } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from './services/db';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import { Loader2 } from 'lucide-react';
import { useAuth } from './context/AuthContext';

// Safe lazy import with auto-retry on build hash mismatches / stale chunks
const lazyWithRetry = <T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) => {
  return React.lazy(async () => {
    try {
      return await factory();
    } catch (error: any) {
      console.warn('[Vite] Chunk load error, attempting recovery:', error);
      const isChunkError =
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed') ||
        error?.name === 'TypeError';

      if (isChunkError) {
        const storageKey = `retry_chunk_${window.location.pathname}`;
        const hasRetried = sessionStorage.getItem(storageKey);
        if (!hasRetried) {
          sessionStorage.setItem(storageKey, Date.now().toString());
          window.location.reload();
          return new Promise(() => {}); // Wait for reload
        }
      }
      throw error;
    }
  });
};

// Global error boundary for async route transitions
class RouteErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RouteErrorBoundary caught error]:', error, errorInfo);
    if (
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Importing a module script failed') ||
      error.name === 'TypeError'
    ) {
      const key = `boundary_retry_${window.location.pathname}`;
      const lastRetry = sessionStorage.getItem(key);
      if (!lastRetry || Date.now() - parseInt(lastRetry, 10) > 10000) {
        sessionStorage.setItem(key, Date.now().toString());
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-dark text-white p-6 text-center">
          <h2 className="text-xl font-semibold mb-2">Обновление страницы...</h2>
          <p className="text-gray-400 text-sm mb-4">
            Загружается актуальная версия приложения.
          </p>
          <button
            onClick={() => {
              sessionStorage.clear();
              window.location.reload();
            }}
            className="px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Перезагрузить сейчас
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Simple guard for admin roles only
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (user?.role === 'admin') {
    return <>{children}</>;
  }
  return <Navigate to="/" replace />;
};

// Eager load core critical pages to eliminate chunk load errors
import Home from './pages/Home';
import Details from './pages/Details';
import Catalog from './pages/Catalog';

// Lazy load non-critical secondary pages with chunk retry support
const Manga = lazyWithRetry(() => import('./pages/Manga'));
const Games = lazyWithRetry(() => import('./pages/Games'));
const Collections = lazyWithRetry(() => import('./pages/Collections'));
const CollectionDetail = lazyWithRetry(() => import('./pages/CollectionDetail'));
const CommunityCollectionDetail = lazyWithRetry(() => import('./pages/CommunityCollectionDetail'));
const TextPage = lazyWithRetry(() => import('./pages/TextPage'));
const NewsDetails = lazyWithRetry(() => import('./pages/NewsDetails'));
const Forum = lazyWithRetry(() => import('./pages/Forum'));
const UserProfile = lazyWithRetry(() => import('./pages/UserProfile'));
const Premium = lazyWithRetry(() => import('./pages/Premium'));
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const Messages = lazyWithRetry(() => import('./pages/Messages'));
const Social = lazyWithRetry(() => import('./pages/Social'));
const ClubDetail = lazyWithRetry(() => import('./pages/ClubDetail'));
const News = lazyWithRetry(() => import('./pages/News'));
const AdminPanel = lazyWithRetry(() => import('./pages/AdminPanel'));
const DebugLogs = lazyWithRetry(() => import('./pages/DebugLogs'));

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

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason;
      const msg = String(reason?.message || reason || '');
      const name = reason?.name;
      if (
        name === 'AbortError' ||
        name === 'NotAllowedError' ||
        msg.includes('interrupted by a call to pause') ||
        msg.includes('interrupted by a new load request') ||
        msg.includes('The play() request was interrupted')
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const isMangaMode = typeof window !== 'undefined' && (
    window.location.hostname.startsWith('manga.') || 
    localStorage.getItem('kami_manga_mode') === 'true'
  );

  return (
    <Router>
      <RouteErrorBoundary>
        <AuthEventHandler />
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/debug-logs" element={<DebugLogs />} />
            <Route path="/" element={<Layout />}>
              <Route index element={isMangaMode ? <Manga /> : <Home />} />
              <Route path="catalog" element={<Catalog />} />
              <Route path="manga" element={<Manga />} />
              <Route path="games" element={<AdminRoute><Games /></AdminRoute>} />
              <Route path="collections" element={<Collections />} />
              <Route path="collections/:id" element={<CollectionDetail />} />
              <Route path="collections/community/:id" element={<CommunityCollectionDetail />} />
              <Route path="news" element={<News />} />
              <Route path="news/:id" element={<NewsDetails />} />
              <Route path="anime/:id/*" element={<Details />} />
              <Route path="profile" element={<Profile />} />
              <Route path="user/:id" element={<UserProfile />} />
              <Route path="favorites" element={<Navigate to="/profile" replace />} />
              <Route path="messages" element={<Messages />} />
              <Route path="social" element={<Social />} />
              <Route path="club/:id" element={<ClubDetail />} />
              <Route path="community" element={<Navigate to="/social" replace />} />
              <Route path="forum" element={<Forum />} />
              <Route path="forum/:topicId" element={<Forum />} />
              <Route path="premium" element={<Navigate to="/" replace />} />
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
      </RouteErrorBoundary>
    </Router>
  );
};

export default App;