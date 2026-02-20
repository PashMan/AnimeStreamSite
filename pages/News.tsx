
import React, { useEffect, useState } from 'react';
import { Calendar, ChevronRight, Megaphone, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchNews } from '../services/shikimori';
import { NewsItem } from '../types';

const News: React.FC = () => {
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadNews = async () => {
        setIsLoading(true);
        const data = await fetchNews();
        setNewsList(data);
        setIsLoading(false);
    }
    loadNews();
  }, []);

  if (isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors group">
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> На главную
      </Link>

      <div className="flex items-center gap-4 border-b border-white/5 pb-10">
        <div className="w-14 h-14 bg-primary/20 rounded-[1.5rem] flex items-center justify-center text-primary shadow-lg shadow-primary/10">
            <Megaphone className="w-8 h-8" />
        </div>
        <div>
            <h1 className="font-display text-4xl font-black text-white uppercase tracking-tighter">Все новости</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Будь в курсе событий аниме-индустрии</p>
        </div>
      </div>

      {newsList.length === 0 ? (
        <div className="text-center py-20 text-white">Новости не найдены</div>
      ) : (
        <div className="grid gap-6">
           {newsList.map((item, idx) => (
              <Link 
                key={item.id + idx} 
                to={`/news/${item.id}`}
                className="group flex flex-col p-8 glass rounded-[2rem] border border-white/5 hover:border-primary/30 transition-all hover:-translate-y-1 relative overflow-hidden shadow-xl"
              >
                 <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl -mr-32 -mt-32 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                 
                 <div className="relative z-10 flex-1 flex flex-col">
                     <div className="flex items-center gap-4 mb-4">
                         <span className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-xl text-[10px] font-black text-primary uppercase tracking-widest">
                             {item.category}
                         </span>
                         <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                             <Calendar className="w-3.5 h-3.5" /> {item.date}
                         </span>
                     </div>

                     <h2 className="text-xl md:text-2xl font-black text-white mb-4 group-hover:text-primary transition-colors uppercase tracking-tight leading-tight">
                         {item.title}
                     </h2>

                     <p className="text-slate-400 text-sm leading-relaxed mb-6 line-clamp-2 font-medium border-l-2 border-white/10 pl-4">
                         {item.summary}
                     </p>

                     <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-white mt-auto w-fit transition-all">
                        Читать статью <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                     </div>
                 </div>
              </Link>
           ))}
        </div>
      )}
    </div>
  );
};

export default News;