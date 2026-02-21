
import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { Menu, X, Search, MessageSquareText, Shuffle, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import { fetchAnimes } from '../services/shikimori';

// Helper to find a random anime with a player
const findRandomAnimeWithPlayer = async (): Promise<string | null> => {
  for (let i = 0; i < 5; i++) {
    try {
      const animes = await fetchAnimes({ 
        limit: 1, 
        order: 'random',
        kind: 'tv',
        status: 'released',
        score: 7
      });
      
      if (animes.length > 0) {
        return animes[0].id;
      }
    } catch (e) {
      console.error(e);
    }
  }
  return null;
};

export const Logo: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`flex items-center gap-3 select-none ${className}`}>
    <div className="w-10 h-10 bg-gradient-to-br from-[#8B5CF6] to-[#06B6D4] rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
    </div>
    <div className="font-display text-[26px] font-black tracking-tight text-white leading-none">
      Anime<span className="text-primary">Stream</span>
    </div>
  </div>
);

const Layout: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout, openAuthModal } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => pathname === path;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/catalog?q=${encodeURIComponent(searchQuery)}`);
      setIsMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark text-slate-200 font-sans selection:bg-primary/30">
      <AuthModal />
      
      <header className="fixed top-0 w-full z-50 bg-dark/80 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 gap-8">
            <Link to="/" className="hover:opacity-90 transition-opacity">
              <Logo />
            </Link>

            <div className="flex-1 hidden md:flex justify-center max-w-xl gap-4">
              <form onSubmit={handleSearch} className="relative w-full group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Найти аниме..."
                  className="w-full h-12 pl-12 pr-12 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:bg-white focus:text-slate-900 focus:outline-none transition-all duration-500 shadow-inner"
                />
              </form>
              <button 
                onClick={async () => {
                  const id = await findRandomAnimeWithPlayer();
                  if (id) navigate(`/watch/${id}`);
                }}
                className="p-3 bg-white/5 hover:bg-primary hover:text-white rounded-2xl transition-all group"
                title="Случайное аниме"
              >
                <Shuffle className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              </button>
            </div>

            <nav className="hidden lg:flex items-center gap-8 text-[11px] font-black uppercase tracking-[0.2em]">
              <Link to="/" className={`${isActive('/') ? 'text-primary' : 'text-slate-400 hover:text-white'} transition-all`}>Главная</Link>
              <Link to="/catalog" className={`${isActive('/catalog') ? 'text-primary' : 'text-slate-400 hover:text-white'} transition-all`}>Каталог</Link>
              <Link to="/news" className={`${isActive('/news') ? 'text-primary' : 'text-slate-400 hover:text-white'} transition-all`}>Новости</Link>
              <Link to="/forum" className={`${isActive('/forum') ? 'text-primary' : 'text-slate-400 hover:text-white'} transition-all`}>Форум</Link>
            </nav>

            <div className="flex items-center gap-4">
              <Link to="/premium" title="Премиум" className="p-2.5 bg-yellow-500/10 hover:bg-yellow-500 text-yellow-500 hover:text-white rounded-xl transition-all relative group">
                <Crown className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </Link>
              {user && (
                <Link to="/messages" title="Сообщения" className="p-2.5 bg-white/5 hover:bg-primary hover:text-white rounded-xl transition-all relative">
                   <MessageSquareText className="w-5 h-5" />
                </Link>
              )}
              {user ? (
                <div className="flex items-center gap-4">
                  <Link to="/profile" className="w-10 h-10 rounded-2xl overflow-hidden ring-2 ring-primary/20 hover:ring-primary transition-all">
                    <img src={user.avatar} alt="User" className="w-full h-full object-cover" />
                  </Link>
                  <button onClick={logout} className="text-[9px] font-black uppercase text-slate-500 hover:text-red-400 transition-colors tracking-widest hidden sm:block">Выйти</button>
                </div>
              ) : (
                <button onClick={openAuthModal} className="h-11 px-8 bg-primary hover:bg-violet-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95">
                  Войти
                </button>
              )}
              <button className="md:hidden text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-dark pt-20 animate-in fade-in duration-300 md:hidden">
          <nav className="flex flex-col p-8 gap-6 text-xl font-black uppercase tracking-widest font-display">
            <Link to="/" onClick={() => setIsMenuOpen(false)} className="hover:text-primary">Главная</Link>
            <Link to="/catalog" onClick={() => setIsMenuOpen(false)} className="hover:text-primary">Каталог</Link>
            <Link to="/news" onClick={() => setIsMenuOpen(false)} className="hover:text-primary">Новости</Link>
            {user ? (
              <button onClick={() => { logout(); setIsMenuOpen(false); }} className="text-left text-red-500">Выйти</button>
            ) : (
              <button onClick={() => { openAuthModal(); setIsMenuOpen(false); }} className="text-left text-primary">Войти</button>
            )}
          </nav>
        </div>
      )}

      <main className="flex-grow pt-20">
        <Outlet />
      </main>

      <footer className="bg-surface/50 border-t border-white/5 pt-24 pb-12 mt-auto">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20">
            <div className="col-span-2">
              <div className="mb-8">
                <Logo />
              </div>
              <p className="text-slate-400 max-w-md leading-relaxed text-sm font-medium">
                Премиальный сервис для просмотра аниме в лучшем качестве. Мы объединяем лучшие студии озвучки и перевода в одном удобном интерфейсе.
              </p>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-8 font-display">Навигация</h4>
              <ul className="space-y-4 text-[13px] font-bold">
                <li><Link to="/catalog" className="hover:text-primary transition-colors">Весь каталог</Link></li>
                <li><Link to="/news" className="hover:text-primary transition-colors">Последние новости</Link></li>
                <li><Link to="/profile" className="hover:text-primary transition-colors">Личный кабинет</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-8 font-display">Поддержка</h4>
              <ul className="space-y-4 text-[13px] font-bold">
                <li><Link to="/dmca" className="hover:text-primary transition-colors">DMCA</Link></li>
                <li><Link to="/faq" className="hover:text-primary transition-colors">Помощь</Link></li>
                <li><Link to="/contact" className="hover:text-primary transition-colors">Контакты</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between gap-6 text-[10px] font-black uppercase tracking-widest text-slate-600">
            <p>© {new Date().getFullYear()} AnimeStream Project. Все права защищены.</p>
            <div className="flex gap-8">
              <Link to="/terms" className="hover:text-white transition-colors">Правила</Link>
              <Link to="/privacy" className="hover:text-white transition-colors">Конфиденциальность</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;