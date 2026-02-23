
import React from 'react';
import { Link } from 'react-router-dom';
import { Star, PlayCircle } from 'lucide-react';
import { Anime } from '../types';

interface AnimeCardProps {
  anime: Anime;
  rank?: number;
}

const AnimeCard: React.FC<AnimeCardProps> = ({ anime, rank }) => {
  const episodeCount = `${anime.episodesAired || 0} / ${anime.episodes || '?'}`;

  return (
    <Link to={`/anime/${anime.id}`} className="group block relative w-full h-full">
      <div className="relative w-full aspect-[2/3] rounded-[2.5rem] overflow-hidden mb-5 bg-surface border border-white/5 group-hover:border-primary/50 transition-all shadow-xl group-hover:shadow-primary/20">
        <img 
          src={anime.image} 
          alt={anime.title} 
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover transition duration-700 group-hover:scale-110 will-change-transform" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark via-transparent to-transparent opacity-70" />
        
        <div className="absolute top-5 right-5 px-3 py-1.5 bg-black/60 backdrop-blur-xl rounded-xl flex items-center gap-2 border border-white/10 shadow-2xl">
          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
          <span className="text-[10px] font-black text-white">{anime.rating}</span>
        </div>

        {rank && (
          <div className="absolute top-5 left-5 px-4 py-1.5 bg-primary text-[10px] font-black uppercase rounded-xl shadow-2xl text-white">
            #{rank}
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div className="w-20 h-20 bg-primary/90 rounded-full flex items-center justify-center text-white scale-75 group-hover:scale-100 transition-transform shadow-glow backdrop-blur-sm">
            <PlayCircle className="w-10 h-10 fill-current" />
          </div>
        </div>
      </div>
      
      <div className="px-3">
        <h3 className="font-black text-base text-white group-hover:text-primary transition-colors line-clamp-1 uppercase tracking-tighter" title={anime.title}>
          {anime.title}
        </h3>
        <div className="flex items-center gap-3 text-[9px] font-black text-slate-500 mt-2.5 uppercase tracking-widest">
          <span className="text-accent">{episodeCount} ЭП.</span>
          <span className="w-1 h-1 rounded-full bg-slate-800" />
          <span>{anime.year}</span>
        </div>
      </div>
    </Link>
  );
};

export default AnimeCard;