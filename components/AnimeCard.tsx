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

  return (
    <Link to={targetUrl} className="group block relative w-full h-full">
      <div className="relative w-full aspect-[2/3] rounded-[2.5rem] overflow-hidden mb-5 bg-surface border border-white/5 group-hover:border-primary/50 transition-all shadow-xl group-hover:shadow-primary/20">
        <Image 
          src={anime.image} 
          alt={`Смотреть аниме ${anime.title} онлайн`} 
          animeId={anime.id}
          animeTitle={anime.originalName || anime.title}
          className="absolute inset-0 w-full h-full object-cover transition duration-700 group-hover:scale-110 will-change-transform" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark via-transparent to-transparent opacity-70" />
        
        <div className="absolute top-5 left-5 px-3 py-1.5 bg-cyan-950/80 backdrop-blur-xl rounded-xl flex items-center gap-1.5 border border-cyan-500/20 shadow-2xl">
          <Star className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />
          <span className="text-[10px] font-black text-cyan-400">{anime.rating}</span>
        </div>

        {anime.ageRating ? (
          <div className="absolute top-5 right-5 px-2.5 py-1 bg-black/60 backdrop-blur-xl rounded-lg text-[10px] font-black text-slate-300 border border-white/5 shadow-2xl">
            {anime.ageRating}
          </div>
        ) : (
          anime.episodesAired !== undefined && anime.episodes !== undefined && (
            <div className="absolute top-5 right-5 px-2.5 py-1 bg-black/60 backdrop-blur-xl rounded-lg text-[10px] font-black text-slate-400 border border-white/5 shadow-2xl">
              {anime.episodesAired}/{anime.episodes} эп.
            </div>
          )
        )}

        {rank && (
          <div className="absolute bottom-5 left-5 px-3 py-1 bg-primary text-[10px] font-black uppercase rounded-lg shadow-2xl text-white">
            #{rank}
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div className="w-16 h-16 bg-primary/95 rounded-full flex items-center justify-center text-white scale-75 group-hover:scale-100 transition-transform shadow-glow backdrop-blur-sm">
            <PlayCircle className="w-9 h-9 fill-current" />
          </div>
        </div>
      </div>
      
      <div className="px-1">
        <h3 className="font-extrabold text-[15px] leading-tight text-white group-hover:text-primary transition-colors line-clamp-1 uppercase tracking-tight" title={anime.title}>
          {anime.title}
        </h3>
        <div className="flex items-center gap-2 text-[10.5px] font-bold text-slate-500 mt-1.5 uppercase tracking-wide">
          <span>{anime.year}</span>
          <span className="w-1 h-1 rounded-full bg-slate-800" />
          <span className="text-slate-400 truncate">{anime.studio || 'Shikimori'}</span>
        </div>
      </div>
    </Link>
  );
};

export default AnimeCard;
