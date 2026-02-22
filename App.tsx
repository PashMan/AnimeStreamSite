
import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
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

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
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