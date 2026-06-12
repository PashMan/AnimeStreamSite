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
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#1c1d21] border border-white/5 w-full max-w-5xl rounded-[2.5rem] overflow-hidden shadow-2xl relative my-8"
            >
              <button 
                onClick={() => setSelectedManga(null)}
                className="absolute top-6 right-6 p-3 bg-[#23252b] hover:bg-primary hover:text-white rounded-2xl text-white transition-all active:scale-95 z-50 shadow-md"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 p-6 sm:p-10">
                {/* Visual Cover bar col */}
                <div className="col-span-1 md:col-span-4 space-y-4">
                  <div className="aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl relative border border-white/5">
                    <img 
                      src={selectedManga.cover} 
                      alt={selectedManga.title} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="bg-[#23252b] p-4 rounded-xl flex items-center justify-around border border-white/5">
                    <div className="text-center">
                      <div className="text-xs text-slate-500 uppercase tracking-wider font-extrabold">Рекорд</div>
                      <div className="text-lg font-black text-white flex items-center gap-1.5 justify-center">
                        <Star className="w-4.5 h-4.5 text-yellow-400 fill-current" /> {selectedManga.rating}
                      </div>
                    </div>
                    <div className="w-px h-8 bg-white/5" />
                    <div className="text-center">
                      <div className="text-xs text-slate-500 uppercase tracking-wider font-extrabold">Главы</div>
                      <div className="text-lg font-black text-primary">
                        {chaptersLoading ? '...' : chapters.length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info and chapters panel */}
                <div className="col-span-1 md:col-span-8 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="px-3 py-1 bg-primary/15 text-primary text-[10px] font-black uppercase tracking-wider rounded-lg border border-primary/30">
                        МАНГА
                      </span>
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-none">
                        {selectedManga.title}
                      </h2>
                      <h3 className="text-lg font-bold text-slate-400">
                        {selectedManga.originalTitle}
                      </h3>
                    </div>
                    <p className="text-slate-300 text-sm md:text-base leading-relaxed font-medium">
                      {selectedManga.description}
                    </p>
                  </div>

                  {/* Chapters List */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-[#FF5C00]">Перевод глав (MangaDex)</h4>
                    
                    {chaptersLoading ? (
                      <div className="py-12 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 text-[#FF5C00] animate-spin mb-3" />
                        <span className="text-xs font-black uppercase text-slate-500 tracking-widest">
                          Загрузка перевода глав...
                        </span>
                      </div>
                    ) : chapters.length === 0 ? (
                      isMangaLicensed ? (
                        <div className="py-8 px-6 text-center border-2 border-red-500/20 bg-red-500/5 text-slate-300 text-sm font-bold uppercase tracking-wider rounded-2xl flex flex-col items-center gap-3">
                          <ShieldAlert className="w-10 h-10 text-red-500 animate-pulse" />
                          <div className="font-black text-red-500 text-base">Лицензировано правообладателем</div>
                          <div className="text-[11px] text-slate-400 normal-case font-semibold max-w-md leading-relaxed">
                            К сожалению, данный тайтл был официально лицензирован правообладателем на территории РФ, и доступ к главам на внешних источниках закрыт.
                          </div>
                        </div>
                      ) : (
                        <div className="py-8 px-6 text-center border border-white/5 border-dashed rounded-2xl flex flex-col items-center gap-3">
                          <BookX className="w-10 h-10 text-slate-600" />
                          <div className="font-extrabold text-slate-500">Копии не найдены</div>
                          <div className="text-[11px] text-slate-500 normal-case font-semibold max-w-sm leading-relaxed">
                            Не удалось получить переводы для этого тайтла. Возможно, он лицензирован или удален.
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {chapters.map((ch) => (
                          <button
                            key={ch.id}
                            onClick={() => startReadingChapter(ch)}
                            className="p-4 bg-[#23252b] border border-white/5 rounded-2xl hover:border-[#FF5C00] hover:bg-[#FF5C00]/10 text-left transition-all active:scale-[0.98] group/chapter flex items-center justify-between cursor-pointer"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-[9px] font-extrabold uppercase text-slate-500 group-hover/chapter:text-[#FF5C00] truncate">
                                {ch.group}
                              </div>
                              <div className="text-sm font-black text-white">Глава {ch.chapter}</div>
                              <div className="text-[10px] text-slate-400 font-semibold truncate">
                                {ch.title}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-600 group-hover/chapter:text-[#FF5C00] transition-transform group-hover/chapter:translate-x-1 shrink-0" />
                          </button>
                        ))}
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
