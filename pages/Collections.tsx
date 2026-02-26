import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Loader2 } from 'lucide-react';
import SEO from '../components/SEO';
import { FALLBACK_IMAGE, COLLECTIONS_DATA } from '../constants';
import { fetchAnimes, GENRE_MAP } from '../services/shikimori';

const Collections: React.FC = () => {
  const [collectionsWithImages, setCollectionsWithImages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastIndex, setLastIndex] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);

    const batchSize = 6;
    const newItems: any[] = [];
    let currentIndex = lastIndex;

    // Keep searching until we find batchSize valid items or reach the end
    while (newItems.length < batchSize && currentIndex < COLLECTIONS_DATA.length) {
      const collection = COLLECTIONS_DATA[currentIndex];
      try {
        const params: any = { limit: 2, order: 'popularity' };
        if (collection.defaultGenre) {
          params.genre = GENRE_MAP[collection.defaultGenre];
        }
        const results = await fetchAnimes(params);
        
        if (results.length > 0) {
          // Use the second anime's image if available, otherwise the first
          const displayImage = results.length > 1 ? results[1].image : results[0].image;
          newItems.push({
            ...collection,
            image: displayImage,
            count: '100+'
          });
        }
      } catch (e) {
        console.error('Error loading collection:', collection.title, e);
      }
      currentIndex++;
    }

    setCollectionsWithImages(prev => [...prev, ...newItems]);
    setLastIndex(currentIndex);
    setHasMore(currentIndex < COLLECTIONS_DATA.length);
    setIsLoading(false);
  };

  useEffect(() => {
    loadMore();
  }, []);

  return (
    <div className="min-h-screen bg-dark pt-24 pb-20 animate-in fade-in duration-700">
      <SEO 
        title="Подборки аниме" 
        description="Лучшие подборки аниме по жанрам, темам и настроению. Найдите что посмотреть на вечер."
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-lg shadow-primary/10">
            <Sparkles className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter font-display">
              Подборки аниме
            </h1>
            <p className="text-slate-400 font-medium mt-2">
              Специально собранные коллекции для любого настроения
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {collectionsWithImages.map(collection => (
            <Link key={collection.id} to={`/collections/${collection.id}`} className="group relative h-56 rounded-3xl overflow-hidden block shadow-xl border border-white/5 animate-in fade-in zoom-in duration-500">
              <img src={collection.image} alt={collection.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className={`absolute inset-0 bg-gradient-to-t ${collection.color} mix-blend-multiply opacity-80 group-hover:opacity-90 transition-opacity`}></div>
              <div className="absolute inset-0 p-6 flex flex-col justify-end z-10">
                <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg text-white text-xs font-black w-fit mb-2 shadow-lg border border-white/10">
                  {collection.count}
                </div>
                <h3 className="text-white font-bold text-xl leading-tight drop-shadow-lg">{collection.title}</h3>
              </div>
            </Link>
          ))}
        </div>

        {isLoading && (
          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
        )}

        {!isLoading && hasMore && (
          <div className="flex justify-center mt-12">
            <button 
              onClick={loadMore}
              className="px-12 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
            >
              Загрузить еще
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Collections;
