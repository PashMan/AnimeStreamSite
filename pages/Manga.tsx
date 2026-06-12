import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, Star, Sparkles, ArrowLeft, ChevronRight, ChevronLeft, Heart, 
  Search, Loader2, ShieldAlert, BookX, ChevronDown, Layers, Settings, 
  AlignJustify, Sliders, Eye, MessageSquare, Clock, Filter, ThumbsUp, 
  ChevronUp, Calendar, Flame, Compass, HelpCircle, RefreshCw
} from 'lucide-react';
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
  
  // Core states
  const [mangas, setMangas] = useState<MangaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [selectedManga, setSelectedManga] = useState<MangaItem | null>(null);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState<boolean>(false);
  const [isMangaLicensed, setIsMangaLicensed] = useState<boolean>(false);
  const [readerMode, setReaderMode] = useState<'pages' | 'scroll'>('scroll');
  
  const [activeChapter, setActiveChapter] = useState<ChapterItem | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [pagesLoading, setPagesLoading] = useState<boolean>(false);
  
  const [mangaReaderPage, setMangaReaderPage] = useState<number>(0);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('kami_manga_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // MangaLib filters (Home page)
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterGenre, setFilterGenre] = useState<string>('all');
  const [homeActiveTab, setHomeActiveTab] = useState<'updates' | 'catalog' | 'popular'>('updates');

  // Reader Custom Settings
  const [readingBg, setReadingBg] = useState<'dark' | 'gray' | 'sepia' | 'light'>('dark');
  const [readingWidth, setReadingWidth] = useState<'600' | '800' | '1000' | 'full'>('800');
  const [readingGap, setReadingGap] = useState<'0' | '12' | '24'>('12');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Detail panel tabs
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
  
  // Comments Database
  const [mangaComments, setMangaComments] = useState<Record<string, {id: string, user: string, text: string, date: string, likes: number}[]>>(() => {
    try {
      const saved = localStorage.getItem('kami_manga_comments_db');
      return saved ? JSON.parse(saved) : {
        "manga-1": [
          { id: "1", user: "Zoro_Roronoa", text: "Шедевр! Обожаю рисовку, перевод здесь просто потрясающий. Всем читать!", date: "12.06.2026", likes: 24 },
          { id: "2", user: "Luffy_Meat", text: "Наконец-то нашел этот тайтл в хорошем качестве на русском! Буду читать всю ночь.", date: "11.06.2026", likes: 13 }
        ],
        "default": [
          { id: "1", user: "MangaCritic", text: "Прекрасный тайтл, сюжет затягивает с первых страниц! Рекомендую режим Свиток.", date: "10.06.2026", likes: 42 }
        ]
      };
    } catch {
      return {};
    }
  });
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [chapterSearchQuery, setChapterSearchQuery] = useState<string>('');

  // Auto loaded items bookmark sync
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
      user: (user as any)?.username || user?.email?.split('@')[0] || "Гость-Ками",
      text: newCommentText,
      date: new Date().toLocaleDateString('ru-RU'),
      likes: 0
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

  const toggleCommentLike = (mangaId: string, commentId: string) => {
    const list = mangaComments[mangaId] || mangaComments["default"] || [];
    const updatedList = list.map(c => c.id === commentId ? { ...c, likes: c.likes + 1 } : c);
    const updatedComments = {
      ...mangaComments,
      [mangaId]: updatedList
    };
    setMangaComments(updatedComments);
    localStorage.setItem('kami_manga_comments_db', JSON.stringify(updatedComments));
  };

  // Toggle favorites locally
  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = favorites.includes(id) 
      ? favorites.filter(item => item !== id) 
      : [...favorites, id];
    setFavorites(updated);
    localStorage.setItem('kami_manga_favorites', JSON.stringify(updated));
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

  // Trigger loading pages
  const startReadingChapter = async (chapterObj: ChapterItem) => {
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

  // Filtering logic for the dashboard Catalog
  const filteredMangasList = mangas.filter(m => {
    // Type check based on genre names (MangaLib uses Tags to filter types)
    if (filterType !== 'all') {
      if (filterType === 'manhwa' && !m.genres.includes('Манхва')) return false;
      if (filterType === 'manhua' && !m.genres.includes('Маньхуа')) return false;
      if (filterType === 'manga' && (m.genres.includes('Манхва') || m.genres.includes('Маньхуа'))) return false;
    }
    // Status check
    if (filterStatus !== 'all') {
      const lowerStatus = m.status.toLowerCase();
      if (filterStatus === 'ongoing' && !(lowerStatus.includes('ongoing') || lowerStatus.includes('pub'))) return false;
      if (filterStatus === 'completed' && !(lowerStatus.includes('comp') || lowerStatus.includes('end'))) return false;
    }
    // Genre check
    if (filterGenre !== 'all' && !m.genres.includes(filterGenre)) {
      return false;
    }
    return true;
  });

  // Unique genres for catalog filter
  const allUniqueGenres = Array.from(
    new Set(mangas.flatMap(m => m.genres))
  ).slice(0, 15);

  // Simulated latest updates release timeline matching MangaLib structure
  const latestUpdatesTimeline = mangas.slice(0, 8).map((m, idx) => {
    const elapsedMinutes = (idx + 1) * 12;
    const timeLabel = elapsedMinutes < 60 
      ? `${elapsedMinutes} мин. назад` 
      : `${Math.floor(elapsedMinutes / 60)} ч. назад`;

    return {
      manga: m,
      time: timeLabel,
      team: idx % 2 === 0 ? "KamiTrans" : "MangaLib Studio",
      chapterNum: `Том 1. Глава ${10 - idx}`,
      chapterTitle: idx % 3 === 0 ? "Начало конца" : "Встреча в таверне"
    };
  });

  // Top rankings side banner list (MangaLib Top widget)
  const topRankedTimeline = [...mangas]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5);

  // Fallback covers in case of missing links
  const FALLBACK_COVER = "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=600&auto=format&fit=crop";

  return (
    <div className="bg-[#121316] min-h-screen text-[#a5a7b1] font-sans selection:bg-[#FF5C00]/30 selection:text-white select-none">
      <SEO 
        title="KamiManga - Читать Мангу Онлайн на русском языке бесплатно"
        description="Крупнейший портал лицензионной и фанатской манги KamiManga. Умный ридер, подробные каталоги, оценки, отзывы."
      />

      {/* Modern KamiManga Styled Head Ribbon banner */}
      <div className="bg-gradient-to-r from-[#FF5C00]/10 via-[#18191d]/90 to-[#121316] border-b border-white/5 py-8 px-4 sm:px-8 lg:px-12">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="px-2.5 py-0.5 bg-[#FF5C00] text-black text-[10px] font-black uppercase tracking-wider rounded flex items-center gap-1.5 w-fit">
              <BookOpen className="w-3 h-3 fill-current" /> KAMIMANGA PORTAL
            </span>
            <h1 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight flex items-center gap-2">
              KamiManga <span className="text-[#FF5C00] font-light">Portal</span>
            </h1>
            <p className="text-xs text-[#7d8291] font-semibold max-w-2xl">
              Любимый портал KamiManga с русской локализацией, удобными закладками, умным свитком и прямым поиском в глобальных каталогах.
            </p>
          </div>

          {/* Quick search built like MangaLib navbar layout */}
          <div className="relative w-full md:w-80 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Найти мангу по названию..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#18191d] border border-white/5 hover:border-[#FF5C00]/40 focus:border-[#FF5C00] rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetchMangas(searchQuery);
                    setHomeActiveTab('catalog');
                  }
                }}
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button 
              onClick={() => {
                fetchMangas(searchQuery);
                setHomeActiveTab('catalog');
              }}
              className="px-4 py-2.5 bg-[#FF5C00] hover:bg-[#ff6c1a] text-black font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-md shadow-[#FF5C00]/10"
            >
              Искать
            </button>
          </div>
        </div>
      </div>

      {/* Main MangaLib Body Layout */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 py-8">
        
        {/* Mobile Navigation tabs (MangaLib responsive panels) */}
        <div className="flex md:hidden bg-[#18191d] p-1 rounded-xl mb-6 border border-white/5 select-none">
          <button 
            onClick={() => setHomeActiveTab('updates')}
            className={`flex-1 py-2 text-center text-xs font-black uppercase tracking-wider rounded-lg transition-all ${homeActiveTab === 'updates' ? 'bg-[#FF5C00] text-black' : 'text-[#7d8291]'}`}
          >
            Свежее
          </button>
          <button 
            onClick={() => setHomeActiveTab('catalog')}
            className={`flex-1 py-2 text-center text-xs font-black uppercase tracking-wider rounded-lg transition-all ${homeActiveTab === 'catalog' ? 'bg-[#FF5C00] text-black' : 'text-[#7d8291]'}`}
          >
            Каталог ({filteredMangasList.length})
          </button>
          <button 
            onClick={() => setHomeActiveTab('popular')}
            className={`flex-1 py-2 text-center text-xs font-black uppercase tracking-wider rounded-lg transition-all ${homeActiveTab === 'popular' ? 'bg-[#FF5C00] text-black' : 'text-[#7d8291]'}`}
          >
            Топ-5
          </button>
        </div>

        {/* Triple Grid Layout exactly like Desktop MangaLib */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* COLUMN 1 (Desktop Left Sidebar): Quick Filters for fast browse */}
          <div className="col-span-1 md:col-span-3 space-y-6 hidden md:block">
            <div className="bg-[#18191d] rounded-2xl border border-white/5 p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#FF5C00]" /> Фильтр Мангалиба
                </span>
                <button 
                  onClick={() => {
                    setFilterType('all');
                    setFilterStatus('all');
                    setFilterGenre('all');
                  }}
                  className="text-[9px] font-black text-[#FF5C00] uppercase tracking-wider hover:opacity-80 transition-opacity"
                >
                  Сбросить
                </button>
              </div>

              {/* Type Category Selection */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-[#7d8291] tracking-wider">Тип произведения</span>
                <div className="space-y-1">
                  {[
                    { id: 'all', label: 'Все форматы' },
                    { id: 'manga', label: 'Манга (Японская)' },
                    { id: 'manhwa', label: 'Манхва (Корейская)' },
                    { id: 'manhua', label: 'Маньхуа (Китайская)' }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setFilterType(t.id);
                        setHomeActiveTab('catalog');
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-between ${
                        filterType === t.id 
                          ? 'bg-[#FF5C00]/10 text-[#FF5C00]' 
                          : 'text-[#a5a7b1] hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span>{t.label}</span>
                      {filterType === t.id && <span className="w-1.5 h-1.5 bg-[#FF5C00] rounded-full animate-ping" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Release status Selection */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-[#7d8291] tracking-wider">Статус перевода</span>
                <div className="space-y-1">
                  {[
                    { id: 'all', label: 'Любой статус' },
                    { id: 'ongoing', label: 'Продолжается (Ongoing)' },
                    { id: 'completed', label: 'Завершен полностью' }
                  ].map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setFilterStatus(s.id);
                        setHomeActiveTab('catalog');
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-between ${
                        filterStatus === s.id 
                          ? 'bg-[#FF5C00]/10 text-[#FF5C00]' 
                          : 'text-[#a5a7b1] hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span>{s.label}</span>
                      {filterStatus === s.id && <span className="w-1.5 h-1.5 bg-[#FF5C00] rounded-full animate-ping" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genre Selector */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-[#7d8291] tracking-wider">Жанровые теги</span>
                <div className="relative">
                  <select
                    value={filterGenre}
                    onChange={(e) => {
                      setFilterGenre(e.target.value);
                      setHomeActiveTab('catalog');
                    }}
                    className="w-full bg-[#121316] border border-white/5 hover:border-white/10 text-xs font-bold text-white rounded-xl p-2.5 focus:outline-none focus:border-[#FF5C00] transition-all cursor-pointer"
                  >
                    <option value="all">Все жанры</option>
                    {allUniqueGenres.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 2 (Main central dashboard): Updates list & Catalog feed */}
          <div className="col-span-1 md:col-span-6 space-y-8">
            
            {/* 1. LATEST CHAPTER UPDATES LIST (MangaLib default homepage) */}
            {(homeActiveTab === 'updates' || !loading) && (
              <div className={`space-y-4 ${homeActiveTab !== 'updates' ? 'hidden md:block' : ''}`}>
                <h2 className="text-sm font-black uppercase tracking-widest text-[#FF5C00] flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-[#FF5C00] rounded-full inline-block animate-pulse" /> Свежие Обновления Манги
                </h2>

                <div className="space-y-3">
                  {loading ? (
                    <div className="py-12 flex justify-center">
                      <Loader2 className="w-7 h-7 text-[#FF5C00] animate-spin" />
                    </div>
                  ) : latestUpdatesTimeline.length === 0 ? (
                    <div className="text-center py-6 text-xs font-bold text-[#7d8291]">Нет обновлений</div>
                  ) : (
                    latestUpdatesTimeline.map((item, idx) => (
                      <div 
                        key={`${item.manga.id}-${idx}`}
                        onClick={() => selectMangaItem(item.manga)}
                        className="p-3 bg-[#18191d] hover:bg-[#1f2026] border border-white/5 rounded-2xl flex gap-4 items-center justify-between cursor-pointer transition-all duration-300 transform hover:-translate-y-0.5 ease-out"
                      >
                        <div className="flex gap-3 items-center min-w-0">
                          <img 
                            src={item.manga.cover || FALLBACK_COVER} 
                            alt="" 
                            onError={(e) => { e.currentTarget.src = FALLBACK_COVER; }}
                            className="w-10 h-14 object-cover rounded shadow-lg shrink-0 border border-white/5"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-white hover:text-[#FF5C00] transition-colors truncate max-w-[200px] sm:max-w-[300px]">
                              {item.manga.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-[#FF5C00] font-black shrink-0">{item.chapterNum}</span>
                              <span className="text-[9px] text-[#7d8291] font-semibold truncate hidden sm:inline">— {item.chapterTitle}</span>
                            </div>
                            <span className="text-[8.5px] font-black uppercase tracking-wider text-[#7d8291] block mt-1">Фэнсаб: {item.team}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                          <span className="text-[9px] select-none text-[#7d8291] font-medium block flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-[#FF5C00]" /> {item.time}
                          </span>
                          <span className="px-1.5 py-0.5 bg-[#FF5C00]/10 border border-[#FF5C00]/20 rounded text-[8px] font-black uppercase text-[#FF5C00]">
                            НОВОЕ
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 2. CORE CARD CATALOG list matching filtered values */}
            {(homeActiveTab === 'catalog' || !loading) && (
              <div className={`space-y-4 ${homeActiveTab !== 'catalog' ? 'hidden md:block' : ''}`}>
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <Compass className="w-4 h-4 text-[#FF5C00]" /> Каталог Произведений ({filteredMangasList.length})
                  </h2>
                </div>

                {loading ? (
                  <div className="py-24 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-[#FF5C00] animate-spin mb-3" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 animate-pulse">Синхронизация с MangaDex...</span>
                  </div>
                ) : filteredMangasList.length === 0 ? (
                  <div className="py-16 text-center text-slate-500 font-extrabold text-xs uppercase tracking-widest">
                    Ничего не совпало с выбранным фильтром. Попробуйте сбросить параметры.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                    {filteredMangasList.map((m, idx) => {
                      const isFaved = favorites.includes(m.id);
                      // Custom ribbon indicator
                      const isBestseller = idx % 4 === 0;

                      return (
                        <div 
                          key={m.id}
                          onClick={() => selectMangaItem(m)}
                          className="group cursor-pointer bg-[#18191d] border border-white/5 rounded-2xl overflow-hidden hover:border-[#FF5C00]/40 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
                        >
                          <div className="relative aspect-[2/3] w-full overflow-hidden">
                            <img 
                              src={m.cover} 
                              alt={m.title} 
                              onError={(e) => { e.currentTarget.src = FALLBACK_COVER; }}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                            {/* Floating MangaLib styled badges on cover */}
                            <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
                              <span className="px-2 py-0.5 bg-black/75 backdrop-blur-md rounded-md text-[8.5px] text-slate-300 font-black uppercase tracking-wider border border-white/5">
                                {m.status}
                              </span>
                              {isBestseller && (
                                <span className="px-2 py-0.5 bg-[#FF5C00] rounded-md text-[8px] text-black font-black uppercase tracking-wider shadow-sm flex items-center gap-0.5">
                                  <Flame className="w-2.5 h-2.5" /> ХИТ
                                </span>
                              )}
                            </div>

                            {/* Hearts toggle bookmark indicator on cover */}
                            <button 
                              onClick={(e) => toggleFavorite(m.id, e)}
                              className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 hover:bg-[#FF5C00] text-white hover:text-black transition-all active:scale-90 z-20"
                            >
                              <Heart className={`w-3.5 h-3.5 ${isFaved ? 'fill-current text-[#FF5C00]' : ''}`} />
                            </button>

                            {/* Average user index rate indicator */}
                            <div className="absolute bottom-2 left-2.5 z-10">
                              <span className="text-[10px] font-black text-white bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-sm border border-white/5 flex items-center gap-1">
                                <Star className="w-2.5 h-2.5 text-yellow-500 fill-current" /> {m.rating}
                              </span>
                            </div>
                          </div>

                          <div className="p-3 space-y-1.5 flex-grow flex flex-col justify-between">
                            <div className="space-y-0.5">
                              <h3 className="font-extrabold text-[#FF5C00] uppercase text-[9px] tracking-widest truncate">
                                {m.originalTitle || "MANGA ORIGINAL"}
                              </h3>
                              <h4 className="font-black text-xs text-white group-hover:text-[#FF5C00] transition-colors leading-snug line-clamp-1">
                                {m.title}
                              </h4>
                            </div>
                            <div className="flex flex-wrap gap-1 pt-1.5 border-t border-white/5">
                              {m.genres.slice(0, 2).map(genre => (
                                <span key={genre} className="px-1.5 py-0.5 bg-white/5 rounded text-[8px] font-black uppercase text-[#7d8291]">
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
            )}
          </div>

          {/* COLUMN 3 (Desktop Right Sidebar): Popular Rank Board widget */}
          <div className="col-span-1 md:col-span-3 space-y-6">
            <div className={`bg-[#18191d] rounded-2xl border border-white/5 p-5 space-y-4 ${homeActiveTab === 'popular' ? '' : 'hidden md:block'}`}>
              <h2 className="text-xs font-black uppercase tracking-widest text-[#FF5C00] flex items-center gap-1.5 border-b border-white/5 pb-3">
                <Flame className="w-3.5 h-3.5 text-[#FF5C00] fill-current animate-bounce" /> ТОП Произведений
              </h2>

              <div className="space-y-4">
                {topRankedTimeline.map((item, idx) => (
                  <div 
                    key={item.id}
                    onClick={() => selectMangaItem(item)}
                    className="flex gap-3 items-center cursor-pointer hover:bg-white/5 p-1 rounded-xl transition-all"
                  >
                    {/* Rank Indicator */}
                    <div className="text-xl font-black italic text-slate-600 font-mono w-6 text-center select-none">
                      #{idx + 1}
                    </div>

                    <img 
                      src={item.cover || FALLBACK_COVER} 
                      alt="" 
                      className="w-8 h-12 object-cover rounded border border-white/5 shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-black text-white truncate hover:text-[#FF5C00] transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-[10px] text-[#7d8291] leading-none mt-1 uppercase tracking-wide">
                        {item.genres[0] || "Манга"}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-[9px]">
                        <Star className="w-2.5 h-2.5 text-yellow-500 fill-current" />
                        <span className="font-extrabold text-[#a5a7b1]">{item.rating}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick platform notices board */}
            <div className="bg-gradient-to-tr from-[#FF5C00]/10 to-transparent p-5 rounded-2xl border border-[#FF5C00]/20 space-y-2 select-none">
              <span className="text-[10px] text-[#FF5C00] font-black uppercase tracking-widest flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-[#FF5C00]" /> Синхронизация MangaDex
              </span>
              <p className="text-[11px] text-[#7d8291] font-semibold leading-relaxed">
                Поиск осуществляется в глобальном API MangaDex. Если главы не загружаются — значит переводчики закрыли свободный доступ.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* DETAILED MANGA INFO POPUP PANEL (Fidelity MangaLib Copy) */}
      <AnimatePresence>
        {selectedManga && activeChapter === null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.96, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 15 }}
              className="bg-[#18191d] border border-white/5 w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl relative my-6 max-h-[92vh] flex flex-col"
            >
              {/* Cover background blurred poster overlay */}
              <div className="absolute top-0 left-0 right-0 h-48 overflow-hidden opacity-10 pointer-events-none select-none">
                <img src={selectedManga.cover} alt="" className="w-full h-full object-cover blur-2xl scale-110" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#18191d]" />
              </div>

              {/* Header section with Close Button */}
              <div className="p-6 border-b border-white/5 flex justify-between items-center relative z-20">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#FF5C00] font-black uppercase tracking-widest border border-[#FF5C00]/30 px-2 py-0.5 bg-[#FF5C00]/5 rounded">
                    KamiManga Core v3.4
                  </span>
                </div>
                <button 
                  onClick={() => setSelectedManga(null)}
                  className="p-2 hover:bg-white/5 text-white hover:text-[#FF5C00] rounded-xl transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable contents grid */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                  
                  {/* Left panel columns: cover and actions */}
                  <div className="col-span-1 md:col-span-4 space-y-5">
                    <div className="aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/5 select-none relative group">
                      <img 
                        src={selectedManga.cover} 
                        alt={selectedManga.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Chapters action launcher */}
                    <button
                      onClick={() => {
                        if (chapters.length > 0) {
                          startReadingChapter(chapters[chapters.length - 1] || chapters[0]);
                        } else {
                          alert('Главы пока не загружены. Пожалуйста, зайдите во вкладку «Главы» для инициализации.');
                        }
                      }}
                      disabled={chaptersLoading}
                      className="w-full py-3.5 bg-[#FF5C00] text-black hover:bg-[#ff6c1a] disabled:opacity-50 text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-[#FF5C00]/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4 text-black font-bold" />
                      <span>{chaptersLoading ? 'Поиск глав...' : 'Читать с первой главы'}</span>
                    </button>

                    {/* Bookmark Dropdown selector */}
                    <div className="relative">
                      <button
                        onClick={() => setIsBookmarkDropdownOpen(prev => !prev)}
                        className="w-full py-3 px-4 bg-[#121316] hover:bg-black/40 text-slate-200 border border-white/5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-between cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Heart className={`w-3.5 h-3.5 ${bookmarkCategory[selectedManga.id] ? 'fill-current text-[#FF5C00]' : ''}`} />
                          <span className="truncate">{bookmarkCategory[selectedManga.id] ? `В закладках: ${bookmarkCategory[selectedManga.id]}` : 'Добавить в закладки'}</span>
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isBookmarkDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isBookmarkDropdownOpen && (
                        <div className="absolute left-0 right-0 mt-2 bg-[#121316] border border-white/10 rounded-xl p-1.5 shadow-2xl z-50 space-y-0.5 select-none">
                          {['Читаю', 'Хочу прочитать', 'Прочитано', 'Любимое', 'Отложено', 'Брошено'].map((cat) => (
                            <button
                              key={cat}
                              onClick={() => updateBookmarkCategory(selectedManga.id, cat)}
                              className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all hover:bg-white/5 ${
                                bookmarkCategory[selectedManga.id] === cat 
                                  ? 'text-[#FF5C00] bg-[#FF5C00]/10 font-bold' 
                                  : 'text-[#a5a7b1]'
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

                    {/* Ratings Board box */}
                    <div className="bg-[#121316] p-4 rounded-xl border border-white/5 space-y-3.5 select-none">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Оценка тайтла</span>
                        <span className="text-[9px] text-[#FF5C00] font-black uppercase tracking-wider">Рекомендовано</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-3xl font-black text-white flex items-baseline gap-1">
                          <span>{selectedManga.rating}</span>
                          <span className="text-xs text-slate-500">/10</span>
                        </div>
                        <div className="flex-grow">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star 
                                key={i} 
                                className={`w-3 h-3 ${i < Math.floor(selectedManga.rating / 2) ? 'text-yellow-500 fill-current' : 'text-slate-700'}`} 
                              />
                            ))}
                          </div>
                          <span className="text-[9px] text-[#7d8291] font-semibold tracking-wider uppercase block mt-1">Голосов: 8,760</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right side: title descriptions tabs and files */}
                  <div className="col-span-1 md:col-span-8 flex flex-col space-y-6">
                    <div>
                      <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight leading-tight uppercase">
                        {selectedManga.title}
                      </h2>
                      <h3 className="text-sm font-bold text-[#7d8291] uppercase tracking-wide mt-1">
                        {selectedManga.originalTitle || "MANGA ORIGINAL METADATA"}
                      </h3>
                    </div>

                    {/* Tabs Panel List */}
                    <div className="flex border-b border-white/5 relative z-10 select-none overflow-x-auto">
                      {[
                        { id: 'info', label: 'Описание' },
                        { id: 'chapters', label: `Главы (${chaptersLoading ? '...' : chapters.length})` },
                        { id: 'comments', label: `Обсуждение (${(mangaComments[selectedManga.id] || mangaComments["default"] || []).length})` }
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveDetailTab(tab.id as any)}
                          className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                            activeDetailTab === tab.id
                              ? 'border-[#FF5C00] text-white bg-white/5 rounded-t-xl'
                              : 'border-transparent text-[#7d8291] hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Tab Container viewport */}
                    <div className="min-h-[220px]">
                      {activeDetailTab === 'info' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-[#FF5C00] uppercase tracking-widest pl-2 border-l border-[#FF5C00]">Описание / Синопсис</h4>
                            <p className="text-slate-300 text-xs leading-relaxed font-semibold">
                              {selectedManga.description || "У этого тайтла пока нет детальной аннотации на русском языке. Загрузите главы, чтобы прочитать первый любительский перевод."}
                            </p>
                          </div>

                          {/* Technical metadata list table */}
                          <div className="space-y-2.5">
                            <h4 className="text-[10px] font-black text-[#FF5C00] uppercase tracking-widest pl-2 border-l border-[#FF5C00]">Информация KamiManga</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 bg-[#121316] p-4 rounded-xl border border-white/5 text-xs font-semibold">
                              <div className="flex justify-between py-1 border-b border-white/5">
                                <span className="text-slate-500 uppercase">Формат</span>
                                <span className="text-white">Манга (Япония)</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-white/5">
                                <span className="text-slate-500 uppercase">Статус выпуска</span>
                                <span className="text-[#FF5C00]">{selectedManga.status}</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-white/5">
                                <span className="text-slate-500 uppercase">Перевод</span>
                                <span className="text-green-400">Продолжается</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-white/5">
                                <span className="text-slate-500 uppercase">Возрастной ценз</span>
                                <span className="text-red-400 font-black">16+</span>
                              </div>
                            </div>
                          </div>

                          {/* Genre tag pill list */}
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-[#FF5C00] uppercase tracking-widest pl-2 border-l border-[#FF5C00]">Жанровые теги</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedManga.genres.map(genre => (
                                <span 
                                  key={genre} 
                                  className="px-2.5 py-1 bg-[#121316] border border-white/5 text-[#a5a7b1] rounded-lg text-[9px] font-black uppercase tracking-wider"
                                >
                                  {genre}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeDetailTab === 'chapters' && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                          <div className="relative">
                            <input 
                              type="text" 
                              placeholder="Поиск по главе... (напр. 1 или 5)"
                              className="w-full pl-10 pr-4 py-2.5 bg-[#121316] border border-white/5 focus:border-[#FF5C00] rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none transition-all outline-none"
                              value={chapterSearchQuery}
                              onChange={(e) => setChapterSearchQuery(e.target.value)}
                            />
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          </div>

                          {chaptersLoading ? (
                            <div className="py-12 flex flex-col items-center justify-center">
                              <Loader2 className="w-7 h-7 text-[#FF5C00] animate-spin mb-3" />
                              <span className="text-xs font-black uppercase text-slate-500 tracking-widest">Синхронизация глав...</span>
                            </div>
                          ) : (() => {
                            const filteredChapters = chapters.filter(ch => 
                              ch.chapter.toLowerCase().includes(chapterSearchQuery.toLowerCase()) || 
                              (ch.title && ch.title.toLowerCase().includes(chapterSearchQuery.toLowerCase()))
                            );

                            return filteredChapters.length === 0 ? (
                              isMangaLicensed ? (
                                <div className="py-8 px-5 text-center border border-red-500/10 bg-red-500/5 text-slate-300 rounded-2xl flex flex-col items-center gap-2">
                                  <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
                                  <div className="font-black text-red-500 text-sm uppercase">Лицензионная блокировка</div>
                                  <div className="text-[10px] text-slate-500 leading-normal max-w-sm font-semibold">
                                    По требованию издателя этот тайтл заблокирован для свободного просмотра. Вы можете найти его на официальных российских сервисах.
                                  </div>
                                </div>
                              ) : (
                                <div className="py-12 text-center text-slate-500 font-extrabold text-xs uppercase tracking-widest">Страницы глав не найдены в API</div>
                              )
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                {filteredChapters.map((ch) => (
                                  <button
                                    key={ch.id}
                                    onClick={() => startReadingChapter(ch)}
                                    className="p-3 bg-[#121316] border border-white/5 rounded-xl hover:border-[#FF5C00] hover:bg-[#FF5C00]/10 text-left transition-all active:scale-[0.98] flex items-center justify-between cursor-pointer"
                                  >
                                    <div className="min-w-0 pr-2">
                                      <div className="text-[8px] font-black uppercase text-[#FF5C00] truncate">GROUP: {ch.group || "MangaDx"}</div>
                                      <div className="text-xs font-black text-white">Глава {ch.chapter}</div>
                                      <div className="text-[10px] text-slate-500 font-semibold truncate">{ch.title || `Глава ${ch.chapter}`}</div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {activeDetailTab === 'comments' && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                          <div className="bg-[#121316] border border-white/5 p-4 rounded-xl space-y-3">
                            <textarea 
                              rows={3}
                              placeholder="Оставьте отзыв о главе или сюжете произведения..."
                              value={newCommentText}
                              onChange={(e) => setNewCommentText(e.target.value)}
                              className="w-full bg-[#18191d] border border-white/5 hover:border-white/15 focus:border-[#FF5C00] rounded-xl p-3.5 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none transition-all outline-none resize-none"
                            />
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] text-[#7d8291] font-black uppercase">Вы: {(user as any)?.username || user?.email?.split('@')[0] || "Гость"}</span>
                              <button 
                                onClick={() => addComment(selectedManga.id)}
                                className="px-4 py-2 bg-[#FF5C00] text-black font-black uppercase text-[10px] tracking-widest rounded-lg shadow"
                              >
                                Добавить отзыв
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                            {((mangaComments[selectedManga.id] || []).length > 0 
                              ? mangaComments[selectedManga.id] 
                              : (mangaComments["default"] || [])
                            ).map((comment) => (
                              <div key={comment.id} className="p-3.5 bg-[#121316] border border-white/5 rounded-xl flex items-start gap-3 justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-white py-0.5 px-2 bg-white/5 rounded-md">{comment.user}</span>
                                    <span className="text-[9px] text-[#7d8291] font-semibold">{comment.date}</span>
                                  </div>
                                  <p className="text-slate-300 text-xs font-medium leading-relaxed">
                                    {comment.text}
                                  </p>
                                </div>
                                <button 
                                  onClick={() => toggleCommentLike(selectedManga.id, comment.id)}
                                  className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg text-[10px] hover:text-[#FF5C00] hover:bg-[#FF5C00]/10 transition-all select-none"
                                >
                                  <ThumbsUp className="w-3 h-3 text-[#FF5C00] fill-current" />
                                  <span>{comment.likes}</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULL-FIDELITY HIGH-CONTRAST MANGA READER INTERFACE */}
      <AnimatePresence>
        {selectedManga && activeChapter !== null && (() => {
          const activeIndex = chapters.findIndex(c => c.id === activeChapter.id);
          const prevChapter = activeIndex > 0 ? chapters[activeIndex - 1] : null;
          const nextChapter = activeIndex < chapters.length - 1 ? chapters[activeIndex + 1] : null;

          const activeBgClass = 
            readingBg === 'gray' ? 'bg-[#1e1f24] text-slate-200' :
            readingBg === 'sepia' ? 'bg-[#2a241e] text-orange-200/90' :
            readingBg === 'light' ? 'bg-[#f7f8fa] text-black' : 
            'bg-[#060608] text-slate-300';

          const activeContainerWidth = 
            readingWidth === '600' ? 'max-w-xl' :
            readingWidth === '1000' ? 'max-w-4xl' :
            readingWidth === 'full' ? 'max-w-none w-full' :
            'max-w-2xl';

          const activeGapClass = 
            readingGap === '12' ? 'gap-3 py-3' :
            readingGap === '24' ? 'gap-6 py-6' :
            'gap-0 py-0';

          return (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`fixed inset-0 z-[125] flex flex-col justify-between overflow-hidden ${activeBgClass}`}
            >
              {/* Top sticky tool-strip block */}
              <div className="bg-[#121316] px-4 py-3.5 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 z-50 shadow-md">
                <div className="flex items-center gap-3 min-w-0">
                  <button 
                    onClick={() => { setActiveChapter(null); setMangaReaderPage(0); }}
                    className="p-2.5 bg-white/5 text-slate-300 hover:text-[#FF5C00] hover:bg-white/10 rounded-xl transition-all shrink-0 cursor-pointer"
                    title="Назад к деталям"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-[9px] text-[#FF5C00] uppercase tracking-wider truncate max-w-[120px] md:max-w-[200px]">
                      {selectedManga.title}
                    </h3>
                    
                    {/* Chapter Select dropdown */}
                    <div className="relative inline-block text-left mt-0.5 group/chdrop select-none">
                      <button className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-white hover:text-[#FF5C00] transition-colors focus:outline-none">
                        <span>Глава {activeChapter.chapter}</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Dropdown container matching MangaLib navigation */}
                      <div className="absolute left-0 top-full mt-2 w-64 bg-[#18191d] border border-white/10 rounded-2xl p-2 shadow-2xl overflow-hidden hidden group-hover/chdrop:block hover:block z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="text-[9px] font-black tracking-wider text-[#7d8291] uppercase px-3 py-1.5 border-b border-white/5">
                          Перейти к главе
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1 space-y-0.5 mt-1">
                          {chapters.map((ch) => (
                            <button
                              key={ch.id}
                              onClick={() => startReadingChapter(ch)}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex flex-col ${
                                ch.id === activeChapter.id
                                  ? "bg-[#FF5C00] text-black"
                                  : "text-slate-300 hover:bg-white/5"
                              }`}
                            >
                              <span>Глава {ch.chapter}</span>
                              <span className="text-[9px] opacity-75 truncate">{ch.title || 'Раздел главы'}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main controls timeline */}
                <div className="flex items-center gap-2 select-none">
                  {/* Previous chapter selector slider */}
                  <button
                    disabled={!prevChapter}
                    onClick={() => prevChapter && startReadingChapter(prevChapter)}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-wider text-slate-300 disabled:opacity-20 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline text-[9px]">Пред.</span>
                  </button>

                  <div className="bg-black/45 border border-white/5 rounded-xl p-0.5 flex">
                    <button
                      onClick={() => setReaderMode('pages')}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        readerMode === 'pages' ? 'bg-[#FF5C00] text-black' : 'text-[#7d8291]'
                      }`}
                    >
                      Постранично
                    </button>
                    <button
                      onClick={() => setReaderMode('scroll')}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        readerMode === 'scroll' ? 'bg-[#FF5C00] text-black' : 'text-[#7d8291]'
                      }`}
                    >
                      Свиток
                    </button>
                  </div>

                  {/* Settings popup panel trigger icon button */}
                  <button 
                    onClick={() => setIsSettingsOpen(prev => !prev)}
                    className={`p-2 bg-white/5 text-slate-300 rounded-xl transition-all ${isSettingsOpen ? 'text-[#FF5C00] bg-[#FF5C00]/10' : 'hover:bg-white/10'}`}
                    title="Настройки Ридера"
                  >
                    <Settings className="w-4 h-4" />
                  </button>

                  {/* Next chapter slider */}
                  <button
                    disabled={!nextChapter}
                    onClick={() => nextChapter && startReadingChapter(nextChapter)}
                    className="px-3 py-2 bg-[#FF5C00] hover:bg-[#ff6c1a] text-xs font-black uppercase tracking-wider text-black disabled:opacity-20 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span className="hidden sm:inline text-[9px]">След.</span> <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Central Canvas Container with Settings Drawer slider overlay */}
              <div className="flex-1 flex relative overflow-hidden">
                
                {/* 1. READER PAGES MAIN SURFACE VIEW */}
                <div className="flex-1 overflow-y-auto flex flex-col items-center custom-scrollbar relative z-10 w-full">
                  {pagesLoading ? (
                    <div className="m-auto flex flex-col items-center justify-center p-6 text-center">
                      <Loader2 className="w-10 h-10 text-[#FF5C00] animate-spin mb-4" />
                      <span className="text-xs font-black uppercase text-slate-400 tracking-widest animate-pulse">
                        Загрузка страниц из API...
                      </span>
                    </div>
                  ) : pages.length === 0 ? (
                    <div className="m-auto flex flex-col items-center justify-center p-6 text-center">
                      <BookOpen className="w-12 h-12 text-[#7d8291] mb-4" />
                      <h3 className="text-sm font-black text-white">Страницы не найдены</h3>
                      <p className="text-[10px] text-slate-500 mt-1 max-w-sm">
                        Возможно, страница защищена защитными механизмами или недоступна в данный момент. Попробуйте еще раз.
                      </p>
                    </div>
                  ) : readerMode === 'scroll' ? (
                    /* Continuous Vertical Scroll List View */
                    <div className={`w-full flex flex-col items-center ${activeContainerWidth} ${activeGapClass}`}>
                      {pages.map((imgUrl, idx) => (
                        <div 
                          key={idx} 
                          className="relative w-full shadow-2xl select-none"
                        >
                          <img 
                            src={imgUrl} 
                            alt={`Page-${idx + 1}`} 
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            className="w-full object-contain mx-auto"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                          <div className="absolute bottom-3 right-4 bg-black/80 backdrop-blur-md text-[8.5px] font-black uppercase tracking-wide text-slate-400 py-1 px-2.5 rounded border border-white/5">
                            Стр. {idx + 1} / {pages.length}
                          </div>
                        </div>
                      ))}

                      {/* Continuous vertical Scroll bottom Chapter-Completion Notice block */}
                      <div className="w-full max-w-xl py-12 px-6 bg-[#18191d] border border-white/5 rounded-3xl text-center space-y-4 my-6 select-none relative z-20 mx-4 shadow-2xl">
                        <h4 className="text-sm font-black text-white uppercase tracking-wider">Глава Завершена</h4>
                        <p className="text-[11px] text-[#7d8291] max-w-xs mx-auto">
                          Вы успешно закончили главу {activeChapter.chapter} тайтла. Понравилась манга? Продолжайте читать!
                        </p>
                        <div className="flex justify-center gap-2 pt-2 pb-1">
                          <button
                            onClick={() => { setActiveChapter(null); setMangaReaderPage(0); }}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-widest text-[#a5a7b1] hover:text-white rounded-xl transition-all"
                          >
                            В Описание
                          </button>
                          {nextChapter && (
                            <button
                              onClick={() => startReadingChapter(nextChapter)}
                              className="px-5 py-2 bg-[#FF5C00] text-black hover:bg-[#ff6c1a] text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-[#FF5C00]/10"
                            >
                              Гл. {nextChapter.chapter}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Paginated Book Page view */
                    <div className="flex-1 w-full flex flex-col justify-between">
                      <div className="flex-grow flex items-center justify-center p-4">
                        <div className={`relative w-full ${activeContainerWidth} h-[71vh] flex items-center justify-center p-2 rounded-2xl group overflow-hidden`}>
                          <img 
                            src={pages[mangaReaderPage]} 
                            alt="" 
                            onError={(e) => { e.currentTarget.src = FALLBACK_COVER; }}
                            className="max-h-full max-w-full object-contain rounded-xl shadow-2xl transition-all duration-300"
                            referrerPolicy="no-referrer"
                          />

                          {/* Navigation clickable swipe blocks */}
                          <button 
                            disabled={mangaReaderPage === 0}
                            onClick={() => { if (mangaReaderPage > 0) setMangaReaderPage(prev => prev - 1); }}
                            className="absolute left-0 top-0 bottom-0 w-1/4 cursor-w-resize z-10 flex items-center justify-start pl-6 opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-r from-black/20 to-transparent disabled:opacity-0 disabled:cursor-default"
                          >
                            <div className="w-8 h-8 rounded-full bg-black/60 border border-white/5 flex items-center justify-center text-white">
                              <ChevronLeft className="w-5 h-5" />
                            </div>
                          </button>

                          <button 
                            disabled={mangaReaderPage === pages.length - 1}
                            onClick={() => { if (mangaReaderPage < pages.length - 1) setMangaReaderPage(prev => prev + 1); }}
                            className="absolute right-0 top-0 bottom-0 w-1/4 cursor-e-resize z-10 flex items-center justify-end pr-6 opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-l from-black/20 to-transparent disabled:opacity-0 disabled:cursor-default"
                          >
                            <div className="w-8 h-8 rounded-full bg-black/60 border border-white/5 flex items-center justify-center text-white">
                              <ChevronRight className="w-5 h-5" />
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Paginated dots selectors */}
                      <div className="bg-[#121316] py-3.5 px-4 flex items-center justify-center gap-1.5 border-t border-white/5 overflow-x-auto hide-scrollbar select-none z-10 max-h-12 shrink-0">
                        {pages.map((_, idx) => (
                          <button 
                            key={idx}
                            onClick={() => setMangaReaderPage(idx)}
                            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 shrink-0 ${
                              idx === mangaReaderPage 
                                ? 'bg-[#FF5C00] scale-125' 
                                : 'bg-slate-700 hover:bg-[#FF5C00]/40'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. SLIDING DRAWER SETTINGS ADJUSTMENTS (MangaLib exact control shelf) */}
                <AnimatePresence>
                  {isSettingsOpen && (
                    <motion.div
                      initial={{ opacity: 0, x: 100 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 100 }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                      className="absolute right-0 top-0 bottom-0 w-72 bg-[#121316] border-l border-white/5 z-40 p-5 space-y-6 shadow-2xl flex flex-col justify-between"
                    >
                      <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                          <span className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                            <Sliders className="w-3.5 h-3.5 text-[#FF5C00]" /> Настройки Ридера
                          </span>
                          <button 
                            onClick={() => setIsSettingsOpen(false)}
                            className="text-xs font-bold text-[#7d8291] hover:text-white"
                          >
                            Закрыть
                          </button>
                        </div>

                        {/* Background Themes selectors */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-black uppercase text-[#7d8291] tracking-wider block">Цветовая гамма</span>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { id: 'dark', label: 'Ночь', cls: 'bg-black border-white/10 text-white' },
                              { id: 'gray', label: 'Графит', cls: 'bg-slate-800 border-white/10 text-white' },
                              { id: 'sepia', label: 'Теплый', cls: 'bg-amber-950 border-amber-900/50 text-amber-200' },
                              { id: 'light', label: 'День', cls: 'bg-slate-100 border-slate-300 text-black' }
                            ].map(theme => (
                              <button
                                key={theme.id}
                                onClick={() => setReadingBg(theme.id as any)}
                                className={`p-1.5 py-2.5 rounded text-[9px] font-black uppercase tracking-wider border transition-all ${theme.cls} ${
                                  readingBg === theme.id ? 'ring-1 ring-[#FF5C00]' : 'opacity-60'
                                }`}
                              >
                                {theme.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Max Image width layout boundaries scale */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-black uppercase text-[#7d8291] tracking-wider block">Максимальная ширина</span>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { id: '600', label: '600px' },
                              { id: '800', label: '800px' },
                              { id: '1000', label: '1000px' },
                              { id: 'full', label: '100%' }
                            ].map(width => (
                              <button
                                key={width.id}
                                onClick={() => setReadingWidth(width.id as any)}
                                className={`py-1.5 border rounded text-[9px] font-extrabold uppercase bg-black/45 border-white/10 text-slate-300 transition-all ${
                                  readingWidth === width.id ? 'text-[#FF5C00] border-[#FF5C00]/40 bg-[#FF5C00]/5' : ''
                                }`}
                              >
                                {width.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Gap space size selectors */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-black uppercase text-[#7d8291] tracking-wider block">Отступы страниц</span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { id: '0', label: 'Без швов' },
                              { id: '12', label: 'Тонкие' },
                              { id: '24', label: 'Широкие' }
                            ].map(gap => (
                              <button
                                key={gap.id}
                                onClick={() => setReadingGap(gap.id as any)}
                                className={`py-1.5 border rounded text-[9px] font-extrabold uppercase bg-black/45 border-white/10 text-slate-300 transition-all ${
                                  readingGap === gap.id ? 'text-[#FF5C00] border-[#FF5C00]/40 bg-[#FF5C00]/5' : ''
                                }`}
                              >
                                {gap.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Bottom close buttons */}
                      <div className="space-y-2 select-none">
                        <span className="text-[8px] font-black uppercase tracking-widest text-[#7d8291] block text-center">Плеер KamiManga v1.2</span>
                        <button 
                          onClick={() => setIsSettingsOpen(false)}
                          className="w-full py-2 bg-[#FF5C00] text-black hover:bg-[#ff6c1a] text-xs font-black uppercase tracking-wider rounded-lg transition-all text-center shrink-0 block"
                        >
                          Сохранить параметры
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};

export default Manga;
