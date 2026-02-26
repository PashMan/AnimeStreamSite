import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ChevronLeft, SlidersHorizontal } from 'lucide-react';
import AnimeCard from '../components/AnimeCard';
import { fetchAnimes, GENRE_MAP } from '../services/shikimori';
import { Anime } from '../types';
import SEO from '../components/SEO';
import { COLLECTIONS_DATA } from '../constants';

const CollectionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const collection = id ? COLLECTIONS_DATA.find(c => c.id === id) : null;

  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters state
  const [selectedType, setSelectedType] = useState('All');
  const [selectedGenre, setSelectedGenre] = useState(collection?.defaultGenre || 'All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [yearRange, setYearRange] = useState([2005, 2025]);
  const [scoreRange, setScoreRange] = useState([0, 10]);

  useEffect(() => {
    if (collection) {
      handleSearch();
    }
  }, [id]);

  const handleSearch = async () => {
    setIsLoading(true);
    setError(null);
    
    const params: any = { 
      limit: 20,
      order: 'popularity'
    };
    
    if (selectedGenre !== 'All') params.genre = GENRE_MAP[selectedGenre];
    if (selectedStatus !== 'All') params.status = selectedStatus;
    if (selectedType !== 'All') params.kind = selectedType;
    
    try {
      const results = await fetchAnimes(params);
      // If we got mock data but were expecting a specific genre, it's an error or empty
      if (selectedGenre !== 'All' && results.length > 0 && results[0].id === "1") {
         setAnimeList([]);
      } else {
         setAnimeList(results);
      }
    } catch (error) {
      console.error("Failed to fetch collection", error);
      setError("Не удалось загрузить подборку. Пожалуйста, попробуйте позже.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedType('All');
    setSelectedGenre(collection?.defaultGenre || 'All');
    setSelectedStatus('All');
    setYearRange([2005, 2025]);
    setScoreRange([0, 10]);
    // We don't auto-search on clear, user must click search
  };

  if (!collection) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Подборка не найдена</h2>
          <Link to="/collections" className="text-primary hover:underline">Вернуться к подборкам</Link>
        </div>
      </div>
    );
  }

  const types = [
    { value: 'All', label: 'Выберите тип' },
    { value: 'tv', label: 'TV Сериал' },
    { value: 'movie', label: 'Фильм' },
    { value: 'ova', label: 'OVA' },
    { value: 'ona', label: 'ONA' },
  ];

  const statuses = [
    { value: 'All', label: 'Выберите статус' },
    { value: 'ongoing', label: 'Онгоинг' },
    { value: 'released', label: 'Завершен' },
    { value: 'anons', label: 'Анонс' },
  ];

  const genres = ['All', ...Object.keys(GENRE_MAP)];

  return (
    <div className="min-h-screen bg-dark pt-24 pb-20 animate-in fade-in duration-700">
      <SEO 
        title={collection.title} 
        description={`Смотреть ${collection.title} онлайн в хорошем качестве.`}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/collections" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors text-sm font-bold uppercase tracking-widest">
          <ChevronLeft className="w-4 h-4" /> Все подборки
        </Link>

        <h1 className="text-3xl md:text-4xl font-black text-white text-center mb-12 font-display">
          {collection.title}
        </h1>

        {/* Filter Section */}
        <div className="bg-surface/30 border border-white/5 rounded-[2rem] p-8 mb-12 shadow-2xl backdrop-blur-sm">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            
            {/* Left Column: Dropdowns */}
            <div className="space-y-4">
              <div className="relative">
                <select 
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-dark/50 border border-white/10 rounded-xl py-4 px-6 text-sm font-bold text-slate-300 outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                >
                  {types.map(t => <option key={t.value} value={t.value} className="bg-dark">{t.label}</option>)}
                </select>
                <SlidersHorizontal className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>

              <div className="relative">
                <select 
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="w-full bg-dark/50 border border-white/10 rounded-xl py-4 px-6 text-sm font-bold text-slate-300 outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                >
                  <option value="All" className="bg-dark">Выберите жанр</option>
                  {Object.keys(GENRE_MAP).map(g => <option key={g} value={g} className="bg-dark">{g}</option>)}
                </select>
                <SlidersHorizontal className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>

              <div className="relative">
                <select 
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full bg-dark/50 border border-white/10 rounded-xl py-4 px-6 text-sm font-bold text-slate-300 outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                >
                  {statuses.map(s => <option key={s.value} value={s.value} className="bg-dark">{s.label}</option>)}
                </select>
                <SlidersHorizontal className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            {/* Right Column: Sliders & Buttons */}
            <div className="space-y-8 flex flex-col justify-between">
              
              {/* Year Slider (Visual Only for now) */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="bg-primary/20 text-primary px-3 py-1 rounded-lg text-xs font-black">год 2005</span>
                  <span className="bg-primary/20 text-primary px-3 py-1 rounded-lg text-xs font-black">год 2025</span>
                </div>
                <div className="h-2 bg-dark rounded-full relative">
                  <div className="absolute inset-y-0 left-0 right-0 bg-primary rounded-full"></div>
                  <div className="absolute top-1/2 -translate-y-1/2 left-0 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-lg"></div>
                  <div className="absolute top-1/2 -translate-y-1/2 right-0 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-lg"></div>
                </div>
              </div>

              {/* Score Slider (Visual Only for now) */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="bg-primary/20 text-primary px-3 py-1 rounded-lg text-xs font-black">ШИКИ 0</span>
                  <span className="bg-primary/20 text-primary px-3 py-1 rounded-lg text-xs font-black">ШИКИ 10</span>
                </div>
                <div className="h-2 bg-dark rounded-full relative">
                  <div className="absolute inset-y-0 left-0 right-0 bg-primary rounded-full"></div>
                  <div className="absolute top-1/2 -translate-y-1/2 left-0 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-lg"></div>
                  <div className="absolute top-1/2 -translate-y-1/2 right-0 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-lg"></div>
                </div>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-4 pt-4">
                <button 
                  onClick={handleSearch}
                  className="bg-primary hover:bg-violet-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-lg shadow-primary/20 active:scale-95"
                >
                  Поиск
                </button>
                <button 
                  onClick={handleClear}
                  className="bg-dark hover:bg-white/5 text-slate-300 py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all border border-white/10 active:scale-95"
                >
                  Очистить
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Results Grid */}
        {isLoading ? (
          <div className="flex justify-center py-32"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>
        ) : error ? (
          <div className="bg-surface/30 rounded-[2.5rem] p-20 text-center border border-white/5">
            <h3 className="text-xl font-black text-red-500 uppercase mb-2">{error}</h3>
            <button onClick={handleSearch} className="text-primary hover:underline font-bold">Попробовать снова</button>
          </div>
        ) : animeList.length === 0 ? (
          <div className="bg-surface/30 rounded-[2.5rem] p-20 text-center border border-white/5">
            <h3 className="text-xl font-black text-white uppercase mb-2">Ничего не найдено</h3>
            <p className="text-slate-500 font-medium">Попробуйте изменить параметры фильтрации</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
            {animeList.map((anime, idx) => <AnimeCard key={`${anime.id}-${idx}`} anime={anime} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionDetail;
