import React from 'react';
import { Link } from 'react-router-dom';
import { Star, PlayCircle } from 'lucide-react';
import { Anime } from '../types';
import { Image } from './Image';
import { useSlugBlocks } from '../store/slugBlocks';
import { useDmcaBlocks } from '../store/dmcaBlocks';

interface AnimeCardProps {
  anime: Anime;
  rank?: number;
}

const AnimeCard: React.FC<AnimeCardProps> = ({ anime, rank }) => {
  const episodeCount = `${anime.episodesAired || 0} / ${anime.episodes || '?'}`;
  const { slugBlocks } = useSlugBlocks();
  const { dmcaBlocks } = useDmcaBlocks();
  const isSlugBlocked = slugBlocks.includes(anime.id);
  const isDmcaBlocked = dmcaBlocks.includes(anime.id);

  const targetUrl = isDmcaBlocked 
    ? `/anime/${anime.id}-watch` 
    : `/anime/${anime.id}${anime.slug && !isSlugBlocked ? `-${anime.slug}` : ''}`;

  const ratingNum = typeof anime.rating === 'number' ? anime.rating : parseFloat((anime.rating as any) || '0');
  let ratingColorClass = "text-slate-300 bg-black/60 border-white/10";
  if (ratingNum >= 7.4) {
    ratingColorClass = "text-emerald-400 bg-emerald-950/80 border-emerald-500/30";
  } else if (ratingNum > 0 && ratingNum < 6.0) {
    ratingColorClass = "text-rose-400 bg-rose-950/80 border-rose-500/30";
  } else if (ratingNum >= 6.0) {
    ratingColorClass = "text-amber-400 bg-amber-950/80 border-amber-500/30";
  }

  return (
    <Link to={targetUrl} className="group block relative w-full h-full">
      <div className="relative w-full aspect-[2/3] rounded-2xl overflow-hidden mb-3 bg-surface border border-white/5 group-hover:border-primary/40 transition-all duration-500 shadow-lg group-hover:shadow-primary/10">
        <Image 
          src={anime.image} 
          alt={`Смотреть аниме ${anime.title} онлайн`} 
          animeId={anime.id}
          animeTitle={anime.originalName || anime.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 will-change-transform" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark/90 via-dark/20 to-transparent opacity-90 transition-opacity group-hover:opacity-100" />
        
        {/* Rating badge */}
        {ratingNum > 0 && (
          <div className={`absolute top-3 right-3 px-2 py-0.5 backdrop-blur-md rounded-lg flex items-center gap-1 border shadow-lg ${ratingColorClass}`}>
            <Star className="w-3 h-3 fill-current shrink-0" />
            <span className="text-[10px] font-black tracking-tight">{ratingNum.toFixed(1)}</span>
          </div>
        )}

        {/* Rank badge */}
        {rank && (
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-primary text-[10px] font-black uppercase rounded-lg shadow-lg text-white">
            #{rank}
          </div>
        )}

        {/* Hover Action Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-14 h-14 bg-primary/95 hover:bg-primary rounded-full flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-all duration-300 shadow-glow backdrop-blur-xs">
            <PlayCircle className="w-7 h-7 fill-current ml-0.5" />
          </div>
        </div>
      </div>
      
      <div className="px-1 text-left space-y-1">
        <h3 className="font-bold text-sm text-slate-100 group-hover:text-primary transition-colors line-clamp-1 truncate" title={anime.title}>
          {anime.title}
        </h3>
        <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
          <span className="text-primary/90 font-semibold">{episodeCount} эп.</span>
          <span className="w-1 h-1 rounded-full bg-slate-700" />
          <span>{anime.year}</span>
        </div>
      </div>
    </Link>
  );
};

export default AnimeCard;
