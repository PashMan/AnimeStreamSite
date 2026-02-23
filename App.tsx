
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './services/db';
import Layout from './components/Layout';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import Details from './pages/Details';
import Profile from './pages/Profile';
import TextPage from './pages/TextPage';
import News from './pages/News';
import NewsDetails from './pages/NewsDetails';
import Messages from './pages/Messages';
import Forum from './pages/Forum';
import Premium from './pages/Premium';
import ResetPassword from './pages/ResetPassword';

import ScrollToTop from './components/ScrollToTop';

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
  return (
    <Router>
      <AuthEventHandler />
      <ScrollToTop />
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
    </Router>
  );
};

export default App;