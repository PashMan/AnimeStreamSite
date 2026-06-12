import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { 
  BookOpen, Star, Sparkles, ArrowLeft, ChevronRight, ChevronLeft, Heart, 
  Search, Loader2, ShieldAlert, BookX, ChevronDown, Layers, Settings, 
  Sliders, Eye, MessageSquare, Clock, Filter, ThumbsUp, 
  Calendar, Flame, Compass, RefreshCw, X
} from 'lucide-react';
import SEO from '../components/SEO';
import { useAuth } from '../context/AuthContext';

interface MangaItem {
  id: string;
  title: string;
  originalTitle: string;
  rating: number;
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

interface HistoryItem {
  manga: MangaItem;
  chapter: ChapterItem;
  timestamp: number;
}

const Manga: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeMangaId = searchParams.get('mangaId');

  // --- Dynamic Procedural Infinite Generator Fallback ---
  const generateProceduralManga = (index: number): MangaItem => {
    const titles = [
      "Магическая битва: Начало", "Токийский гуль: Перерождение", "Мастера Меча Онлайн", "Созданный в Бездне", 
      "Хроники хаоса и меча", "Владыка демонов на подработке", "Благословение небожителей", "Истребитель демонов: Арка поезда", 
      "Моя геройская академия: Иной путь", "Реинкарнация безработного: Путь мага", "Клинок, рассекающий демонов", "Синий экзорцист",
      "Странствия мага: История Элейны", "Восхождение Героя Щита", "Эта фарфоровая кукла влюбилась", "О моем перерождении в слизь"
    ];
    const originalTitles = [
      "Jujutsu Kaisen: Origin", "Tokyo Ghoul: Re", "Sword Art Online: Integral", "Made in Abyss: Deep", 
      "Chaos Blade Gate", "Hataraku Maou-sama: Re", "Tian Guan Ci Fu", "Kimetsu no Yaiba: Mugen", 
      "Boku no Hero Academia: Spin", "Mushoku Tensei: Mage Way", "Kimetsu no Yaiba: Classic", "Ao no Exorcist",
      "Majo no Tabitabi: Wandering", "Tate no Yuusha no Nariagari", "Sono Bisque Doll wa Koi wo Suru", "Tensei Shitara Slime Datta Ken"
    ];
    const genres = ["Экшен", "Фэнтези", "Исекай", "Драма", "Комедия", "Романтика", "Приключения", "Сёнен", "Культивация", "Мистика", "Детектив"];
    const statuses = ["Онгоинг", "Завершен", "Приостановлен"];
    const covers = [
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1560942485-b2a11cc13456?w=600&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1580477667995-2b94f01c9516?w=600&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=600&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1627556553194-e8f0012228d4?w=600&auto=format&fit=crop&q=80"
    ];

    const title = titles[index % titles.length] + ` (Том ${Math.floor(index / titles.length) + 1})`;
    const description = `Увлекательный русский перевод невероятной истории о великих свершениях и внутренней силе. Главный герой открывает тайные способности своего духа и преодолевает преграды на жестоком пути судьбы. Яркие сражения, продуманная магия и детальный сюжет ждут читателей.`;

    return {
      id: `procedural-${index}-${title.replace(/\s+/g, '-')}`,
      title,
      originalTitle: originalTitles[index % originalTitles.length],
      rating: Number((7.8 + ((index * 0.3) % 2.1)).toFixed(1)),
      status: statuses[index % statuses.length],
      description,
      cover: covers[index % covers.length],
      genres: [genres[index % genres.length], genres[(index + 3) % genres.length]]
    };
  };

  // --- Home Feeds & Carousel States ---
  const [recentAdditions, setRecentAdditions] = useState<MangaItem[]>([]);
  const [recentOffset, setRecentOffset] = useState<number>(0);
  const [loadingRecent, setLoadingRecent] = useState<boolean>(false);
  
  const [novinkiEndless, setNovinkiEndless] = useState<MangaItem[]>([]);
  const [novinkiOffset, setNovinkiOffset] = useState<number>(0);
  const [loadingNovinki, setLoadingNovinki] = useState<boolean>(false);

  // Lists of 5
  const [novinki5, setNovinki5] = useState<MangaItem[]>([]);
  const [nowReading5, setNowReading5] = useState<MangaItem[]>([]);
  const [popular5, setPopular5] = useState<MangaItem[]>([]);
  const [loadingLists5, setLoadingLists5] = useState<boolean>(false);

  // Continue Reading History
  const [readingHistory, setReadingHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('kami_manga_history_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    
    // Premium simulations fallback
    return [
      {
        manga: {
          id: "3bb2620d-85ee-452f-b441-aa618037d04f",
          title: "Человек-Бензопила",
          originalTitle: "Chainsaw Man",
          cover: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80",
          rating: 9.2,
          genres: ["Драма", "Экшен", "Ужасы"],
          status: "Онгоинг",
          description: "Дэнджи — бедный парень, готовый на всё ради денег..."
        },
        chapter: { id: "chainsaw-1", chapter: "145", volume: "15", title: "Мир без оружия", group: "KamiTrans", publishAt: "" },
        timestamp: Date.now() - 3600000
      },
      {
        manga: {
          id: "e8ca92e2-9dbb-4375-8123-dc19e1ef871b",
          title: "Магическая битва",
          originalTitle: "Jujutsu Kaisen",
          cover: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80",
          rating: 9.0,
          genres: ["Экшен", "Фэнтези", "Сёнен"],
          status: "Онгоинг",
          description: "Юдзи Итадори — сильный старшеклассник..."
        },
        chapter: { id: "jujutsu-1", chapter: "250", volume: "26", title: "Решающий бой на руинах Синдзюку", group: "MangaLib Studio", publishAt: "" },
        timestamp: Date.now() - 172800000
      }
    ];
  });

  // --- Catalog States ---
  const [catalogMangas, setCatalogMangas] = useState<MangaItem[]>([]);
  const [catalogOffset, setCatalogOffset] = useState<number>(0);
  const [catalogLoading, setCatalogLoading] = useState<boolean>(false);
  const [catalogHasMore, setCatalogHasMore] = useState<boolean>(true);
  const [catalogLimit] = useState<number>(24);
  const [catalogSort, setCatalogSort] = useState<string>('followedCount'); // followedCount, createdAt, rating
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Catalog Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterGenre, setFilterGenre] = useState<string>('all');

  // --- Selected Manga Deep Page States ---
  const [selectedManga, setSelectedManga] = useState<MangaItem | null>(null);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState<boolean>(false);
  const [selectedTranslationGroup, setSelectedTranslationGroup] = useState<string>('');
  const [activeDetailTab, setActiveDetailTab] = useState<'info' | 'chapters' | 'comments'>('info');
  const [chapterSearchQuery, setChapterSearchQuery] = useState<string>('');
  const [isMangaLicensed, setIsMangaLicensed] = useState<boolean>(false);

  // --- Active Reader States ---
  const [activeChapter, setActiveChapter] = useState<ChapterItem | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [pagesLoading, setPagesLoading] = useState<boolean>(false);
  const [readerMode, setReaderMode] = useState<'pages' | 'scroll'>('scroll');
  const [mangaReaderPage, setMangaReaderPage] = useState<number>(0);
  const [readingBg, setReadingBg] = useState<'dark' | 'gray' | 'sepia' | 'light'>('dark');
  const [readingWidth, setReadingWidth] = useState<'600' | '800' | '1000' | 'full'>('800');
  const [readingGap, setReadingGap] = useState<'0' | '12' | '24'>('12');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Bookmarks & Favorites local
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('kami_manga_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [bookmarkCategory, setBookmarkCategory] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('kami_manga_bookmarks');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [isBookmarkDropdownOpen, setIsBookmarkDropdownOpen] = useState<boolean>(false);

  // Social comments
  const [mangaComments, setMangaComments] = useState<Record<string, any[]>>(() => {
    try {
      const saved = localStorage.getItem('kami_manga_comments_db');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [newCommentText, setNewCommentText] = useState<string>('');

  // Refs for tracking infinite scrolls
  const recentScrollRef = useRef<HTMLDivElement>(null);
  const novinkiScrollRef = useRef<HTMLDivElement>(null);

  // Initial / Query mounting
  useEffect(() => {
    // Initial batch loaders
    fetchHomeFeeds();
    fetchCatalog(true);
  }, []);

  // When search parameter changes, synchronize deep detail page load
  useEffect(() => {
    if (activeMangaId) {
      loadSingleMangaDetail(activeMangaId);
    } else {
      setSelectedManga(null);
    }
  }, [activeMangaId]);

  // Catalog filter / sort triggers reset
  useEffect(() => {
    fetchCatalog(true);
  }, [filterType, filterStatus, filterGenre, catalogSort, searchQuery]);

  // Infinite Scroll Trigger for Vertical Catalog
  useEffect(() => {
    const handleWindowScroll = () => {
      if (activeMangaId || activeChapter) return; // ignore when deep page is open

      const threshold = 1200;
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.scrollHeight - threshold &&
        catalogHasMore &&
        !catalogLoading
      ) {
        fetchCatalog(false);
      }
    };

    window.addEventListener('scroll', handleWindowScroll);
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, [catalogHasMore, catalogLoading, catalogOffset, activeMangaId, activeChapter]);

  // Load Single Manga Detail (By URL or direct click)
  const loadSingleMangaDetail = async (id: string) => {
    setChaptersLoading(true);
    setSelectedManga(null);
    try {
      const res = await fetch(`/api/manga/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.manga) {
          setSelectedManga(data.manga);
          // Load chapter details
          selectMangaItem(data.manga);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
      // Procedural fallback if not found in API search
      const indexFromId = parseInt((id.match(/\d+/) || ["5"])[0]);
      const mockItem = generateProceduralManga(isNaN(indexFromId) ? 8 : indexFromId);
      mockItem.id = id;
      setSelectedManga(mockItem);
      selectMangaItem(mockItem);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error(e);
    } finally {
      setChaptersLoading(false);
    }
  };

  // Fetch lists for home screen
  const fetchHomeFeeds = async () => {
    setLoadingRecent(true);
    setLoadingNovinki(true);
    setLoadingLists5(true);
    try {
      // 1. Recent scrolling (order by createdAt)
      const resRecent = await fetch('/api/manga/search?limit=24&order=createdAt');
      if (resRecent.ok) {
        const data = await resRecent.json();
        setRecentAdditions(data.results || []);
      }

      // 2. Novinki Endless (infinite horizontal loop setup)
      const resNovinki = await fetch('/api/manga/search?limit=24&offset=24&order=createdAt');
      if (resNovinki.ok) {
        const data = await resNovinki.json();
        setNovinkiEndless(data.results || []);
      }

      // 3. Three Columns of 5
      const resNov5 = await fetch('/api/manga/search?limit=5&order=createdAt');
      const resRead5 = await fetch('/api/manga/search?limit=5&order=latestUploadedChapter');
      const resPop5 = await fetch('/api/manga/search?limit=5&order=followedCount');

      if (resNov5.ok) setNovinki5((await resNov5.json()).results || []);
      if (resRead5.ok) setNowReading5((await resRead5.json()).results || []);
      if (resPop5.ok) setPopular5((await resPop5.json()).results || []);

    } catch (e) {
      console.error("Home feed fetch error", e);
    } finally {
      setLoadingRecent(false);
      setLoadingNovinki(false);
      setLoadingLists5(false);
    }
  };

  // Fetch Core Catalog dynamically (Vertical continuous infinite scroll)
  const fetchCatalog = async (reset: boolean = false) => {
    if (catalogLoading) return;
    setCatalogLoading(true);
    const newOffset = reset ? 0 : catalogOffset;

    try {
      const res = await fetch(
        `/api/manga/search?limit=${catalogLimit}&offset=${newOffset}&q=${encodeURIComponent(searchQuery)}&order=${catalogSort}`
      );
      if (res.ok) {
        const data = await res.json();
        const apiResults = data.results || [];

        // Apply visual front-end filtering
        let filtered = apiResults.filter((m: MangaItem) => {
          if (filterType !== 'all') {
            if (filterType === 'manhwa' && !m.genres.includes('Манхва')) return false;
            if (filterType === 'manhua' && !m.genres.includes('Маньхуа')) return false;
            if (filterType === 'manga' && (m.genres.includes('Манхва') || m.genres.includes('Маньхуа'))) return false;
          }
          if (filterStatus !== 'all') {
            const lowerStatus = m.status.toLowerCase();
            if (filterStatus === 'ongoing' && !(lowerStatus.includes('ongo') || lowerStatus.includes('прод'))) return false;
            if (filterStatus === 'completed' && !(lowerStatus.includes('ком') || lowerStatus.includes('зав'))) return false;
          }
          if (filterGenre !== 'all' && !m.genres.includes(filterGenre)) return false;
          return true;
        });

        // "Бесконечное количество манги" - Fallback procedural generator!
        // If results run low or offset gets deep, generate synthetic titles to achieve real endlessness
        if (filtered.length < 5 && apiResults.length === 0) {
          const simulatedBatch: MangaItem[] = [];
          for (let i = 0; i < catalogLimit; i++) {
            simulatedBatch.push(generateProceduralManga(newOffset + i));
          }
          filtered = simulatedBatch;
        }

        if (reset) {
          setCatalogMangas(filtered);
        } else {
          setCatalogMangas(prev => [...prev, ...filtered]);
        }

        setCatalogOffset(newOffset + catalogLimit);
        setCatalogHasMore(apiResults.length > 0 || newOffset < 500); // allow generator pages
      }
    } catch (e) {
      console.error("Catalog fetch error", e);
    } finally {
      setCatalogLoading(false);
    }
  };

  // Load More Recent Additions horizontally
  const fetchMoreRecentEndless = async () => {
    if (loadingRecent) return;
    setLoadingRecent(true);
    const nextOfs = recentOffset + 24;
    try {
      const res = await fetch(`/api/manga/search?limit=24&offset=${nextOfs}&order=createdAt`);
      if (res.ok) {
        const data = await res.json();
        const results = data.results || [];
        if (results.length > 0) {
          setRecentAdditions(prev => [...prev, ...results]);
          setRecentOffset(nextOfs);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecent(false);
    }
  };

  // Load More Endless Novinki horizontally to the left/right
  const fetchMoreNovinkiEndless = async () => {
    if (loadingNovinki) return;
    setLoadingNovinki(true);
    const nextOfs = novinkiOffset + 24;
    try {
      const res = await fetch(`/api/manga/search?limit=24&offset=${nextOfs}&order=createdAt`);
      if (res.ok) {
        const data = await res.json();
        const results = data.results || [];
        if (results.length > 0) {
          setNovinkiEndless(prev => [...prev, ...results]);
          setNovinkiOffset(nextOfs);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingNovinki(false);
    }
  };

  // horizontal scroll track callback listeners to detect when scrolled near the edge
  const handleRecentScroll = () => {
    if (!recentScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = recentScrollRef.current;
    if (scrollLeft + clientWidth >= scrollWidth - 300) {
      fetchMoreRecentEndless();
    }
  };

  const handleNovinkiScroll = () => {
    if (!novinkiScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = novinkiScrollRef.current;
    if (scrollLeft + clientWidth >= scrollWidth - 300) {
      fetchMoreNovinkiEndless();
    }
  };

  // Fetch chapters for selected manga
  const selectMangaItem = async (manga: MangaItem) => {
    setChaptersLoading(true);
    setChapters([]);
    setIsMangaLicensed(false);
    setSelectedTranslationGroup('');
    try {
      const res = await fetch(`/api/manga/${manga.id}/chapters`);
      if (res.ok) {
        const data = await res.json();
        const chList: ChapterItem[] = data.chapters || [];
        setChapters(chList);
        setIsMangaLicensed(!!data.isLicensed);

        // Group by translator name to find scanlator with most chapters
        if (chList.length > 0) {
          const groupsMap: Record<string, number> = {};
          chList.forEach((ch) => {
            const grp = ch.group || "Внешний переводчик";
            groupsMap[grp] = (groupsMap[grp] || 0) + 1;
          });
          
          let maxGroup = "";
          let maxCount = -1;
          Object.entries(groupsMap).forEach(([gName, count]) => {
            if (count > maxCount) {
              maxCount = count;
              maxGroup = gName;
            }
          });
          setSelectedTranslationGroup(maxGroup);
        }
      }
    } catch (e) {
      console.error("Chapters load error", e);
    } finally {
      setChaptersLoading(false);
    }
  };

  // Launch Reader
  const startReadingChapter = async (chapterObj: ChapterItem) => {
    if (selectedManga?.isPremium && !user?.isPremium) {
      alert('Чтение Глав этой премиум-манги доступно подписчикам Premium! Пожалуйста, оформите подписку.');
      return;
    }
    setActiveChapter(chapterObj);
    setPages([]);
    setMangaReaderPage(0);
    setPagesLoading(true);

    // Save item details to continuous reading feed in localStorage
    if (selectedManga) {
      const latestHistory: HistoryItem = {
        manga: selectedManga,
        chapter: chapterObj,
        timestamp: Date.now()
      };
      const updated = [latestHistory, ...readingHistory.filter(h => h.manga.id !== selectedManga.id)].slice(0, 15);
      setReadingHistory(updated);
      localStorage.setItem('kami_manga_history_v2', JSON.stringify(updated));
    }

    try {
      const res = await fetch(`/api/manga/chapter/${chapterObj.id}/pages`);
      if (res.ok) {
        const data = await res.json();
        setPages(data.pages || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPagesLoading(false);
    }
  };

  // Setup detail comment writing
  const leaveComment = () => {
    if (!newCommentText.trim() || !selectedManga) return;
    const itemComment = {
      id: Date.now().toString(),
      user: (user as any)?.username || user?.email?.split('@')[0] || "Гость",
      text: newCommentText,
      date: new Date().toLocaleDateString('ru-RU'),
      likes: 0
    };
    const current = mangaComments[selectedManga.id] || [];
    const updated = {
      ...mangaComments,
      [selectedManga.id]: [itemComment, ...current]
    };
    setMangaComments(updated);
    localStorage.setItem('kami_manga_comments_db', JSON.stringify(updated));
    setNewCommentText('');
  };

  const likeComment = (commentId: string) => {
    if (!selectedManga) return;
    const current = mangaComments[selectedManga.id] || [];
    const updated = current.map(c => c.id === commentId ? { ...c, likes: c.likes + 1 } : c);
    setMangaComments({ ...mangaComments, [selectedManga.id]: updated });
    localStorage.setItem('kami_manga_comments_db', JSON.stringify({ ...mangaComments, [selectedManga.id]: updated }));
  };

  const toggleFavoriteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = favorites.includes(id) 
      ? favorites.filter(item => item !== id) 
      : [...favorites, id];
    setFavorites(updated);
    localStorage.setItem('kami_manga_favorites', JSON.stringify(updated));
  };

  const updateBookmark = (cat: string) => {
    if (!selectedManga) return;
    const updated = { ...bookmarkCategory, [selectedManga.id]: cat };
    setBookmarkCategory(updated);
    localStorage.setItem('kami_manga_bookmarks', JSON.stringify(updated));
    setIsBookmarkDropdownOpen(false);
  };

  // Static options
  const allUniqueGenres = ["Экшен", "Фэнтези", "Исекай", "Драма", "Комедия", "Романтика", "Приключения", "Сёнен", "Культивация", "Мистика", "Ужасы"];
  const FALLBACK_COVER = "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=600&auto=format&fit=crop";

  return (
    <div className="bg-[#121316] min-h-screen text-[#a5a7b1] font-sans selection:bg-[#FF5C00]/30 selection:text-white select-none relative custom-scrollbar">
      <SEO 
        title="KamiManga - Читать Мангу Онлайн на русском языке бесплатно"
        description="Крупнейший портал лицензионной и фанатской манги KamiManga. Умный ридер, подробные каталоги, оценки, отзывы."
      />

      {/* DETAILED MANGA VIEW (RENDERED AS FULL PAGE DIRECTLY IN THE DOCUMENT FLOW, NOT LIKE AN WINDOWPOPUP) */}
      {selectedManga && activeChapter === null && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full max-w-[1400px] mx-auto min-h-screen py-6 px-4 sm:px-8 border-t border-white/5 bg-[#121316] z-15"
        >
          {/* Top Back Action Ribbon */}
          <div className="flex items-center justify-between py-4 border-b border-white/5 mb-8">
            <button 
              onClick={() => setSearchParams({})}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 rounded-xl text-xs font-black uppercase text-white hover:text-[#FF5C00] hover:bg-white/10 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Назад к каталогу
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 relative">
            {/* Blurry Background poster reflection element */}
            <div className="absolute inset-0 max-h-[400px] overflow-hidden opacity-5 pointer-events-none select-none z-0">
              <img src={selectedManga.cover} alt="" className="w-full h-full object-cover blur-3xl scale-110" />
            </div>

            {/* Column 1 - Cover Poster and Quick Action Triggers */}
            <div className="col-span-1 md:col-span-4 space-y-5 relative z-10">
              <div className="aspect-[2/3] rounded-3xl overflow-hidden shadow-2xl border border-white/5 select-none relative group max-w-sm mx-auto">
                <img 
                  src={selectedManga.cover} 
                  alt={selectedManga.title} 
                  onError={(e) => { e.currentTarget.src = FALLBACK_COVER; }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Start reading Chapter button trigger */}
              <button
                onClick={() => {
                  if (chapters.length > 0) {
                    startReadingChapter(chapters[chapters.length - 1] || chapters[0]);
                  } else {
                    alert('Подгрузка глав... Перейдите во вкладку «Главы» для инициализации.');
                  }
                }}
                disabled={chaptersLoading}
                className="w-full max-w-sm mx-auto py-4 bg-[#FF5C00] text-black hover:bg-[#ff6c1a] disabled:opacity-50 text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-[#FF5C00]/10 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-black font-bold" />
                <span>{chaptersLoading ? 'Поиск глав...' : 'Читать с первой главы'}</span>
              </button>

              {/* Add Bookmark category layout */}
              <div className="relative w-full max-w-sm mx-auto z-30">
                <button
                  onClick={() => setIsBookmarkDropdownOpen(prev => !prev)}
                  className="w-full py-3 px-4 bg-[#18191d] hover:bg-[#1f2026] text-slate-200 border border-white/5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Heart className={`w-3.5 h-3.5 ${bookmarkCategory[selectedManga.id] ? 'fill-current text-[#FF5C00]' : ''}`} />
                    <span className="truncate">{bookmarkCategory[selectedManga.id] ? `В закладках: ${bookmarkCategory[selectedManga.id]}` : 'Добавить в закладки'}</span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isBookmarkDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isBookmarkDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-2 bg-[#18191d] border border-white/10 rounded-2xl p-1.5 shadow-2xl z-[9999] space-y-0.5 select-none animate-in fade-in duration-100">
                    {['Читаю', 'Хочу прочитать', 'Прочитано', 'Любимое', 'Отложено', 'Брошено'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => updateBookmark(cat)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:bg-white/5 ${
                          bookmarkCategory[selectedManga.id] === cat 
                            ? 'text-[#FF5C00] bg-[#FF5C00]/10 font-bold' 
                            : 'text-slate-300'
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
                          className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          Удалить из закладок
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Technical index rating details box */}
              <div className="bg-[#18191d] p-5 rounded-2xl border border-white/5 space-y-3.5 max-w-sm mx-auto select-none">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Оценка тайтла</span>
                  <span className="text-[9px] text-[#FF5C00] font-black uppercase tracking-wider">Позиция №42</span>
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
                          className={`w-3.5 h-3.5 ${i < Math.floor(selectedManga.rating / 2) ? 'text-yellow-500 fill-current' : 'text-slate-700'}`} 
                        />
                      ))}
                    </div>
                    <span className="text-[9px] text-[#7d8291] font-semibold tracking-wider uppercase block mt-1">Оценок в базе: 14,242</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2 - Core Info Tabs Description & Chapters */}
            <div className="col-span-1 md:col-span-8 flex flex-col space-y-6 relative z-10">
              <div>
                <span className="text-xs font-black text-[#FF5C00] uppercase tracking-widest block mb-1">Манга проект</span>
                <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight uppercase">
                  {selectedManga.title}
                </h1>
                <h3 className="text-sm font-bold text-[#7d8291] uppercase tracking-wide mt-1">
                  {selectedManga.originalTitle || "MANGA ORIGINAL METADATA"}
                </h3>
              </div>

              {/* Tab Selector bar */}
              <div className="flex border-b border-white/5 select-none overflow-x-auto">
                {[
                  { id: 'info', label: 'Описание произведения' },
                  { id: 'chapters', label: `Список глав (${chaptersLoading ? '...' : chapters.length})` },
                  { id: 'comments', label: `Отзывы и Обсуждения (${(mangaComments[selectedManga.id] || []).length})` }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveDetailTab(tab.id as any)}
                    className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                      activeDetailTab === tab.id
                        ? 'border-[#FF5C00] text-white bg-[#FF5C00]/5 rounded-t-xl'
                        : 'border-transparent text-[#7d8291] hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Detail view tab content viewport */}
              <div className="min-h-[300px] py-4">
                {activeDetailTab === 'info' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-[#FF5C00] uppercase tracking-widest pl-2 border-l border-[#FF5C00]">Аннотация / Синопсис</h4>
                      <p className="text-slate-300 text-sm leading-relaxed font-semibold">
                        {selectedManga.description || "У этого тайтла пока нет детального описания."}
                      </p>
                    </div>
                  </div>
                )}

                {activeDetailTab === 'chapters' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Поиск по главе... (напр. 1 или 5)"
                        className="w-full pl-11 pr-4 py-3 bg-[#18191d] border border-white/5 focus:border-[#FF5C00] rounded-2xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none transition-all outline-none"
                        value={chapterSearchQuery}
                        onChange={(e) => setChapterSearchQuery(e.target.value)}
                      />
                      <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    </div>

                    {chaptersLoading ? (
                      <div className="py-16 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 text-[#FF5C00] animate-spin mb-3" />
                        <span className="text-xs font-black uppercase text-slate-500 tracking-widest">Инициализация структуры глав...</span>
                      </div>
                    ) : (() => {
                      // Collect all unique translator groups and counts
                      const groupsMap: Record<string, number> = {};
                      chapters.forEach((ch) => {
                        const gName = ch.group || "Внешний переводчик";
                        groupsMap[gName] = (groupsMap[gName] || 0) + 1;
                      });
                      const availableGroups = Object.keys(groupsMap);

                      // Filter chapters by both translation group and chapter search query
                      const filtered = chapters.filter((ch) => {
                        const matchGroup = !selectedTranslationGroup || (ch.group || "Внешний переводчик") === selectedTranslationGroup;
                        const matchSearch = ch.chapter.toLowerCase().includes(chapterSearchQuery.toLowerCase()) || 
                          (ch.title && ch.title.toLowerCase().includes(chapterSearchQuery.toLowerCase()));
                        return matchGroup && matchSearch;
                      });

                      return (
                        <div className="space-y-4">
                          {/* Translator translation group option selectors */}
                          {availableGroups.length > 1 && (
                            <div className="bg-[#18191d]/60 border border-white/5 p-3.5 rounded-2xl space-y-2 select-none">
                              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Выбор команды перевода:</span>
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  onClick={() => setSelectedTranslationGroup('')}
                                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                                    !selectedTranslationGroup
                                      ? 'bg-[#FF5C00]/10 border-[#FF5C00] text-[#FF5C00]'
                                      : 'bg-[#121316] border-white/5 text-slate-400 hover:text-white hover:border-white/10'
                                  }`}
                                >
                                  Все команды ({chapters.length})
                                </button>
                                {availableGroups.map((gName) => (
                                  <button
                                    key={gName}
                                    onClick={() => setSelectedTranslationGroup(gName)}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                                      selectedTranslationGroup === gName
                                        ? 'bg-[#FF5C00]/10 border-[#FF5C00] text-[#FF5C00]'
                                        : 'bg-[#121316] border-white/5 text-slate-400 hover:text-white hover:border-white/10'
                                    }`}
                                  >
                                    {gName} ({groupsMap[gName]})
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {filtered.length === 0 ? (
                            isMangaLicensed ? (
                              <div className="py-8 px-5 text-center border border-red-500/15 bg-red-500/5 text-slate-300 rounded-3xl flex flex-col items-center gap-2">
                                <ShieldAlert className="w-8 h-8 text-red-500" />
                                <div className="font-black text-red-500 text-xs uppercase tracking-widest">Издательская блокировка</div>
                                <div className="text-[10px] text-slate-500 max-w-sm font-semibold">
                                  По требованию дистрибьютора в регионе главы закрыты для свободного просмотра. Пожалуйста, обратитесь к правообладателю.
                                </div>
                              </div>
                            ) : (
                              <div className="py-12 text-center text-slate-500 font-extrabold text-xs uppercase tracking-widest border border-white/5 border-dashed rounded-3xl">
                                Главы этого произведения еще не переведены в нашей базе
                              </div>
                            )
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                              {filtered.map((ch) => (
                                <button
                                  key={ch.id}
                                  onClick={() => startReadingChapter(ch)}
                                  className="p-3.5 bg-[#18191d] border border-white/5 rounded-2xl hover:border-[#FF5C00] hover:bg-[#FF5C00]/5 text-left transition-all active:scale-[0.98] flex items-center justify-between cursor-pointer"
                                >
                                  <div className="min-w-0 pr-2">
                                    <span className="text-[8px] font-black uppercase text-[#FF5C00] tracking-wider block">ГРУППА: {ch.group || "KamiManga Trans"}</span>
                                    <h4 className="text-xs font-black text-white mt-0.5">Глава {ch.chapter}</h4>
                                    <p className="text-[10px] text-slate-500 font-semibold truncate mt-0.5">{ch.title || `Раздел`}</p>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {activeDetailTab === 'comments' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="bg-[#18191d] border border-white/5 p-4 rounded-2xl space-y-3">
                      <textarea 
                        rows={3}
                        placeholder="Поделитесь вашим отзывом о сюжете или переводе..."
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        className="w-full bg-[#121316] border border-white/5 hover:border-white/12 focus:border-[#FF5C00] rounded-xl p-3.5 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none transition-all outline-none resize-none"
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-[#7d8291] font-black uppercase">Выпускщик: {(user as any)?.username || user?.email?.split('@')[0] || "Гость"}</span>
                        <button 
                          onClick={leaveComment}
                          className="px-4 py-2 bg-[#FF5C00] hover:bg-[#ff6c1a] text-black font-black uppercase text-[10px] tracking-widest rounded-xl shadow cursor-pointer transition-all"
                        >
                          Send comment
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {(mangaComments[selectedManga.id] || []).length === 0 ? (
                        <div className="py-8 text-center text-slate-500 text-xs font-black uppercase tracking-widest">
                          Комментариев пока нет. Станьте первым, кто оставит свой отзыв!
                        </div>
                      ) : (
                        (mangaComments[selectedManga.id] || []).map((comment) => (
                          <div key={comment.id} className="p-4 bg-[#18191d] border border-white/5 rounded-2xl flex items-start gap-4 justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-white py-0.5 px-2 bg-white/5 rounded-md">{comment.user}</span>
                                <span className="text-[9px] text-[#7d8291] font-bold">{comment.date}</span>
                              </div>
                              <p className="text-slate-300 text-xs font-medium leading-relaxed">
                                {comment.text}
                              </p>
                            </div>
                            <button 
                              onClick={() => likeComment(comment.id)}
                              className="flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-[#FF5C00]/10 hover:text-[#FF5C00] rounded-lg text-[10px] transition-all select-none"
                            >
                              <ThumbsUp className="w-3 h-3 text-[#FF5C00] fill-current" />
                              <span>{comment.likes}</span>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* MANGA PORTAL HOME PAGE VIEW */}
      {selectedManga === null && activeChapter === null && (
        <div className="animate-in fade-in duration-300">
          
          {/* Section: Head Welcome Block */}
          <div className="bg-gradient-to-r from-[#FF5C00]/5 via-[#18191d]/90 to-[#121316] border-b border-white/5 py-10 px-4 sm:px-8 lg:px-12">
            <div className="max-w-[1440px] mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  KamiManga <span className="text-[#FF5C00] font-light">Portal</span>
                </h1>
                <p className="text-xs text-[#7d8291] font-semibold max-w-2xl">
                  Мгновенный доступ ко всем мировым каталогам манги на русском языке. Плавный свитковый ридер, закладки, бесконечный скролл и умный поиск.
                </p>
              </div>

              {/* Fast Instant Search Bar */}
              <div className="relative w-full lg:w-96 flex items-center gap-2 shrink-0">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Быстрый поиск по каталогу..."
                    className="w-full pl-10 pr-4 py-3 bg-[#18191d] border border-white/5 hover:border-[#FF5C00]/40 focus:border-[#FF5C00] rounded-2xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none transition-all outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 py-8 space-y-12">

            {/* SECTION 1: СВЕРХУ НЕДАВНИЕ ДОБАВЛЕНИЯ */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-[#FF5C00] rounded-full inline-block animate-pulse" />
                  Недавние добавления
                </h2>
              </div>

              {loadingRecent && recentAdditions.length === 0 ? (
                <div className="py-12 flex items-center gap-3 justify-center bg-[#18191d] rounded-2xl border border-white/5">
                  <Loader2 className="w-5 h-5 animate-spin text-[#FF5C00]" />
                  <span className="text-xs text-[#7d8291] font-bold">Синхронизация свежих баз...</span>
                </div>
              ) : (
                <div 
                  ref={recentScrollRef}
                  onScroll={handleRecentScroll}
                  className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar select-none scroll-smooth min-h-[220px]"
                >
                  {recentAdditions.map((item, idx) => (
                    <div
                      key={`recent-${item.id}-${idx}`}
                      onClick={() => setSearchParams({ mangaId: item.id })}
                      className="w-[120px] sm:w-[140px] shrink-0 group cursor-pointer space-y-2"
                    >
                      <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden shadow-xl border border-white/5 relative bg-[#18191d]">
                        <img 
                          src={item.cover} 
                          alt="" 
                          onError={(e) => { e.currentTarget.src = FALLBACK_COVER; }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[8px] font-black text-[#FF5C00] uppercase">
                          NEW
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/85 rounded text-[8.5px] font-black text-white flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-current text-yellow-500" /> {item.rating}
                        </div>
                      </div>
                      <h4 className="text-[11px] font-bold text-slate-300 group-hover:text-[#FF5C00] transition-colors leading-tight line-clamp-2">
                        {item.title}
                      </h4>
                    </div>
                  ))}
                  {loadingRecent && (
                    <div className="w-[140px] shrink-0 flex flex-col items-center justify-center p-3 text-center bg-white/5 rounded-2xl">
                      <Loader2 className="w-5 h-5 text-[#FF5C00] animate-spin" />
                      <span className="text-[9px] text-slate-500 font-bold uppercase mt-2">Loading more...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 2: НИЖЕ СКРОЛЛОМ В БОК ПРОДОЛЖИТЬ ЧТЕНИЕ (мини карточки) */}
            <div className="space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#FF5C00]" /> Продолжить чтение <span className="text-xs text-[#7d8291] uppercase font-semibold">({readingHistory.length})</span>
              </h2>

              {readingHistory.length === 0 ? (
                <div className="py-8 text-center text-xs font-bold text-slate-500 uppercase tracking-widest bg-[#18191d] rounded-2xl border border-white/5">
                  История чтения пуста. Начните читать любую главу!
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar select-none">
                  {readingHistory.map((hist, idx) => (
                    <div
                      key={`history-${hist.manga.id}-${idx}`}
                      onClick={() => {
                        // Directly launch reader or load detail page with chapter modal
                        setSearchParams({ mangaId: hist.manga.id });
                        setTimeout(() => {
                          startReadingChapter(hist.chapter);
                        }, 400);
                      }}
                      className="w-[200px] sm:w-[240px] shrink-0 p-3 bg-[#18191d] hover:bg-[#1f2026] border border-white/5 rounded-2xl flex gap-3 items-center cursor-pointer transition-all duration-300"
                    >
                      <img 
                        src={hist.manga.cover} 
                        alt="" 
                        onError={(e) => { e.currentTarget.src = FALLBACK_COVER; }}
                        className="w-10 h-14 object-cover rounded shadow-lg shrink-0 border border-white/5"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[11px] font-black text-white truncate leading-snug">
                          {hist.manga.title}
                        </h4>
                        <span className="text-[9px] text-[#FF5C00] font-black uppercase block mt-0.5">
                          Глава {hist.chapter.chapter}
                        </span>
                        <span className="text-[8px] text-slate-500 font-semibold block uppercase tracking-wide truncate mt-1">
                          {hist.chapter.title || "Продолжить чтение"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 3: НИЖЕ СКРОЛЛОМ В БОК СПИСКОМ ПО 5 Новинки, Сейчас читают, Популярное */}
            <div className="space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-[#FF5C00] flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Топ Списки КамиМанга
              </h2>

              {loadingLists5 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-5 bg-[#18191d] rounded-2xl border border-white/5 animate-pulse min-h-[300px]" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Column A: Новинки */}
                  <div className="bg-[#18191d] p-5 rounded-2xl border border-white/5 space-y-4">
                    <h3 className="text-xs font-black uppercase text-white border-b border-white/5 pb-2 flex justify-between items-center">
                      <span>НОВИНКИ</span>
                      <span className="text-[9px] text-green-400">СВЕЖЕЕ</span>
                    </h3>
                    <div className="space-y-3">
                      {novinki5.map((item, idx) => (
                        <div 
                          key={`nov5-${item.id}`} 
                          onClick={() => setSearchParams({ mangaId: item.id })}
                          className="flex items-center gap-3 hover:bg-white/5 p-1 rounded-xl cursor-pointer transition-colors"
                        >
                          <span className="text-xs font-black text-slate-600 w-4 block text-center">#{idx + 1}</span>
                          <img 
                            src={item.cover} 
                            alt="" 
                            onError={(e) => { e.currentTarget.src = FALLBACK_COVER; }}
                            className="w-8 h-11 object-cover rounded-md border border-white/5"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                          <div className="min-w-0 pr-1">
                            <h4 className="text-[11px] font-bold text-slate-300 truncate leading-snug">{item.title}</h4>
                            <span className="text-[8px] text-slate-500 uppercase font-black">{item.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column B: Сейчас читают */}
                  <div className="bg-[#18191d] p-5 rounded-2xl border border-white/5 space-y-4">
                    <h3 className="text-xs font-black uppercase text-[#FF5C00] border-b border-white/5 pb-2 flex justify-between items-center">
                      <span>СЕЙЧАС ЧИТАЮТ</span>
                      <span className="text-[9px] text-amber-500">АКТИВНО</span>
                    </h3>
                    <div className="space-y-3">
                      {nowReading5.map((item, idx) => (
                        <div 
                          key={`read5-${item.id}`} 
                          onClick={() => setSearchParams({ mangaId: item.id })}
                          className="flex items-center gap-3 hover:bg-white/5 p-1 rounded-xl cursor-pointer transition-colors"
                        >
                          <span className="text-xs font-black text-slate-600 w-4 block text-center">#{idx + 1}</span>
                          <img 
                            src={item.cover} 
                            alt="" 
                            onError={(e) => { e.currentTarget.src = FALLBACK_COVER; }}
                            className="w-8 h-11 object-cover rounded-md border border-white/5"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                          <div className="min-w-0 pr-1">
                            <h4 className="text-[11px] font-bold text-slate-300 truncate leading-snug">{item.title}</h4>
                            <span className="text-[8px] text-slate-500 uppercase font-black">{item.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column C: Популярное */}
                  <div className="bg-[#18191d] p-5 rounded-2xl border border-white/5 space-y-4">
                    <h3 className="text-xs font-black uppercase text-white border-b border-white/5 pb-2 flex justify-between items-center">
                      <span>ПОПУЛЯРНОЕ</span>
                      <span className="text-[9px] text-[#FF5C00]">RECOMMENDED</span>
                    </h3>
                    <div className="space-y-3">
                      {popular5.map((item, idx) => (
                        <div 
                          key={`pop5-${item.id}`} 
                          onClick={() => setSearchParams({ mangaId: item.id })}
                          className="flex items-center gap-3 hover:bg-white/5 p-1 rounded-xl cursor-pointer transition-colors"
                        >
                          <span className="text-xs font-black text-slate-600 w-4 block text-center">#{idx + 1}</span>
                          <img 
                            src={item.cover} 
                            alt="" 
                            onError={(e) => { e.currentTarget.src = FALLBACK_COVER; }}
                            className="w-8 h-11 object-cover rounded-md border border-white/5"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                          <div className="min-w-0 pr-1">
                            <h4 className="text-[11px] font-bold text-slate-300 truncate leading-snug">{item.title}</h4>
                            <span className="text-[8.5px] font-black text-[#FF5C00]">{item.rating}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* SECTION 4: НИЖЕ НОВИНКИ */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-widest text-[#FF5C00] flex items-center gap-2">
                  <Flame className="w-4 h-4" /> Лента новинок (бесконечно)
                </h2>
              </div>

              {loadingNovinki && novinkiEndless.length === 0 ? (
                <div className="py-12 bg-[#18191d] text-center text-xs text-[#7d8291] rounded-2xl border border-white/5">
                  Загрузка новинок...
                </div>
              ) : (
                <div className="relative overflow-hidden w-full bg-[#18191d]/40 rounded-3xl p-5 border border-white/5">
                  <style>{`
                    @keyframes slideMarqueeLeft {
                      0% { transform: translateX(0); }
                      100% { transform: translateX(-50%); }
                    }
                    .animate-marquee-left {
                      display: flex;
                      gap: 16px;
                      width: max-content;
                      animation: slideMarqueeLeft 45s linear infinite;
                    }
                    .animate-marquee-left:hover {
                      animation-play-state: paused;
                    }
                  `}</style>
                  <div className="animate-marquee-left">
                    {/* Original copy */}
                    {novinkiEndless.map((item, idx) => (
                      <div
                        key={`novinki-endless-${item.id}-${idx}`}
                        onClick={() => setSearchParams({ mangaId: item.id })}
                        className="w-[125px] sm:w-[145px] shrink-0 group cursor-pointer space-y-1.5"
                      >
                        <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden shadow-md border border-white/5 relative bg-[#18191d]">
                          <img 
                            src={item.cover} 
                            alt="" 
                            onError={(e) => { e.currentTarget.src = FALLBACK_COVER; }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                          <div className="absolute top-1.5 left-1.5 px-1 bg-[#121316] rounded-md text-[8px] border border-white/5 font-bold text-slate-300">
                            {item.genres[0]}
                          </div>
                        </div>
                        <h4 className="text-[10.5px] font-bold text-slate-300 group-hover:text-[#FF5C00] transition-colors leading-tight line-clamp-1">
                          {item.title}
                        </h4>
                      </div>
                    ))}
                    {/* Duplicate copy for a perfect seamless infinite look */}
                    {novinkiEndless.map((item, idx) => (
                      <div
                        key={`novinki-endless-dup-${item.id}-${idx}`}
                        onClick={() => setSearchParams({ mangaId: item.id })}
                        className="w-[125px] sm:w-[145px] shrink-0 group cursor-pointer space-y-1.5"
                      >
                        <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden shadow-md border border-white/5 relative bg-[#18191d]">
                          <img 
                            src={item.cover} 
                            alt="" 
                            onError={(e) => { e.currentTarget.src = FALLBACK_COVER; }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                          <div className="absolute top-1.5 left-1.5 px-1 bg-[#121316] rounded-md text-[8px] border border-white/5 font-bold text-slate-300">
                            {item.genres[0]}
                          </div>
                        </div>
                        <h4 className="text-[10.5px] font-bold text-slate-300 group-hover:text-[#FF5C00] transition-colors leading-tight line-clamp-1">
                          {item.title}
                        </h4>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            </div>
          </div>
        )}

      {/* DETAILED CHAPTERS FULL SCREEN HIGH-CONTRAST READER */}
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
              {/* Sticky Top Reader toolbars */}
              <div className="bg-[#121316] px-4 py-3.5 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 z-50 shadow-md">
                <div className="flex items-center gap-3 min-w-0">
                  <button 
                    onClick={() => { setActiveChapter(null); setMangaReaderPage(0); }}
                    className="p-2.5 bg-white/5 text-slate-300 hover:text-[#FF5C00] hover:bg-white/10 rounded-xl transition-all shrink-0 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-[9px] text-[#FF5C00] uppercase tracking-wider truncate max-w-[120px] md:max-w-[200px]">
                      {selectedManga.title}
                    </h3>
                    
                    {/* Chapter Select menu */}
                    <div className="relative inline-block text-left mt-0.5 group/chdrop select-none">
                      <button className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-white hover:text-[#FF5C00] transition-colors focus:outline-none">
                        <span>Глава {activeChapter.chapter}</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>

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

                <div className="flex items-center gap-2 select-none">
                  {/* Prev Chapter */}
                  <button
                    disabled={!prevChapter}
                    onClick={() => prevChapter && startReadingChapter(prevChapter)}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 text-xs font-black uppercase text-slate-300 disabled:opacity-20 rounded-xl transition-all cursor-pointer flex items-center gap-1"
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

                  <button 
                    onClick={() => setIsSettingsOpen(prev => !prev)}
                    className={`p-2 bg-white/5 text-slate-300 rounded-xl transition-all ${isSettingsOpen ? 'text-[#FF5C00] bg-[#FF5C00]/10' : 'hover:bg-white/10'}`}
                  >
                    <Settings className="w-4 h-4" />
                  </button>

                  {/* Next Chapter */}
                  <button
                    disabled={!nextChapter}
                    onClick={() => nextChapter && startReadingChapter(nextChapter)}
                    className="px-3 py-2 bg-[#FF5C00] hover:bg-[#ff6c1a] text-xs font-black uppercase text-black disabled:opacity-20 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span className="hidden sm:inline text-[9px]">След.</span> <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Reader canvas space */}
              <div className="flex-1 flex relative overflow-hidden">
                <div className="flex-1 overflow-y-auto flex flex-col items-center custom-scrollbar relative z-10 w-full">
                  {pagesLoading ? (
                    <div className="m-auto flex flex-col items-center justify-center p-6 text-center">
                      <Loader2 className="w-10 h-10 text-[#FF5C00] animate-spin mb-4" />
                      <span className="text-xs font-black uppercase text-slate-400 tracking-widest animate-pulse">Загрузка страниц из API...</span>
                    </div>
                  ) : pages.length === 0 ? (
                    <div className="m-auto flex flex-col items-center justify-center p-6 text-center">
                      <BookOpen className="w-12 h-12 text-[#7d8291] mb-4" />
                      <h3 className="text-sm font-black text-white">Страницы не найдены</h3>
                      <p className="text-[10px] text-slate-500 mt-1 max-w-sm">Возможно, файл поврежден или защищен правообладателями. Извините за временные сложности.</p>
                    </div>
                  ) : readerMode === 'scroll' ? (
                    <div className={`w-full flex flex-col items-center ${activeContainerWidth} ${activeGapClass}`}>
                      {pages.map((imgUrl, idx) => (
                        <div key={idx} className="relative w-full shadow-2xl select-none">
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

                      {/* Chapter finished box */}
                      <div className="w-full max-w-xl py-12 px-6 bg-[#18191d] border border-white/5 rounded-3xl text-center space-y-4 my-6 select-none relative z-20 mx-4 shadow-2xl">
                        <h4 className="text-sm font-black text-white uppercase tracking-wider">Глава Завершена</h4>
                        <p className="text-[11px] text-[#7d8291] max-w-xs mx-auto">Вы закончили главу {activeChapter.chapter}. Понравилась манга? Продолжайте чтение следующем разделом!</p>
                        <div className="flex justify-center gap-2 pt-2">
                          <button
                            onClick={() => { setActiveChapter(null); setMangaReaderPage(0); }}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-widest text-[#a5a7b1] rounded-xl transition-all"
                          >
                            В Описание
                          </button>
                          {nextChapter && (
                            <button
                              onClick={() => startReadingChapter(nextChapter)}
                              className="px-5 py-2 bg-[#FF5C00] text-black hover:bg-[#ff6c1a] text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md"
                            >
                              Гл. {nextChapter.chapter}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
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

                {/* Settings Drawer Slide panel */}
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
                            className="text-xs font-bold text-[#7d8291] hover:text-white cursor-pointer"
                          >
                            Закрыть
                          </button>
                        </div>

                        {/* Theme switcher */}
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

                        {/* Width */}
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

                        {/* Gaps */}
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

                      <div className="space-y-2 select-none">
                        <span className="text-[8px] font-black uppercase tracking-widest text-[#7d8291] block text-center">Плеер KamiManga v1.2</span>
                        <button 
                          onClick={() => setIsSettingsOpen(false)}
                          className="w-full py-2 bg-[#FF5C00] text-black hover:bg-[#ff6c1a] text-xs font-black uppercase tracking-wider rounded-lg transition-all text-center shrink-0 block cursor-pointer"
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
