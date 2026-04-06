import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import SEO from '../components/SEO';
import { Image } from '../components/Image';
import { COLLECTIONS_DATA } from '../constants';
import CollectionCard from '../components/CollectionCard';

// List of collections known to be empty or problematic to hide from the main list
const HIDDEN_COLLECTIONS = [
  'isekai', 'magic', 'urban-fantasy', 'villainess', 
  'cgdct', 'anthropomorphism'
];

const Collections: React.FC = () => {
  const [visibleCount, setVisibleCount] = useState(12);
  
  // Filter out hidden collections
  const validCollections = COLLECTIONS_DATA.filter(c => !HIDDEN_COLLECTIONS.includes(c.id));
  
  const collectionsWithImages = validCollections.slice(0, visibleCount);
  const hasMore = visibleCount < validCollections.length;

  const loadMore = () => {
    setVisibleCount(prev => Math.min(prev + 12, validCollections.length));
  };

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
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>

        {hasMore && (
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
