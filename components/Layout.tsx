
import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { Menu, X, Search, MessageSquareText, Shuffle, Crown, ChevronDown, Bookmark, BookOpen, Gamepad2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import AuthModal from './AuthModal';
import { fetchAnimes, fetchAnimeDetails } from '../services/shikimori';
import { FALLBACK_IMAGE } from '../constants';
import { AIChatBot } from './AIChatBot';

import { useSlugBlocks } from '../store/slugBlocks';
import { useDmcaBlocks } from '../store/dmcaBlocks';

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
    }, true, 10); // Bypass queue and high priority for user-triggered random anime
    
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
  <div className={`flex items-center gap-2 select-none ${className}`}>
    <div className="w-9 h-9 bg-gradient-to-tr from-[#F47521] to-[#ff3c00] rounded-lg flex items-center justify-center text-white shadow-lg shadow-[#F47521]/20 hover:scale-105 transition-transform duration-300">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>
    </div>
    <div className="font-display text-[22px] font-black tracking-tighter text-white leading-none uppercase">
      KAMI<span className="text-[#F47521] font-black">ANIME</span>
    </div>
  </div>
);

const Layout: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const { user, logout, openAuthModal } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  
  // Crunchyroll Watchlist
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [showWatchlistDropdown, setShowWatchlistDropdown] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (user?.email) {
      db.getFavorites(user.email).then(async (ids) => {
        if (!ids || ids.length === 0) {
          if (isMounted) setWatchlist([]);
          return;
        }
        try {
          const promises = ids.slice(0, 5).map(id => fetchAnimeDetails(id.toString()));
          const results = await Promise.all(promises);
          if (isMounted) {
            setWatchlist(results.filter(a => a !== null));
          }
        } catch (e) {
          console.error("Layout watchlist error", e);
        }
      });
    } else {
      setWatchlist([]);
    }
    return () => { isMounted = false; };
  }, [user?.email, pathname]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 45) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = (path: string) => pathname === path;

  const { fetchSlugBlocks } = useSlugBlocks();
  const { dmcaBlocks, setDmcaBlocks } = useDmcaBlocks();

  useEffect(() => {
    fetchSlugBlocks();
    db.getDmcaBlocks().then(setDmcaBlocks).catch(console.error);
  }, [fetchSlugBlocks, setDmcaBlocks]);

  useEffect(() => {
    if (user?.email) {
      const updatePresence = async () => {
        if (document.visibilityState === 'visible') {
          await db.updateLastSeen(user.email);
        }
      };

      updatePresence();

      const interval = setInterval(() => {
        updatePresence();
      }, 60000); // Check every 60s
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [user?.email]);

  useEffect(() => {
    setIsMenuOpen(false);
    setShowSuggestions(false);
  }, [pathname]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const results = await fetchAnimes({ search: searchQuery, limit: 5 });
        setSuggestions(results);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/catalog?q=${encodeURIComponent(searchQuery)}`);
      setIsMenuOpen(false);
      setShowSuggestions(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark text-slate-200 font-sans selection:bg-primary/30">
      {(import.meta as any).env?.VITE_ENV === 'staging' && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black text-[10px] font-black uppercase tracking-widest text-center py-1 z-[100]">
          Staging Environment (Тестовый сервер)
        </div>
      )}
      <AuthModal />
      
      <header className={`fixed w-full z-50 transition-all duration-400 ${(import.meta as any).env?.VITE_ENV === 'staging' ? 'top-6' : 'top-0'} ${scrolled ? 'bg-[#040406]/95 backdrop-blur-2xl border-b border-white/5 shadow-2.5xl' : 'bg-gradient-to-b from-black/95 via-black/40 to-transparent'}`}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between h-20 gap-6">
            <Link to="/" aria-label="KamiAnime Home" className="hover:opacity-90 transition-opacity">
              <Logo />
            </Link>

            <div className="flex-1 hidden md:flex justify-center max-w-lg gap-3">
              <form onSubmit={handleSearch} className="relative w-full group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  aria-label="Поиск аниме"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Быстрый поиск..."
                  className="w-full h-10 pl-10 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:bg-white/10 focus:border-primary/50 focus:outline-none transition-all duration-300"
                />
                
                {/* Search Suggestions */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0a0f] border border-white/15 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-3 py-2">Результаты поиска</div>
                      {suggestions.map((anime) => {
                        const isDmcaBlocked = dmcaBlocks.includes(anime.id.toString());
                        return (
                        <Link
                          key={anime.id}
                          to={isDmcaBlocked ? `/anime/${anime.id}-watch` : `/anime/${anime.id}`}
                          className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition-colors group/item"
                          onClick={() => setShowSuggestions(false)}
                        >
                          <img 
                            src={anime.image} 
                            alt={anime.title} 
                            loading="lazy"
                            onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }}
                            className="w-9 h-12 object-cover rounded shadow-sm group-hover/item:scale-105 transition-transform" 
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-slate-200 group-hover/item:text-primary transition-colors truncate">{anime.title}</span>
                            <div className="flex items-center gap-2 text-[9px] font-extrabold uppercase text-slate-500 tracking-wider">
                              <span>
                                {anime.type === 'TV Series' ? 'TV' : 
                                 anime.type === 'Movie' ? 'Фильм' : 
                                 anime.type === 'Special' ? 'Спешл' : 
                                 anime.type === 'Music' ? 'Клип' : 
                                 anime.type}
                              </span>
                              <span className="w-0.5 h-0.5 rounded-full bg-slate-600"></span>
                              <span className="flex items-center gap-0.5 text-yellow-500"><Crown className="w-2.5 h-2.5" /> {anime.rating}</span>
                            </div>
                          </div>
                        </Link>
                      )})}
                    </div>
                  </div>
                )}
              </form>
              <button aria-label="Random anime"
                onClick={async () => {
                  const id = await findRandomAnimeWithPlayer();
                  if (id) navigate(`/anime/${id}`);
                }}
                className="p-2.5 bg-white/5 hover:bg-primary hover:text-white rounded-xl transition-all group shrink-0"
                title="Случайное аниме"
              >
                <Shuffle className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              </button>
            </div>

            <nav className="hidden lg:flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400 relative">
              <Link to="/" className={`${isActive('/') ? 'text-[#F47521]' : 'hover:text-white'} transition-all`}>Главная</Link>
              
              {/* Browse Dropdown */}
              <div 
                className="relative group py-2"
                onMouseEnter={() => setIsCatalogOpen(true)}
                onMouseLeave={() => setIsCatalogOpen(false)}
              >
                <button 
                  className={`flex items-center gap-1.5 ${isActive('/catalog') ? 'text-[#F47521]' : 'hover:text-white'} transition-all font-black uppercase`}
                >
                  Просмотр <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:rotate-180" />
                </button>
                {isCatalogOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-64 bg-[#141519]/95 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-150 z-50">
                    <div className="space-y-3">
                      <Link to="/catalog" className="block text-[10px] font-black uppercase tracking-wider text-slate-300 hover:text-[#F47521] transition-colors">Все Аниме</Link>
                      <Link to="/catalog?sort=popularity" className="block text-[10px] font-black uppercase tracking-wider text-slate-300 hover:text-[#F47521] transition-colors">Популярные</Link>
                      <Link to="/catalog?sort=new" className="block text-[10px] font-black uppercase tracking-wider text-slate-300 hover:text-[#F47521] transition-colors">Новинки Сезона</Link>
                      <Link to="/catalog?status=ongoing" className="block text-[10px] font-black uppercase tracking-wider text-slate-300 hover:text-[#F47521] transition-colors">Онгоинги</Link>
                      <div className="h-px bg-white/5 my-2" />
                      <div className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">Рекомендуемые жанры</div>
                      <Link to="/catalog?genre=Экшен" className="block text-[9px] font-bold text-slate-400 hover:text-white transition-colors">Экшен</Link>
                      <Link to="/catalog?genre=Комедия" className="block text-[9px] font-bold text-slate-400 hover:text-white transition-colors">Комедия</Link>
                      <Link to="/catalog?genre=Фэнтези" className="block text-[9px] font-bold text-slate-400 hover:text-white transition-colors">Фэнтези</Link>
                    </div>
                  </div>
                )}
              </div>

              <Link to="/manga" className={`${isActive('/manga') ? 'text-[#F47521]' : 'hover:text-white'} transition-all flex items-center gap-1`}><BookOpen className="w-3.5 h-3.5" /> Манга</Link>
              <Link to="/games" className={`${isActive('/games') ? 'text-[#F47521]' : 'hover:text-white'} transition-all flex items-center gap-1`}><Gamepad2 className="w-3.5 h-3.5" /> Игры</Link>
              <Link to="/news" className={`${isActive('/news') ? 'text-[#F47521]' : 'hover:text-white'} transition-all`}>Новости</Link>
              <Link to="/forum" className={`${isActive('/forum') ? 'text-[#F47521]' : 'hover:text-white'} transition-all`}>Форум</Link>
              <Link to="/community" className={`${isActive('/community') ? 'text-[#F47521]' : 'hover:text-white'} transition-all`}>Сообщество</Link>
              <Link to="/premium" className={`flex items-center gap-1.5 ${isActive('/premium') ? 'text-yellow-400' : 'text-yellow-500/80 hover:text-yellow-400'} transition-all animate-pulse`}>
                <Crown className="w-3.5 h-3.5 fill-current" /> Премиум
              </Link>
              
              {user?.role === 'admin' && (
                <Link to="/admin" className={`${isActive('/admin') ? 'text-red-500' : 'text-red-400 hover:text-red-300'} transition-all`}>Админ</Link>
              )}
            </nav>

            <div className="flex items-center gap-3 relative">
              {/* Watchlist Ribbon Hover Popover */}
              {user && (
                <div 
                  className="relative"
                  onMouseEnter={() => setShowWatchlistDropdown(true)}
                  onMouseLeave={() => setShowWatchlistDropdown(false)}
                >
                  <button 
                    aria-label="My Watchlist" 
                    className="p-2.5 bg-white/5 hover:bg-[#F47521] hover:text-black rounded-xl transition-all relative text-slate-300"
                  >
                    <Bookmark className="w-4.5 h-4.5" />
                    {watchlist.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#F47521] text-black text-[9px] font-black rounded-full flex items-center justify-center border-2 border-[#141519]">
                        {watchlist.length}
                      </span>
                    )}
                  </button>

                  {showWatchlistDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-80 bg-[#1c1d21] border border-white/10 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Моя лента (Очередь)</span>
                        <Link to="/profile" className="text-[9px] font-black uppercase text-[#F47521] hover:underline">Все</Link>
                      </div>

                      {watchlist.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-500">
                          Ваша очередь пуста. Добавьте аниме в закладки на страницах деталей.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                          {watchlist.map((anime) => (
                            <Link 
                              key={anime.id} 
                              to={`/anime/${anime.id}`}
                              className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl transition-colors group/watchlist-item"
                            >
                              <img src={anime.image} alt={anime.title} className="w-9 h-12 object-cover rounded shadow-md shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-black text-white truncate group-hover/watchlist-item:text-[#F47521] transition-colors">{anime.title}</div>
                                <div className="text-[9px] text-slate-500 font-extrabold uppercase">{anime.type || 'TV'} • {anime.episodes || '?'} эп</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {user && (
                <Link aria-label="Messages" to="/messages" title="Сообщения" className="p-2.5 bg-white/5 hover:bg-[#F47521] hover:text-black rounded-xl transition-all relative text-slate-300">
                   <MessageSquareText className="w-4.5 h-4.5" />
                </Link>
              )}
              {user ? (
                <div className="flex items-center gap-3">
                  <Link to="/profile" className="w-9 h-9 rounded-xl overflow-hidden ring-2 ring-[#F47521]/20 hover:ring-[#F47521] transition-all">
                    <img src={user.avatar} loading="lazy" alt="User" className="w-full h-full object-cover" />
                  </Link>
                  <button onClick={logout} className="text-[9px] font-black uppercase text-slate-500 hover:text-red-400 transition-colors tracking-widest hidden sm:block">Выйти</button>
                </div>
              ) : (
                <button onClick={openAuthModal} className="h-10 px-6 bg-[#F47521] hover:bg-[#ff863b] text-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-[#F47521]/15 hover:scale-102 active:scale-95">
                  Войти
                </button>
              )}
              <button aria-label="Toggle menu" className="md:hidden text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
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
          <button aria-label="Close menu" onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
        
        <div className="px-6 py-4">
          <form onSubmit={handleSearch} className="relative w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              aria-label="Поиск аниме"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Найти аниме..."
              className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:bg-white focus:text-slate-900 focus:outline-none transition-all duration-500 shadow-inner"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-2">
                  {suggestions.map((anime) => {
                    const isDmcaBlocked = dmcaBlocks.includes(anime.id.toString());
                    return (
                    <Link
                      key={anime.id}
                      to={isDmcaBlocked ? `/anime/${anime.id}-watch` : `/anime/${anime.id}`}
                      className="flex items-center gap-4 p-2 hover:bg-white/5 rounded-xl transition-colors group/item"
                      onClick={() => { setShowSuggestions(false); setIsMenuOpen(false); }}
                    >
                      <img src={anime.image} alt={anime.title} className="w-10 h-14 object-cover rounded-lg" />
                      <span className="text-sm font-bold text-slate-200 truncate">{anime.title}</span>
                    </Link>
                  )})}
                </div>
              </div>
            )}
          </form>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-6 flex flex-col gap-2">
          <Link to="/" className={`p-4 rounded-xl font-black uppercase tracking-widest text-sm transition-colors ${isActive('/') ? 'bg-[#F47521] text-black' : 'text-slate-300 hover:bg-white/5'}`}>
            Главная
          </Link>
          
          <div className="flex flex-col">
            <button 
              onClick={() => setIsCatalogOpen(!isCatalogOpen)}
              className={`p-4 rounded-xl font-black uppercase tracking-widest text-sm transition-colors flex items-center justify-between ${isActive('/catalog') ? 'text-[#F47521]' : 'text-slate-300 hover:bg-white/5'}`}
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
                  <Crown className="w-3 h-3 text-[#F47521]" /> Онгоинги
                </Link>
                <Link to="/catalog" className="p-3 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5">
                  Все аниме
                </Link>
              </div>
            )}
          </div>

          <Link to="/manga" className={`p-4 rounded-xl font-black uppercase tracking-widest text-sm transition-colors ${isActive('/manga') ? 'bg-[#F47521] text-black' : 'text-slate-300 hover:bg-white/5'}`}>
            Манга
          </Link>

          <Link to="/games" className={`p-4 rounded-xl font-black uppercase tracking-widest text-sm transition-colors ${isActive('/games') ? 'bg-[#F47521] text-black' : 'text-slate-300 hover:bg-white/5'}`}>
            Игры
          </Link>

          <Link to="/news" className={`p-4 rounded-xl font-black uppercase tracking-widest text-sm transition-colors ${isActive('/news') ? 'bg-[#F47521] text-black' : 'text-slate-300 hover:bg-white/5'}`}>
            Новости
          </Link>
          
          <Link to="/forum" className={`p-4 rounded-xl font-black uppercase tracking-widest text-sm transition-colors ${isActive('/forum') ? 'bg-[#F47521] text-black' : 'text-slate-300 hover:bg-white/5'}`}>
            Форум
          </Link>

          <Link to="/community" className={`p-4 rounded-xl font-black uppercase tracking-widest text-sm transition-colors ${isActive('/community') ? 'bg-[#F47521] text-black' : 'text-slate-300 hover:bg-white/5'}`}>
            Сообщество
          </Link>
          
          {user?.role === 'admin' && (
            <Link to="/admin" className={`p-4 rounded-xl font-black uppercase tracking-widest text-sm transition-colors ${isActive('/admin') ? 'bg-red-500 text-white' : 'text-red-400 hover:bg-white/5'}`}>
              Админ-панель
            </Link>
          )}
        </nav>

        <div className="p-6 border-t border-white/5 bg-black/20">
          {user ? (
            <div className="flex flex-col gap-4">
              <Link to="/profile" className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors">
                <img src={user.avatar} loading="lazy" className="w-10 h-10 rounded-lg object-cover" alt="" />
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

      <main className={`flex-grow ${(import.meta as any).env?.VITE_ENV === 'staging' ? 'pt-28' : 'pt-20'}`}>
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
                <li><Link to="/news" className="hover:text-primary transition-colors">Новости</Link></li>
                <li><Link to="/forum" className="hover:text-primary transition-colors">Форум</Link></li>
                <li><Link to="/community" className="hover:text-primary transition-colors">Сообщество</Link></li>
                <li><Link to="/profile" className="hover:text-primary transition-colors">Личный кабинет</Link></li>
                <li>
                  <a href="https://t.me/kamianimeclub" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-2 text-blue-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                    Telegram
                  </a>
                </li>
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
            <p>© {new Date().getFullYear()} KamiAnime Project. Все права защищены.</p>
            <div className="flex gap-8 items-center">
              <Link to="/terms" className="hover:text-white transition-colors">Правила</Link>
              <Link to="/privacy" className="hover:text-white transition-colors">Конфиденциальность</Link>
            </div>
          </div>
        </div>
      </footer>
      <AIChatBot />
    </div>
  );
};

export default Layout;