import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { clearRequestQueue } from '../services/shikimori';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    clearRequestQueue();
  }, [pathname]);

  return null;
};

export default ScrollToTop;
