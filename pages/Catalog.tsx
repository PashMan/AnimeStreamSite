
import React, { useState, useEffect } from 'react';
import { Search, Loader2, ListFilter, SlidersHorizontal } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import AnimeCard from '../components/AnimeCard';
import { fetchAnimes, GENRE_MAP } from '../services/shikimori';
import { Anime } from '../types';

const Catalog: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialSort = searchParams.get('sort') || 'popularity';
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [currentSort, setCurrentSort] = useState(initialSort);
  
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
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
      
      if (selectedGenre) params.genre = GENRE_MAP[selectedGenre];
      if (selectedStatus !== 'All') params.status = selectedStatus;

      const results = await fetchAnimes(params);
      setAnimeList(results);
      setHasMore(results.length >= 20);
      setIsLoading(false);
    };

    const timer = setTimeout(loadInitial, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedGenre, selectedStatus, currentSort]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    
    const params: any = { 
        page: nextPage, 
        order: currentSort === 'rating' ? 'ranked' : (currentSort === 'new' ? 'aired_on' : 'popularity'), 
        search: searchQuery || undefined 
    };
    
    if (selectedGenre) params.genre = GENRE_MAP[selectedGenre];
    if (selectedStatus !== 'All') params.status = selectedStatus;

    const newResults = await fetchAnimes(params);
    if (newResults && newResults.length > 0) {
        setAnimeList(prev => [...prev, ...newResults]);
        setPage(nextPage);
        setHasMore(newResults.length >= 20);
    } else {
        setHasMore(false);
    }
    setIsLoadingMore(false);
  };

  const handleSortChange = (sort: string) => {
    setCurrentSort(sort);
    setSearchParams(prev => {
        prev.set('sort', sort);
        return prev;
    });
  };

  const genres = Object.keys(GENRE_MAP);
  const statusOptions = [
    { value: 'All', label: 'Все статусы' },
    { value: 'ongoing', label: 'Онгоинг' },
    { value: 'released', label: 'Завершен' },
    { value: 'anons', label: 'Анонс' },
  ];

  const sortOptions = [
    { value: 'popularity', label: 'По популярности' },
    { value: 'rating', label: 'По рейтингу' },
    { value: 'new', label: 'По дате выхода' },
    { value: 'random', label: 'Случайно' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <ListFilter className="w-8 h-8" />
           </div>
           <div>
              <h1 className="text-4xl font-display font-black text-white tracking-tight uppercase">Каталог</h1>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Поиск по всей базе</p>
           </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          {/* SEARCH BOX */}
          <div className="relative w-full sm:w-80 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-primary transition-colors z-10" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Название аниме..." 
              className="w-full bg-white border-0 rounded-2xl py-4 pl-14 pr-6 text-sm text-slate-900 outline-none focus:ring-4 focus:ring-primary/20 transition-all shadow-2xl font-medium"
            />
          </div>

          {/* SORT BOX */}
          <div className="relative w-full sm:w-56">
             <SlidersHorizontal className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
             <select 
                value={currentSort}
                onChange={(e) => handleSortChange(e.target.value)}
                className="w-full bg-surface/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-xs font-black uppercase text-slate-300 outline-none focus:border-primary transition-all appearance-none cursor-pointer tracking-wider"
             >
                {sortOptions.map(o => <option key={o.value} value={o.value} className="bg-dark text-white">{o.label}</option>)}
             </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        <aside className="w-full lg:w-72 shrink-0 space-y-10">
          <div className="bg-surface/50 p-8 rounded-[2rem] sticky top-28 border border-white/5 shadow-xl backdrop-blur-sm">
            <h3 className="text-[10px] font-black uppercase text-slate-500 mb-6 tracking-[0.2em] flex items-center gap-2">
               <div className="w-4 h-[2px] bg-primary"></div> Жанры
            </h3>
            <div className="flex flex-wrap gap-2 mb-10 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {genres.map(genre => (
                <button 
                  key={genre} 
                  onClick={() => setSelectedGenre(selectedGenre === genre ? null : genre)}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black border transition-all uppercase tracking-tighter ${selectedGenre === genre ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}
                >
                  {genre}
                </button>
              ))}
            </div>
            
            <h3 className="text-[10px] font-black uppercase text-slate-500 mb-6 tracking-[0.2em] flex items-center gap-2">
               <div className="w-4 h-[2px] bg-accent"></div> Статус
            </h3>
            <div className="space-y-2">
               {statusOptions.map(o => (
                  <button 
                    key={o.value}
                    onClick={() => setSelectedStatus(o.value)}
                    className={`w-full text-left px-5 py-3 rounded-xl text-xs font-black uppercase transition-all border ${selectedStatus === o.value ? 'bg-accent/10 border-accent text-accent' : 'bg-white/5 border-transparent text-slate-400 hover:text-white'}`}
                  >
                     {o.label}
                  </button>
               ))}
            </div>
          </div>
        </aside>

        <div className="flex-grow">
          {isLoading ? (
             <div className="flex justify-center py-32"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>
          ) : (
            <>
              {animeList.length === 0 ? (
                <div className="bg-surface/30 rounded-[2.5rem] p-20 text-center border border-white/5">
                   <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Search className="w-10 h-10 text-slate-600" />
                   </div>
                   <h3 className="text-xl font-black text-white uppercase mb-2">Ничего не найдено</h3>
                   <p className="text-slate-500 font-medium">Попробуйте изменить параметры фильтрации или запрос</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
                  {animeList.map((anime, idx) => <AnimeCard key={`${anime.id}-${idx}`} anime={anime} />)}
                </div>
              )}
              {hasMore && animeList.length > 0 && (
                <div className="mt-20 flex justify-center">
                  <button 
                    onClick={handleLoadMore} 
                    disabled={isLoadingMore} 
                    className="px-12 py-5 bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/20 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-3 shadow-xl active:scale-95 disabled:opacity-50"
                  >
                    {isLoadingMore ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Показать еще аниме'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Catalog;