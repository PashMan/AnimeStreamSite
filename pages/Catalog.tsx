import React, { useState, useEffect } from 'react';
import { Search, Loader2, ListFilter, SlidersHorizontal, Check, Tag } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import AnimeCard from '../components/AnimeCard';
import { fetchAnimes, GENRE_MAP } from '../services/shikimori';
import { Anime } from '../types';
import SEO from '../components/SEO';

const Catalog: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialSort = searchParams.get('sort') || 'popularity';
  const initialStatus = searchParams.get('status') || 'All';
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatus);
  const [currentSort, setCurrentSort] = useState(initialSort);
  const [showGenreFilters, setShowGenreFilters] = useState(false);
  
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadInitial = async () => {
      setIsLoading(true);
      setPage(1);
      
      const shikimoriOrderMap: Record<string, string> = {
        'popularity': 'popularity',
        'rating': 'ranked',
        'new': 'aired_on',
        'random': 'random'
      };

      const params: any = { 
        page: 1, 
        order: shikimoriOrderMap[currentSort] || 'popularity',
        search: searchQuery || undefined 
      };
      
      if (selectedGenres.length > 0) params.genre = selectedGenres.join(',');
      if (selectedStatus !== 'All') params.status = selectedStatus;

      const results = await fetchAnimes(params);
      if (isMounted) {
        setAnimeList(results);
        setHasMore((results as any).hasMore ?? results.length > 0);
        setIsLoading(false);
      }
    };

    const timer = setTimeout(loadInitial, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, selectedGenres, selectedStatus, currentSort]);

  const handleLoadMore = React.useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    
    const params: any = { 
        page: nextPage, 
        order: currentSort === 'rating' ? 'ranked' : (currentSort === 'new' ? 'aired_on' : 'popularity'), 
        search: searchQuery || undefined 
    };
    
    if (selectedGenres.length > 0) params.genre = selectedGenres.join(',');
    if (selectedStatus !== 'All') params.status = selectedStatus;

    const newResults = await fetchAnimes(params);
    if (newResults && newResults.length > 0) {
        setAnimeList(prev => [...prev, ...newResults]);
        setPage(nextPage);
        setHasMore((newResults as any).hasMore ?? newResults.length > 0);
    } else {
        setHasMore(false);
    }
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, page, currentSort, searchQuery, selectedGenres, selectedStatus]);

  const handleSortChange = (sort: string) => {
    setCurrentSort(sort);
    setSearchParams(prev => {
        prev.set('sort', sort);
        return prev;
    });
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedStatus('All');
    setSearchQuery('');
    setCurrentSort('popularity');
  };

  const genres = Object.keys(GENRE_MAP).sort((a, b) => a.localeCompare(b, 'ru'));
  const statusOptions = [
    { value: 'All', label: 'Все' },
    { value: 'ongoing', label: 'Онгоинг' },
    { value: 'released', label: 'Завершен' },
    { value: 'anons', label: 'Анонс' },
  ];

  const sortOptions = [
    { value: 'popularity', label: 'Популярные' },
    { value: 'rating', label: 'По рейтингу' },
    { value: 'new', label: 'Новинки' },
    { value: 'random', label: 'Случайные' },
  ];

  const observerTarget = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoadingMore, handleLoadMore]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 py-8 space-y-8 min-h-screen">
      <SEO 
        title="Каталог аниме смотреть онлайн бесплатно - KamiAnime" 
        description="Огромная база аниме: поиск по жанрам, годам и популярности. Смотреть аниме онлайн бесплатно в хорошем качестве. Найдите, что посмотреть сегодня."
      />
      
      {/* Immersive Cinematic Category Header */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-2 border-b border-white/5">
          <div>
            <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight font-display flex items-center gap-3">
              <span className="w-2 h-10 bg-primary rounded-full inline-block" />
              Каталог релизов
            </h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1.5">
              Свободно исследуйте и фильтруйте тысячи тайтлов из нашей базы
            </p>
          </div>

          {/* Quick status tabs inside header for true premium feel */}
          <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-xl gap-1 select-none w-fit">
            {statusOptions.map(o => (
              <button
                key={o.value}
                onClick={() => setSelectedStatus(o.value)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${selectedStatus === o.value ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Premium Filters Control Bar */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-surface/40 border border-white/5 p-4 rounded-2xl backdrop-blur-xs">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative flex-1 min-w-[240px] md:max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                aria-label="Поиск аниме"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Найти то самое аниме..." 
                className="w-full h-11 bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:border-primary transition-all font-medium"
              />
            </div>

            {/* Genres Toggler button */}
            <button 
              onClick={() => setShowGenreFilters(!showGenreFilters)}
              className={`h-11 px-5 border rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${showGenreFilters || selectedGenres.length > 0 ? 'bg-primary/10 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Жанры</span>
              {selectedGenres.length > 0 && (
                <span className="w-5 h-5 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {selectedGenres.length}
                </span>
              )}
            </button>

            {/* Clear Filters */}
            {(selectedGenres.length > 0 || selectedStatus !== 'All' || searchQuery !== '') && (
              <button 
                onClick={clearFilters}
                className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-primary transition-colors h-11 px-4 rounded-xl border border-dashed border-white/10 hover:border-primary/20 flex items-center justify-center"
              >
                Очистить фильтры
              </button>
            )}
          </div>

          {/* Sort selection drop dropdown */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Сортировка:</span>
            <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl gap-1">
              {sortOptions.map(o => (
                <button
                  key={o.value}
                  onClick={() => handleSortChange(o.value)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wide transition-all ${currentSort === o.value ? 'bg-white text-black font-black' : 'text-slate-400 hover:text-white'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Expanding Genres Section (Netflix category style selection bar) */}
        {showGenreFilters && (
          <div className="bg-surface/30 border border-white/5 p-6 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-4">Выберите жанры аниме:</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
              {genres.map(genre => {
                const isSelected = selectedGenres.includes(genre);
                return (
                  <button 
                    key={genre} 
                    onClick={() => toggleGenre(genre)}
                    className={`px-3 py-2.5 rounded-xl text-[10px] font-bold border transition-all text-left flex items-center justify-between ${isSelected ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white/5 border-white/5 text-slate-300 hover:text-white hover:bg-white/10'}`}
                  >
                    <span className="truncate">{genre}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-white ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Grid display area */}
      <div className="space-y-12">
        {isLoading ? (
          <div className="flex justify-center items-center py-48">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          </div>
        ) : (
          <>
            {animeList.length === 0 ? (
              <div className="bg-surface/30 rounded-[2rem] py-24 text-center border border-white/5">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="w-8 h-8 text-slate-600" />
                </div>
                <h3 className="text-xl font-black text-white uppercase mb-2">Фильтр пуст</h3>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider max-w-md mx-auto">
                  Тайтлов, подходящих под данные критерии, не найдено. Нажмите очистить фильтры выше.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-10">
                {animeList.map((anime, idx) => (
                  <div key={`${anime.id}-${idx}`} className="animate-in fade-in duration-300">
                    <AnimeCard anime={anime} />
                  </div>
                ))}
              </div>
            )}

            {hasMore && animeList.length > 0 && (
              <div ref={observerTarget} className="mt-16 flex justify-center py-8">
                {isLoadingMore && <Loader2 className="w-8 h-8 text-primary animate-spin" />}
              </div>
            )}
            
            {/* Elegant SEO Text panel */}
            {!isLoading && animeList.length > 0 && (
              <div className="p-8 bg-surface/20 border border-white/5 rounded-3xl text-slate-400 text-xs md:text-sm leading-relaxed max-w-5xl">
                <h3 className="text-base font-black text-white uppercase tracking-tight mb-3">
                  Смотреть аниме {selectedGenres.length > 0 ? `в жанре ${selectedGenres.join(', ')} ` : ''}онлайн
                </h3>
                <p className="mb-3">
                  Добро пожаловать в крупнейший каталог аниме на KamiAnime. Здесь вы можете найти и смотреть онлайн лучшие тайтлы {selectedGenres.length > 0 ? `в жанре ${selectedGenres.join(', ')}` : 'всех жанров и направлений'}. Наша база постоянно обновляется, предлагая вам как классические шедевры, так и самые горячие новинки сезона.
                </p>
                <p>
                  Мы предоставляем удобный плеер, высокое качество видео (HD 1080p) и выбор из множества вариантов озвучки (Anilibria, Kodik, StudioBand и другие), а также оригинальную дорожку с русскими субтитрами. Используйте фильтры по жанрам, годам и статусу выхода, чтобы быстро найти идеальное аниме на вечер. Приятного просмотра!
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Catalog;
