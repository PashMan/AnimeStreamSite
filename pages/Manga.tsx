import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Star, Sparkles, ArrowLeft, ChevronRight, ChevronLeft, Heart, Search, Loader2, ShieldAlert, BookX, ChevronDown, Layers, Settings, AlignJustify } from 'lucide-react';
import SEO from '../components/SEO';
import { useAuth } from '../context/AuthContext';

interface MangaItem {
  id: string;
  title: string;
  originalTitle: string;
  rating: number;
  chapters: number;
  genres: string[];
  status: string;
  description: string;
  cover: string;
  isPremium?: boolean;
}

interface ChapterItem {
  id: string;
  chapter: string;
  volume: string;
  title: string;
  group: string;
  publishAt: string;
}

const Manga: React.FC = () => {
  const { user } = useAuth();
  const [mangas, setMangas] = useState<MangaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [selectedManga, setSelectedManga] = useState<MangaItem | null>(null);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState<boolean>(false);
  const [isMangaLicensed, setIsMangaLicensed] = useState<boolean>(false);
  const [readerMode, setReaderMode] = useState<'pages' | 'scroll'>('scroll'); // Default to popular vertical continuous scroll
  
  const [activeChapter, setActiveChapter] = useState<ChapterItem | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [pagesLoading, setPagesLoading] = useState<boolean>(false);
  
  const [mangaReaderPage, setMangaReaderPage] = useState<number>(0);
  const [favorites, setFavorites] = useState<string[]>([]);

  // Mangalib detail panel state definitions
  const [activeDetailTab, setActiveDetailTab] = useState<'info' | 'chapters' | 'comments'>('info');
  const [bookmarkCategory, setBookmarkCategory] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('kami_manga_bookmarks');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [isBookmarkDropdownOpen, setIsBookmarkDropdownOpen] = useState<boolean>(false);
  const [mangaComments, setMangaComments] = useState<Record<string, {id: string, user: string, text: string, date: string}[]>>(() => {
    try {
      const saved = localStorage.getItem('kami_manga_comments_db');
      return saved ? JSON.parse(saved) : {
        "manga-1": [
          { id: "1", user: "KamiZoldyck", text: "Шедевр! Обожаю рисовку автора, перевод здесь просто потрясающий.", date: "12.06.2026" },
          { id: "2", user: "SaitamaFan", text: "Наконец-то нашел этот тайтл в хорошем качестве на русском! Буду читать всю ночь.", date: "11.06.2026" }
        ],
        "default": [
          { id: "1", user: "MangaCritic", text: "Прекрасный тайтл, сюжет затягивает с первых страниц! Рекомендую в режиме Свиток.", date: "10.06.2026" }
        ]
      };
    } catch {
      return {};
    }
  });
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [chapterSearchQuery, setChapterSearchQuery] = useState<string>('');

  const updateBookmarkCategory = (mangaId: string, category: string) => {
    const updated = { ...bookmarkCategory, [mangaId]: category };
    setBookmarkCategory(updated);
    localStorage.setItem('kami_manga_bookmarks', JSON.stringify(updated));
    setIsBookmarkDropdownOpen(false);
  };

  const addComment = (mangaId: string) => {
    if (!newCommentText.trim()) return;
    const commentObj = {
      id: Date.now().toString(),
      user: user?.username || user?.email?.split('@')[0] || "Гость-Ками",
      text: newCommentText,
      date: new Date().toLocaleDateString('ru-RU')
    };
    const currentMangaComments = mangaComments[mangaId] || [];
    const updatedComments = {
      ...mangaComments,
      [mangaId]: [commentObj, ...currentMangaComments]
    };
    setMangaComments(updatedComments);
    localStorage.setItem('kami_manga_comments_db', JSON.stringify(updatedComments));
    setNewCommentText('');
  };

  // Toggle favorites locally
  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Fetch titles from our backend Hono proxy
  const fetchMangas = async (query = '') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/manga/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setMangas(data.results || []);
      }
    } catch (e) {
      console.error("Failed to fetch mangas", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMangas();
  }, []);

  // Set selected manga and load its chapter list
  const selectMangaItem = async (manga: MangaItem) => {
    setSelectedManga(manga);
    setActiveDetailTab('info');
    setIsBookmarkDropdownOpen(false);
    setChapterSearchQuery('');
    setChapters([]);
    setIsMangaLicensed(false);
    setChaptersLoading(true);
    try {
      const res = await fetch(`/api/manga/${manga.id}/chapters`);
      if (res.ok) {
        const data = await res.json();
        setChapters(data.chapters || []);
        setIsMangaLicensed(!!data.isLicensed);
      }
    } catch (e) {
      console.error("Failed to load chapters", e);
    } finally {
      setChaptersLoading(false);
    }
  };

  // Trigger loading pages for a Russian chapter
  const startReadingChapter = async (chapterObj: ChapterItem) => {
    // Check fictional simulated Premium tier
    if (selectedManga?.isPremium && !user?.isPremium) {
      alert('Чтение Глав этой премиум-манги временно доступно только подписчикам Premium! Пожалуйста, оформите пробную подписку для продолжения.');
      return;
    }
    setActiveChapter(chapterObj);
    setPages([]);
    setMangaReaderPage(0);
    setPagesLoading(true);
    try {
      const res = await fetch(`/api/manga/chapter/${chapterObj.id}/pages`);
      if (res.ok) {
        const data = await res.json();
        setPages(data.pages || []);
      }
    } catch (e) {
      console.error("Failed to load chapter pages", e);
    } finally {
      setPagesLoading(false);
    }
  };

  return (
    <div className="bg-[#141519] min-h-screen text-slate-100 pb-24 font-sans select-none">
      <SEO 
        title="Читать Мангу Онлайн Полноэкранно - Crunchyroll"
        description="Эксклюзивная подборка манги на русском языке. Читайте популярные комиксы без рекламы и в премиум-интерфейсе."
      />

      {/* Premium Manga Banner */}
      <div className="bg-gradient-to-r from-primary/15 via-[#141519]/90 to-[#141519] border-b border-white/5 py-10 px-4 sm:px-8 lg:px-12">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="px-3 py-1 bg-primary text-xs font-black uppercase tracking-wider rounded-md text-white flex items-center gap-1.5 w-fit">
              <BookOpen className="w-3.5 h-3.5" /> Читальня KamiAnime
            </span>
            <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight">
              Лицензионная Манга
            </h1>
            <p className="text-slate-400 font-medium text-sm md:text-base max-w-2xl">
              Официальный сервис лицензионных цифровых томов на русском языке. Наслаждайтесь потрясающим кадрированием и переводом одновременно с выходом релизов в Японии.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 mt-12">
        
        {/* Prominent Site Mode Switcher Widget */}
        <div className="w-full bg-[#1c1d22]/80 backdrop-blur-md border border-white/5 rounded-3xl p-5 md:p-6 mb-8 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative group/switcher animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="absolute top-0 right-0 w-80 h-40 bg-[#FF5C00]/5 blur-[80px] rounded-full pointer-events-none transition-all duration-700" />
          <div className="relative z-10 space-y-1 text-center md:text-left">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#FF5C00] flex items-center justify-center md:justify-start gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5" /> ПОРТАЛЫ KAMIANIME
            </div>
            <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tight">
              Вы находитесь на Манга Портале
            </h3>
            <p className="text-xs text-slate-400 font-medium max-w-lg">
              Хотите посмотреть аниме онлайн бесплатно в хорошем качестве? Переключите сайт на режим «Ками-Аниме» в один клик!
            </p>
          </div>
          
          <div className="flex bg-black/45 border border-white/5 rounded-2xl p-1.5 w-full md:w-auto shrink-0 relative z-10">
            <button
              onClick={() => {
                if (window.location.hostname.includes('kamianime.club')) {
                  window.location.href = 'https://kamianime.club/';
                } else {
                  localStorage.removeItem('kami_manga_mode');
                  window.location.reload();
                }
              }}
              className="flex-grow md:flex-grow-0 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 text-slate-400 hover:text-white transition-all hover:bg-white/5 select-none cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>
              <span>Аниме Онлайн</span>
            </button>
            <button
              className="flex-grow md:flex-grow-0 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all bg-[#FF5C00] text-white shadow-lg shadow-[#FF5C00]/10 select-none cursor-default"
            >
              <BookOpen className="w-4 h-4 text-white" />
              <span>Читать Мангу</span>
            </button>
          </div>
        </div>
        
        {/* Collection Grid Header with Search Functionality */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 mt-12 pb-4 border-b border-white/5">
          <h2 className="text-xl font-black uppercase tracking-widest text-slate-400 flex items-center gap-2.5">
            <span className="w-1.5 h-6 bg-primary rounded-full inline-block animate-pulse" /> Наша коллекция манги
          </h2>
          
          {/* Quick Search Input */}
          <div className="relative w-full md:w-80 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Поиск манги на русском..."
                className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/10 hover:border-primary/50 focus:border-primary rounded-2xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetchMangas(searchQuery);
                  }
                }}
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button 
              onClick={() => fetchMangas(searchQuery)}
              className="px-4 py-3 bg-primary/20 hover:bg-primary text-primary hover:text-white transition-all text-xs font-black uppercase tracking-widest rounded-2xl border border-primary/30"
            >
              Найти
            </button>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-500 animate-pulse">
              Поиск тайтлов в MangaDex...
            </span>
          </div>
        ) : mangas.length === 0 ? (
          <div className="py-24 text-center text-slate-500 font-extrabold text-sm uppercase tracking-widest">
            Ничего не найдено. Попробуйте написать по-английски или по-русски!
          </div>
        ) : (
          /* Manga bento shelf */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
            {mangas.map((manga, idx) => {
              const isFaved = favorites.includes(manga.id);
              // Artificially tag every third manga as Premium for visual style variety
              const isPremium = idx % 3 === 0;
              return (
                <div 
                  key={manga.id}
                  onClick={() => selectMangaItem(manga)}
                  className="group cursor-pointer bg-[#23252b] border border-white/5 rounded-2xl overflow-hidden hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10 flex flex-col justify-between transition-all duration-300"
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden">
                    <img 
                      src={manga.cover} 
                      alt={manga.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/45 opacity-70 group-hover:opacity-90 transition-opacity" />

                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className="p-1 px-2.5 bg-black/50 backdrop-blur-md rounded-lg text-[9px] text-slate-300 font-extrabold uppercase tracking-wider border border-white/5">
                        {manga.status}
                      </span>
                      {isPremium && (
                        <span className="p-1 px-2.5 bg-primary rounded-lg text-[9px] text-white font-extrabold uppercase tracking-wider shadow-sm flex items-center gap-1">
                          <Sparkles className="w-3 h-3 fill-current text-white animate-spin" style={{ animationDuration: '4s' }} /> PREMIUM
                        </span>
                      )}
                    </div>

                    <button 
                      onClick={(e) => toggleFavorite(manga.id, e)}
                      className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-primary text-white hover:text-black transition-all shadow-md active:scale-90"
                    >
                      <Heart className={`w-4 h-4 ${isFaved ? 'fill-current text-primary' : ''}`} />
                    </button>

                    {/* Hover stats overlay */}
                    <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between">
                      <span className="text-xs font-black text-white bg-black/60 px-2.5 py-1 rounded-lg backdrop-blur-md border border-white/5 flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500 fill-current" /> {manga.rating}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 space-y-2 flex-grow flex flex-col justify-between">
                    <div className="space-y-1">
                      <h3 className="font-extrabold text-primary uppercase text-[10px] tracking-widest truncate">
                        {manga.originalTitle}
                      </h3>
                      <h4 className="font-black text-lg text-white group-hover:text-primary transition-colors leading-snug line-clamp-1">
                        {manga.title}
                      </h4>
                      <p className="text-slate-400 text-xs font-medium leading-relaxed line-clamp-2">
                        {manga.description}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-3">
                      {manga.genres.map(genre => (
                        <span key={genre} className="px-2 py-0.5 bg-white/5 rounded-md text-[9px] font-extrabold uppercase text-slate-400">
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manga Detail overlay */}
      <AnimatePresence>
        {selectedManga && activeChapter === null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#121316] border border-white/5 w-full max-w-6xl rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-2xl relative my-4 sm:my-8"
            >
              {/* Top cover header background blur */}
              <div className="absolute top-0 left-0 right-0 h-48 sm:h-64 overflow-hidden -z-10 opacity-20 pointer-events-none">
                <img src={selectedManga.cover} alt="" className="w-full h-full object-cover blur-2xl scale-125" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#121316]" />
              </div>

              {/* Close Button */}
              <button 
                onClick={() => setSelectedManga(null)}
                className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2.5 sm:p-3 bg-[#1c1d21]/80 hover:bg-[#FF5C00] hover:text-white rounded-xl text-white transition-all active:scale-95 z-50 shadow-md border border-white/5 backdrop-blur-md"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-10 p-4 sm:p-8 md:p-10">
                {/* Visual Cover + List Actions (LEFT COLUMN - Mangalib style) */}
                <div className="col-span-1 md:col-span-4 space-y-4 sm:space-y-6">
                  <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/5 group">
                    <img 
                      src={selectedManga.cover} 
                      alt={selectedManga.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 px-2 py-1 bg-black/75 backdrop-blur-md border border-white/5 rounded-md text-[9px] font-black uppercase text-[#FF5C00] tracking-wider">
                      {selectedManga.status}
                    </div>
                  </div>

                  {/* Read Launcher */}
                  <button
                    onClick={() => {
                      if (chapters.length > 0) {
                        // Start standard reading from the oldest chapter (usually at the end is oldest, but let's select the first readable chapter)
                        startReadingChapter(chapters[chapters.length - 1] || chapters[0]);
                      } else {
                        alert('Главы временно не загружены. Пожалуйста, подождите или перезагрузите страницу.');
                      }
                    }}
                    disabled={chaptersLoading}
                    className="w-full py-3.5 sm:py-4 bg-[#FF5C00] text-white hover:bg-[#ff6c1a] disabled:opacity-50 text-xs sm:text-sm font-black uppercase tracking-wider rounded-xl shadow-lg shadow-[#FF5C00]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-pulse" />
                    <span>{chaptersLoading ? 'Поиск глав...' : 'Начать чтение'}</span>
                  </button>

                  {/* Bookmark Selector Dropdown (Highly Detailed Like Mangalib) */}
                  <div className="relative">
                    <button
                      onClick={() => setIsBookmarkDropdownOpen(prev => !prev)}
                      className="w-full py-3 px-4 bg-[#23252b] hover:bg-[#2c2e36] text-slate-200 border border-white/5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Heart className={`w-4 h-4 ${bookmarkCategory[selectedManga.id] ? 'fill-current text-[#FF5C00]' : ''}`} />
                        <span>{bookmarkCategory[selectedManga.id] ? `В закладках: ${bookmarkCategory[selectedManga.id]}` : 'Добавить в закладки'}</span>
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${isBookmarkDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isBookmarkDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-2 bg-[#1c1d21] border border-white/10 rounded-xl p-1.5 shadow-2xl z-50 space-y-1 select-none animate-in fade-in slide-in-from-top-1 duration-150">
                        {['Читаю', 'Хочу прочитать', 'Прочитано', 'Любимое', 'Отложено', 'Брошено'].map((cat) => (
                          <button
                            key={cat}
                            onClick={() => updateBookmarkCategory(selectedManga.id, cat)}
                            className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all hover:bg-white/5 ${
                              bookmarkCategory[selectedManga.id] === cat 
                                ? 'text-[#FF5C00] bg-[#FF5C00]/10' 
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                        {bookmarkCategory[selectedManga.id] && (
                          <div className="border-t border-white/5 pt-1.5 mt-1">
                            <button
                              onClick={() => {
                                const current = { ...bookmarkCategory };
                                delete current[selectedManga.id];
                                setBookmarkCategory(current);
                                localStorage.setItem('kami_manga_bookmarks', JSON.stringify(current));
                                setIsBookmarkDropdownOpen(false);
                              }}
                              className="w-full text-left px-3.5 py-2 text-[10px] font-black uppercase text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                            >
                              Удалить из закладок
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Title Score Rating Card */}
                  <div className="bg-[#1c1d21] p-4 rounded-xl border border-white/5 space-y-3.5 select-none">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Оценка Mangalib</span>
                      <span className="text-[10px] text-slate-500 font-bold">{chaptersLoading ? 'синхронизация...' : '9.6 / 10'}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-3xl font-black text-white flex items-baseline gap-1">
                        <span>{selectedManga.rating}</span>
                        <span className="text-xs text-slate-500 font-extrabold">/10</span>
                      </div>
                      <div className="flex-grow flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star 
                              key={i} 
                              className={`w-3.5 h-3.5 ${
                                i < Math.floor(selectedManga.rating / 2) 
                                  ? 'text-yellow-400 fill-current' 
                                  : 'text-slate-600'
                              }`} 
                            />
                          ))}
                        </div>
                        <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Голосов: 12,410</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info and chapters panel (RIGHT COLUMN - Mangalib style) */}
                <div className="col-span-1 md:col-span-8 flex flex-col space-y-6">
                  {/* Header Meta Titles */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="px-2 py-0.5 bg-[#FF5C00]/15 text-[#FF5C00] text-[9px] font-black uppercase tracking-wider rounded border border-[#FF5C00]/30">
                        Манга Портал
                      </span>
                      <span className="px-2 py-0.5 bg-red-500/15 text-red-400 text-[9px] font-black uppercase tracking-wider rounded border border-red-500/20">
                        16+ ценз
                      </span>
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                      {selectedManga.title}
                    </h2>
                    <h3 className="text-sm sm:text-base font-bold text-slate-400 uppercase tracking-wide">
                      {selectedManga.originalTitle}
                    </h3>
                  </div>

                  {/* Mangalib-style Tab switcher */}
                  <div className="flex border-b border-white/5 relative z-10 select-none overflow-x-auto hide-scrollbar shrink-0">
                    {[
                      { id: 'info', label: 'Описание' },
                      { id: 'chapters', label: `Главы (${chaptersLoading ? '...' : chapters.length})` },
                      { id: 'comments', label: `Обсуждение (${(mangaComments[selectedManga.id] || mangaComments["default"] || []).length})` }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveDetailTab(tab.id as any)}
                        className={`px-6 py-4 text-xs sm:text-sm font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                          activeDetailTab === tab.id
                            ? 'border-[#FF5C00] text-white bg-white/5 rounded-t-xl'
                            : 'border-transparent text-slate-400 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab Contents */}
                  <div className="flex-grow">
                    {activeDetailTab === 'info' && (
                      <div className="space-y-6 animate-in fade-in duration-200">
                        {/* Summary Synopsis */}
                        <div className="space-y-2.5">
                          <h4 className="text-[10px] font-black text-[#FF5C00] uppercase tracking-widest border-l-2 border-[#FF5C00] pl-2">Аннотация / Описание</h4>
                          <p className="text-slate-300 text-sm leading-relaxed font-medium">
                            {selectedManga.description || "К этому произведению пока нет русского описания. Вы можете загрузить тома, чтобы прочитать первый перевод глав."}
                          </p>
                        </div>

                        {/* Attribute Data Table (Mangalib specification standard) */}
                        <div className="space-y-3 pt-2">
                          <h4 className="text-[10px] font-black text-[#FF5C00] uppercase tracking-widest border-l-2 border-[#FF5C00] pl-2">Информация о тайтле</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 bg-[#1c1d21]/40 border border-white/5 p-5 rounded-2xl">
                            <div className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                              <span className="text-slate-500 font-extrabold uppercase">Тип тайтла</span>
                              <span className="text-slate-200 font-bold">Манга (Япония)</span>
                            </div>
                            <div className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                              <span className="text-slate-500 font-extrabold uppercase">Год релиза</span>
                              <span className="text-slate-200 font-bold">{selectedManga.genres.includes('Сёнен') ? "2020" : "2022"}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                              <span className="text-slate-500 font-extrabold uppercase">Статус тайтла</span>
                              <span className={`font-black uppercase tracking-wider text-[10px] ${selectedManga.status === 'Ongoing' || selectedManga.status === 'Publishing' ? 'text-green-400' : 'text-slate-400'}`}>
                                {selectedManga.status === 'Ongoing' || selectedManga.status === 'Publishing' ? 'Онгоинг' : 'Завершен'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                              <span className="text-slate-500 font-extrabold uppercase">Перевод</span>
                              <span className="text-[#FF5C00] font-black uppercase tracking-wider text-[10px]">Продолжается</span>
                            </div>
                            <div className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                              <span className="text-slate-500 font-extrabold uppercase">Автор</span>
                              <span className="text-slate-200 font-bold truncate max-w-[140px]">Разные авторы</span>
                            </div>
                            <div className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                              <span className="text-slate-500 font-extrabold uppercase">Художник</span>
                              <span className="text-slate-200 font-bold truncate max-w-[140px]">Издательский синдикат</span>
                            </div>
                          </div>
                        </div>

                        {/* Genres block list */}
                        <div className="space-y-2.5 pt-2">
                          <h4 className="text-[10px] font-black text-[#FF5C00] uppercase tracking-widest border-l-2 border-[#FF5C00] pl-2">Теги и жанры</h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedManga.genres.map(genre => (
                              <span 
                                key={genre} 
                                className="px-3.5 py-1.5 bg-[#23252b] border border-white/5 text-slate-300 hover:text-[#FF5C00] hover:border-[#FF5C00]/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all select-none cursor-not-allowed"
                              >
                                {genre}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeDetailTab === 'chapters' && (
                      <div className="space-y-4 animate-in fade-in duration-200 select-none">
                        {/* Search and filters for chapters list */}
                        <div className="relative">
                          <input 
                            type="text" 
                            placeholder="Фильтр по главе или названию... (напр. 1, 2)"
                            className="w-full pl-10 pr-4 py-3 bg-[#1c1d21]/60 border border-white/10 focus:border-[#FF5C00] rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none transition-all outline-none"
                            value={chapterSearchQuery}
                            onChange={(e) => setChapterSearchQuery(e.target.value)}
                          />
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        </div>

                        {chaptersLoading ? (
                          <div className="py-12 flex flex-col items-center justify-center">
                            <Loader2 className="w-8 h-8 text-[#FF5C00] animate-spin mb-3" />
                            <span className="text-xs font-black uppercase text-slate-500 tracking-widest">
                              Синхронизация глав с серверами...
                            </span>
                          </div>
                        ) : (() => {
                          const filteredChapters = chapters.filter(ch => 
                            ch.chapter.toLowerCase().includes(chapterSearchQuery.toLowerCase()) || 
                            (ch.title && ch.title.toLowerCase().includes(chapterSearchQuery.toLowerCase())) ||
                            (ch.group && ch.group.toLowerCase().includes(chapterSearchQuery.toLowerCase()))
                          );

                          return filteredChapters.length === 0 ? (
                            isMangaLicensed ? (
                              <div className="py-8 px-6 text-center border-2 border-red-500/20 bg-red-500/5 text-slate-300 text-sm font-bold uppercase tracking-wider rounded-2xl flex flex-col items-center gap-3">
                                <ShieldAlert className="w-10 h-10 text-red-500 animate-pulse" />
                                <div className="font-black text-red-500 text-base">Лицензировано правообладателем</div>
                                <div className="text-[11px] text-slate-400 normal-case font-semibold max-w-md leading-relaxed">
                                  К сожалению, данный тайтл был официально лицензирован на территории РФ, правообладатель ограничил доступ к чтению через внешние зеркала. Ознакомьтесь с другими тайтлами.
                                </div>
                              </div>
                            ) : (
                              <div className="py-8 px-6 text-center border border-white/5 border-dashed rounded-2xl flex flex-col items-center gap-3">
                                <BookX className="w-10 h-10 text-slate-600" />
                                <div className="font-extrabold text-slate-500">Главы не найдены</div>
                                <span className="text-[10px] text-slate-500 normal-case font-semibold max-w-sm">
                                  Ничего не совпало с запросом. Попробуйте написать числовое значение главы.
                                </span>
                              </div>
                            )
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
                              {filteredChapters.map((ch) => (
                                <button
                                  key={ch.id}
                                  onClick={() => startReadingChapter(ch)}
                                  className="p-4 bg-[#1c1d21]/60 border border-white/5 rounded-xl hover:border-[#FF5C00] hover:bg-[#FF5C00]/10 text-left transition-all active:scale-[0.98] group/chapter flex items-center justify-between cursor-pointer"
                                >
                                  <div className="min-w-0 pr-2">
                                    <div className="text-[9px] font-extrabold uppercase text-[#FF5C00] truncate">
                                      {ch.group || "MangaDex Team"}
                                    </div>
                                    <div className="text-sm font-black text-white">Глава {ch.chapter}</div>
                                    <div className="text-[11px] text-slate-400 font-semibold truncate">
                                      {ch.title || `Глава ${ch.chapter}`}
                                    </div>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover/chapter:text-[#FF5C00] transition-transform group-hover/chapter:translate-x-1 shrink-0" />
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {activeDetailTab === 'comments' && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        {/* Add comment feedback form */}
                        <div className="bg-[#1c1d21]/40 border border-white/5 p-4 rounded-xl space-y-3">
                          <textarea 
                            rows={3}
                            placeholder="Напишите ваш отзыв или впечатление о главе..."
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            className="w-full bg-[#121316] border border-white/10 hover:border-white/20 focus:border-[#FF5C00] rounded-xl p-3.5 text-xs font-bold text-white placeholder-slate-500 focus:outline-none transition-all outline-none resize-none"
                          />
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Авторизован как: {user?.username || user?.email?.split('@')[0] || "Гость"}</span>
                            <button 
                              onClick={() => addComment(selectedManga.id)}
                              className="px-4.5 py-2.5 bg-[#FF5C00] hover:bg-[#ff6c1a] text-white font-black uppercase text-[10px] tracking-widest rounded-lg shadow-md transition-all active:scale-95"
                            >
                              Отправить отзыв
                            </button>
                          </div>
                        </div>

                        {/* Comments list feed */}
                        <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                          {((mangaComments[selectedManga.id] || []).length > 0 
                            ? mangaComments[selectedManga.id] 
                            : (mangaComments["default"] || [])
                          ).map((comment) => (
                            <div key={comment.id} className="p-4 bg-[#1c1d21]/40 border border-white/5 rounded-xl space-y-2">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="font-extrabold text-[#FF5C00] flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 bg-[#FF5C00] rounded-full inline-block animate-pulse" />
                                  {comment.user}
                                </span>
                                <span className="text-slate-500 font-semibold">{comment.date}</span>
                              </div>
                              <p className="text-slate-300 text-xs font-medium leading-relaxed">
                                {comment.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Manga Page reader (Mangalib-inspired) */}
      <AnimatePresence>
        {selectedManga && activeChapter !== null && (() => {
          const activeIndex = chapters.findIndex(c => c.id === activeChapter.id);
          const prevChapter = activeIndex > 0 ? chapters[activeIndex - 1] : null;
          const nextChapter = activeIndex < chapters.length - 1 ? chapters[activeIndex + 1] : null;

          return (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#0a0a0c] z-[125] flex flex-col justify-between overflow-hidden"
            >
              {/* Top Control Toolbar */}
              <div className="bg-[#121316] px-4 py-3 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 z-50 shadow-md">
                <div className="flex items-center gap-3 min-w-0">
                  <button 
                    onClick={() => { setActiveChapter(null); setMangaReaderPage(0); }}
                    className="p-2.5 bg-white/5 text-slate-300 hover:text-[#FF5C00] hover:bg-white/10 rounded-xl transition-all shrink-0 cursor-pointer"
                    title="Назад к деталям"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-[10px] text-[#FF5C00] uppercase tracking-wider truncate max-w-[140px] md:max-w-[200px]">
                      {selectedManga.title}
                    </h3>
                    
                    {/* Chapter Select dropdown */}
                    <div className="relative inline-block text-left mt-0.5 group/chdrop select-none">
                      <button className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-white hover:text-[#FF5C00] transition-colors focus:outline-none">
                        <span>Глава {activeChapter.chapter}</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Dropdown element */}
                      <div className="absolute left-0 top-full mt-2 w-64 bg-[#18191d] border border-white/10 rounded-2xl p-2 shadow-2xl overflow-hidden hidden group-hover/chdrop:block hover:block z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="text-[9px] font-black tracking-wider text-slate-500 uppercase px-3 py-1.5 border-b border-white/5">
                          Перейти к главе
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1 space-y-0.5 mt-1">
                          {chapters.map((ch) => (
                            <button
                              key={ch.id}
                              onClick={() => startReadingChapter(ch)}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex flex-col ${
                                ch.id === activeChapter.id
                                  ? "bg-[#FF5C00] text-white"
                                  : "text-slate-300 hover:bg-white/5 hover:text-white"
                              }`}
                            >
                              <span>Глава {ch.chapter}</span>
                              <span className="text-[9px] opacity-75 truncate">{ch.title || 'Оглавление'}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chapter Navigation controls */}
                <div className="flex items-center gap-2 select-none">
                  {/* Prev chapter */}
                  <button
                    disabled={!prevChapter}
                    onClick={() => prevChapter && startReadingChapter(prevChapter)}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-wider text-slate-300 hover:text-[#FF5C00] disabled:opacity-20 disabled:hover:text-slate-300 disabled:hover:bg-white/5 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Пред.</span>
                  </button>

                  {/* Mode switcher tab controls (Pages vs Continuous vertical scroll) */}
                  <div className="bg-black/45 border border-white/5 rounded-xl p-0.5 flex">
                    <button
                      onClick={() => setReaderMode('pages')}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        readerMode === 'pages'
                          ? 'bg-[#FF5C00] text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Постранично
                    </button>
                    <button
                      onClick={() => setReaderMode('scroll')}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        readerMode === 'scroll'
                          ? 'bg-[#FF5C00] text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Свиток
                    </button>
                  </div>

                  {/* Next chapter */}
                  <button
                    disabled={!nextChapter}
                    onClick={() => nextChapter && startReadingChapter(nextChapter)}
                    className="px-3 py-2 bg-[#FF5C00]/10 hover:bg-[#FF5C00]/20 text-xs font-black uppercase tracking-wider text-[#FF5C00] disabled:opacity-20 disabled:hover:bg-[#FF5C00]/10 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span className="hidden sm:inline">След.</span> <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Reader canvas space */}
              {pagesLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#0e0f11]">
                  <Loader2 className="w-12 h-12 text-[#FF5C00] animate-spin mb-4" />
                  <span className="text-sm font-black uppercase text-slate-400 tracking-widest animate-pulse">
                    Загрузка страниц главы {activeChapter.chapter}...
                  </span>
                </div>
              ) : pages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#0e0f11]">
                  <BookOpen className="w-16 h-16 text-slate-600 mb-4" />
                  <h3 className="text-lg font-black text-white">Страницы не получены</h3>
                  <p className="text-xs text-slate-500 mt-2 max-w-sm font-medium">не удалось получить изображения с серверов MangaDex. Пожалуйста, сотрите кэш или попробуйте другую главу.</p>
                </div>
              ) : readerMode === 'scroll' ? (
                /* Mode A: CONTINUOUS VERTICAL SCROLL */
                <div className="flex-1 overflow-y-auto bg-[#070709] py-6 px-4 flex flex-col items-center gap-6 custom-scrollbar scroll-smooth">
                  {pages.map((p, idx) => (
                    <div 
                      key={idx} 
                      className="relative max-w-2xl w-full border border-white/5 rounded-2xl bg-black/40 shadow-2xl overflow-hidden"
                    >
                      <img 
                        src={p} 
                        alt={`Manga page ${idx + 1}`} 
                        className="w-full object-contain"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      <div className="absolute bottom-3 right-4 bg-black/75 backdrop-blur-md text-[9px] font-bold uppercase tracking-wider text-slate-300 py-1.5 px-3 border border-white/10 rounded-lg">
                        Страница {idx + 1} / {pages.length}
                      </div>
                    </div>
                  ))}

                  {/* End of Chapter notice and Next chapter launcher */}
                  <div className="w-full max-w-2xl py-12 px-6 bg-white/5 border border-white/5 rounded-3xl text-center space-y-4 mb-8">
                    <h4 className="text-lg font-black text-white uppercase tracking-tight">Вы прочитали эту главу!</h4>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                      Понравилась глава? Вы можете продолжить чтение следующей или вернуться к выбору тайтлов.
                    </p>
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={() => { setActiveChapter(null); setMangaReaderPage(0); }}
                        className="px-5 py-3 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-widest text-white rounded-xl transition-all cursor-pointer"
                      >
                        Закончить чтение
                      </button>
                      {nextChapter && (
                        <button
                          onClick={() => startReadingChapter(nextChapter)}
                          className="px-6 py-3 bg-[#FF5C00] hover:bg-[#ff6c1a] text-xs font-black uppercase tracking-widest text-white rounded-xl shadow-lg shadow-[#FF5C00]/20 transition-all cursor-pointer"
                        >
                          Следующая глава {nextChapter.chapter}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Mode B: CLASSIC PAGE BY PAGE SWIPER */
                <div className="flex-1 flex flex-col justify-between bg-[#0e0f11]">
                  <div className="flex-1 overflow-y-auto flex items-center justify-center p-4">
                    <div className="relative max-w-2xl w-full h-[73vh] flex items-center justify-center border border-white/5 rounded-3xl bg-black/20 p-4 shadow-2xl group overflow-hidden">
                      <img 
                        src={pages[mangaReaderPage]} 
                        alt={`Page ${mangaReaderPage + 1}`} 
                        className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl group-hover:scale-[1.01] transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Interactive hot areas */}
                      <button 
                        disabled={mangaReaderPage === 0}
                        onClick={() => { if (mangaReaderPage > 0) setMangaReaderPage(prev => prev - 1); }}
                        className="absolute left-0 top-0 bottom-0 w-1/4 cursor-w-resize z-10 flex items-center justify-start pl-6 opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-r from-black/60 to-transparent duration-300 disabled:opacity-0 disabled:cursor-default"
                      >
                        <div className="w-10 h-10 rounded-full bg-black/60 border border-white/5 flex items-center justify-center text-white">
                          <ChevronLeft className="w-6 h-6" />
                        </div>
                      </button>

                      <button 
                        disabled={mangaReaderPage === pages.length - 1}
                        onClick={() => { if (mangaReaderPage < pages.length - 1) setMangaReaderPage(prev => prev + 1); }}
                        className="absolute right-0 top-0 bottom-0 w-1/4 cursor-e-resize z-10 flex items-center justify-end pr-6 opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-l from-black/60 to-transparent duration-300 disabled:opacity-0 disabled:cursor-default"
                      >
                        <div className="w-10 h-10 rounded-full bg-black/60 border border-white/5 flex items-center justify-center text-white">
                          <ChevronRight className="w-6 h-6" />
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Page selector indicators */}
                  <div className="bg-[#121316] p-4 flex items-center justify-center gap-2 border-t border-white/5 overflow-x-auto hide-scrollbar select-none z-10">
                    {pages.map((_, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setMangaReaderPage(idx)}
                        className={`w-3.5 h-3.5 rounded-full transition-all duration-300 shrink-0 ${
                          idx === mangaReaderPage 
                            ? 'bg-[#FF5C00] scale-125' 
                            : 'bg-slate-700 hover:bg-[#FF5C00]/40'
                        }`}
                        title={`Страница ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};

export default Manga;
