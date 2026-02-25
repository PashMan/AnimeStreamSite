import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import SEO from '../components/SEO';
import { FALLBACK_IMAGE } from '../constants';

const COLLECTIONS = [
  { id: 'super-power', title: 'Аниме в жанре супер сила', count: 1017, image: 'https://picsum.photos/seed/anime1/800/600', color: 'from-fuchsia-600/80 to-purple-900/90' },
  { id: 'friendship', title: 'Аниме про дружбу', count: 984, image: 'https://picsum.photos/seed/anime2/800/600', color: 'from-blue-600/80 to-indigo-900/90' },
  { id: 'coming-of-age', title: 'Аниме про взросление', count: 393, image: 'https://picsum.photos/seed/anime3/800/600', color: 'from-orange-600/80 to-red-900/90' },
  { id: 'parody', title: 'Аниме пародии', count: 389, image: 'https://picsum.photos/seed/anime4/800/600', color: 'from-pink-600/80 to-rose-900/90' },
  { id: 'isekai', title: 'Лучшие исекаи', count: 542, image: 'https://picsum.photos/seed/anime5/800/600', color: 'from-emerald-600/80 to-teal-900/90' },
  { id: 'romance', title: 'Романтика', count: 876, image: 'https://picsum.photos/seed/anime6/800/600', color: 'from-rose-500/80 to-pink-900/90' },
  { id: 'cyberpunk', title: 'Киберпанк', count: 124, image: 'https://picsum.photos/seed/anime7/800/600', color: 'from-cyan-600/80 to-blue-900/90' },
  { id: 'sports', title: 'Спортивные аниме', count: 312, image: 'https://picsum.photos/seed/anime8/800/600', color: 'from-amber-600/80 to-orange-900/90' },
];

const Collections: React.FC = () => {
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
          {COLLECTIONS.map(collection => (
            <Link key={collection.id} to={`/collections/${collection.id}`} className="group relative h-56 rounded-3xl overflow-hidden block shadow-xl border border-white/5">
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
      </div>
    </div>
  );
};

export default Collections;
