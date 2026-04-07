import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { clearRequestQueue } from '../services/shikimori';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    clearRequestQueue();
    
    // Send pageview to Google Analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('config', 'G-LVD0M2PPJN', {
        page_path: pathname,
      });
    }
  }, [pathname]);

  return null;
};

export default ScrollToTop;
