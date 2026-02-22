
import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { Menu, X, Search, MessageSquareText, Shuffle, Crown, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import { fetchAnimes } from '../services/shikimori';

// Helper to find a random anime with a player
const findRandomAnimeWithPlayer = async (): Promise<string | null> => {
  // Shikimori has around 1000+ popular TV animes. Let's pick a random page.
  const randomPage = Math.floor(Math.random() * 50) + 1;
  try {
    const animes = await fetchAnimes({ 
      limit: 20, 
      order: 'popularity',
      kind: 'tv',
      status: 'released',
      score: 7,
      page: randomPage
    });
    
    if (animes && animes.length > 0) {
      const randomIndex = Math.floor(Math.random() * animes.length);
      return animes[randomIndex].id;
    }
  } catch (e) {
    console.error(e);
  }
  return null;
};

export const Logo: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`flex items-center gap-3 select-none ${className}`}>
    <div className="w-10 h-10 bg-gradient-to-br from-[#8B5CF6] to-[#06B6D4] rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
    </div>
    <div className="font-display text-[26px] font-black tracking-tight text-white leading-none hidden md:block">
      Anime<span className="text-primary">Stream</span>
    </div>
  </div>
);

const Layout: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout, openAuthModal } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => pathname === path;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setIsMenuOpen(false);
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
                  if (id) navigate(`/anime/${id}`);
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

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm md:hidden" onClick={() => setIsMenuOpen(false)} />
      )}

      {/* Mobile Side Drawer */}
      <div className={`fixed top-0 right-0 bottom-0 w-[75%] max-w-[320px] bg-surface border-l border-white/10 z-[70] transform transition-transform duration-300 ease-out md:hidden flex flex-col ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Меню</span>
          <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-6 flex flex-col gap-2">
          <Link to="/" className={`p-4 rounded-xl font-black uppercase tracking-widest text-sm transition-colors ${isActive('/') ? 'bg-primary text-white' : 'text-slate-300 hover:bg-white/5'}`}>
            Главная
          </Link>
          
          <div className="flex flex-col">
            <button 
              onClick={() => setIsCatalogOpen(!isCatalogOpen)}
              className={`p-4 rounded-xl font-black uppercase tracking-widest text-sm transition-colors flex items-center justify-between ${isActive('/catalog') ? 'text-primary' : 'text-slate-300 hover:bg-white/5'}`}
            >
              Каталог
              <ChevronDown className={`w-4 h-4 transition-transform ${isCatalogOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isCatalogOpen && (
              <div className="flex flex-col gap-1 pl-4 pb-2 animate-in slide-in-from-top-2 duration-200">
                <button 
                  onClick={async () => {
                    const id = await findRandomAnimeWithPlayer();
                    if (id) navigate(`/anime/${id}`);
                    setIsMenuOpen(false);
                  }}
                  className="p-3 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 text-left flex items-center gap-2"
                >
                  <Shuffle className="w-3 h-3" /> Случайное
                </button>
                <Link to="/catalog?status=ongoing" className="p-3 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 flex items-center gap-2">
                  <Crown className="w-3 h-3 text-green-500" /> Онгоинги
                </Link>
                <Link to="/catalog" className="p-3 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5">
                  Все аниме
                </Link>
              </div>
            )}
          </div>

          <Link to="/news" className={`p-4 rounded-xl font-black uppercase tracking-widest text-sm transition-colors ${isActive('/news') ? 'bg-primary text-white' : 'text-slate-300 hover:bg-white/5'}`}>
            Новости
          </Link>
          
          <Link to="/forum" className={`p-4 rounded-xl font-black uppercase tracking-widest text-sm transition-colors ${isActive('/forum') ? 'bg-primary text-white' : 'text-slate-300 hover:bg-white/5'}`}>
            Форум
          </Link>
        </nav>

        <div className="p-6 border-t border-white/5 bg-black/20">
          {user ? (
            <div className="flex flex-col gap-4">
              <Link to="/profile" className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors">
                <img src={user.avatar} className="w-10 h-10 rounded-lg object-cover" alt="" />
                <div>
                  <div className="font-bold text-white text-sm">{user.name}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Профиль</div>
                </div>
              </Link>
              <button 
                onClick={() => { logout(); setIsMenuOpen(false); }} 
                className="w-full py-3 bg-red-500/10 text-red-500 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-red-500 hover:text-white transition-all"
              >
                Выйти
              </button>
            </div>
          ) : (
            <button 
              onClick={() => { openAuthModal(); setIsMenuOpen(false); }} 
              className="w-full py-4 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              Войти в аккаунт
            </button>
          )}
        </div>
      </div>

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