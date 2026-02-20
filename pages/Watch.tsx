
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Info, ChevronLeft, Film } from 'lucide-react';
import { fetchAnimeDetails } from '../services/shikimori';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { Anime } from '../types';

const Watch: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [anime, setAnime] = useState<Anime | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
        if (!id) return;
        setIsLoading(true);
        try {
          const details = await fetchAnimeDetails(id);
          setAnime(details);
          if (details && user?.email) {
              await db.addToHistory(user.email, details, 1);
          }
        } catch (err) { 
            console.error(err);
        } finally { 
            setIsLoading(false);
        }
    };
    loadData();
  }, [id, user]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>;
  if (!anime) return <div className="max-w-4xl mx-auto py-20 text-center"><h2 className="text-white mt-4 font-black uppercase">Аниме не найдено</h2></div>;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col gap-8">
        
        <div className="space-y-6">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <Link to={`/anime/${id}`} className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-all mb-4">
                <ChevronLeft className="w-4 h-4" /> К описанию
              </Link>
              <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none">{anime.title}</h1>
            </div>
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-3 rounded-2xl">
                <Film className="w-5 h-5 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Прямая трансляция</span>
            </div>
          </header>

          {/* Instant Player Container */}
          <div className="relative aspect-video bg-black rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,1)] border border-white/10 ring-1 ring-white/5 z-0 group">
             <iframe 
                src={`https://kodik.cc/find-player?shikimoriID=${id}`} 
                className="w-full h-full border-0 rounded-[2.5rem]" 
                allowFullScreen 
                allow="autoplay *; fullscreen *"
                title="Anime Player"
            />
          </div>

          <div className="p-8 bg-surface/30 rounded-[2.5rem] border border-white/5 flex items-start gap-6 mt-4 shadow-xl backdrop-blur-sm">
             <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/10 text-primary">
                <Info className="w-6 h-6" />
             </div>
             <div>
                <h4 className="font-black text-white uppercase text-xs tracking-widest mb-2">Инструкция плеера</h4>
                <p className="text-slate-400 leading-relaxed text-sm font-medium">
                  Все доступные озвучки и список серий находятся прямо в интерфейсе плеера. 
                  Нажмите на значок «Шестеренка» или «Список» внутри видео, чтобы сменить перевод или выбрать нужный эпизод.
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Watch;