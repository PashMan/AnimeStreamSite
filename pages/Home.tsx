
import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, PlayCircle, Loader2, Calendar, Megaphone, Clock, Crown, Sparkles, ChevronDown, Send, MessageSquare } from 'lucide-react';
import { Image } from '../components/Image';
import AnimeCard from '../components/AnimeCard';
import SEO from '../components/SEO';
import { fetchAnimes, fetchCalendar, fetchNews, fetchAnimeScreenshots, fetchAnimeDetails, getInitialHeroAnimes } from '../services/shikimori';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { Anime, ScheduleItem, NewsItem, ForumTopic } from '../types';
import { FALLBACK_IMAGE, COLLECTIONS_DATA } from '../constants';

const Home: React.FC = () => {
  const ongoingRef = useRef<HTMLDivElement>(null);
  const trendingRef = useRef<HTMLDivElement>(null);
  const { user, openAuthModal } = useAuth();
  
  const [heroAnimes, setHeroAnimes] = useState<Anime[]>(() => getInitialHeroAnimes() || []);
  const [trendingAnimes, setTrendingAnimes] = useState<Anime[]>([]);
  const [newAnimes, setNewAnimes] = useState<Anime[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [forumTopics, setForumTopics] = useState<ForumTopic[]>([]);
  
  const [isHeroLoading, setIsHeroLoading] = useState(() => !getInitialHeroAnimes());
  const [heroIndex, setHeroIndex] = useState(0);
  const [upscaleAnime, setUpscaleAnime] = useState('');
  const [isUpscaleSent, setIsUpscaleSent] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const currentDayName = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][new Date().getDay()];

  // Initial Data Load
  useEffect(() => {
    let isMounted = true;
    
    const loadLists = async () => {
        // Parallel fetches, now handled efficiently by the RequestQueue
        fetchAnimes({ order: 'popularity', limit: 20 }).then(data => {
          if (isMounted) setTrendingAnimes(data);
        });
        
        fetchAnimes({ order: 'ranked', status: 'ongoing', limit: 20 }).then(data => {
          if (isMounted) setNewAnimes(data);
        });
        
        fetchNews().then(data => {
          if (isMounted) setNews(data);
        });
        
        fetchCalendar().then(data => {
          if (isMounted) setSchedule(data);
        });
        
        db.getForumTopics(undefined, undefined).then(topics => {
          if (isMounted) {
            setForumTopics(topics.filter(t => t.category !== 'news').slice(0, 5));
          }
        });
    };

    // 1. Load Hero items immediately and unblock UI
    const loadHero = async () => {
        if (heroAnimes.length === 0) setIsHeroLoading(true);
        // Bypass queue for Hero to load immediately
        const data = await fetchAnimes({ order: 'popularity', status: 'ongoing', limit: 5 }, true);
        if (!isMounted) return;
        
        if (data && data.length > 0) {
            setHeroAnimes(data);
            setIsHeroLoading(false);
            
            // Start loading other lists in parallel AFTER hero is loaded
            // Delay slightly to give LCP image network priority
            setTimeout(() => {
                if (isMounted) loadLists();
            }, 300);

            // Sequentially enrich hero items with details (description, better cover)
            // We do this one by one with a delay to avoid 429 Rate Limit
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            
            // Enrich ALL items to ensure quality (descriptions, high-res covers)
            for (const anime of data) {
                if (!isMounted) break;
                try {
                    // Fetch details
                    const details = await fetchAnimeDetails(anime.id);
                    if (details && isMounted) {
                        setHeroAnimes(prev => {
                            const next = [...prev];
                            const index = next.findIndex(a => a.id === anime.id);
                            if (index !== -1) {
                                // Merge details into existing item
                                next[index] = { ...next[index], ...details };
                            }
                            return next;
                        });
                    }
                    // Wait 100ms between requests to be nice to the API
                    await delay(100);
                } catch (e) {
                    console.warn(`Failed to enrich hero item ${anime.id}`, e);
                }
            }
        } else {
            setIsHeroLoading(false);
            loadLists();
        }
    };

    loadHero();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (heroAnimes.length === 0) return;
    const interval = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroAnimes.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [heroAnimes.length]);

  const handleUpscaleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.isPremium) return;
    if (!upscaleAnime.trim()) return;
    
    await db.requestUpscale(user.id || user.email, upscaleAnime);
    setIsUpscaleSent(true);
    setUpscaleAnime('');
  };

  const currentHero = heroAnimes[heroIndex];

  const scrollContainer = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = 600;
      ref.current.scrollBy({ left: direction === 'right' ? scrollAmount : -scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-24 pb-20">
      <SEO 
        title="Главная" 
        description="Смотрите аниме онлайн бесплатно в хорошем качестве. Новинки сезона, популярные тайтлы, удобный плеер и активное сообщество."
      />
      {/* Hero Section */}
      {isHeroLoading && heroAnimes.length === 0 ? (
        <section className="relative h-[85vh] w-full overflow-hidden bg-surface/50 animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/40 to-transparent z-10" />
          <div className="relative max-w-7xl mx-auto px-4 h-full flex items-end pb-24 z-20">
            <div className="max-w-3xl space-y-6 w-full">
              <div className="w-24 h-6 bg-white/10 rounded-lg"></div>
              <div className="w-3/4 h-16 md:h-24 bg-white/10 rounded-2xl"></div>
              <div className="w-full h-20 bg-white/10 rounded-xl"></div>
              <div className="w-40 h-14 bg-white/10 rounded-2xl mt-4"></div>
            </div>
          </div>
        </section>
      ) : currentHero ? (
        <section className="relative h-[85vh] w-full overflow-hidden group">
          {heroAnimes.map((anime, idx) => (
            <div key={anime.id} className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === heroIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
              {/* Use cover for high quality landscape image */}
              <Image 
                src={anime.cover || anime.image} 
                alt={anime.title} 
                animeId={anime.id}
                animeTitle={anime.originalName || anime.title}
                priority={idx === 0}
                className="w-full h-full object-cover transition-transform duration-[10s] ease-linear scale-105 group-hover:scale-110" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/40 to-transparent" />
              <div className="absolute inset-0 bg-black/20" />
            </div>
          ))}
          <div className="relative max-w-7xl mx-auto px-4 h-full flex items-end pb-24 z-20">
            <div className="max-w-3xl space-y-6 animate-in slide-in-from-bottom-10 duration-700">
              <span className="px-3 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-lg">Выходит сейчас</span>
              <h1 className="text-4xl md:text-7xl font-display font-black text-white drop-shadow-2xl uppercase tracking-tighter leading-[0.9] line-clamp-2">{currentHero.title}</h1>
              <p className="text-slate-200 text-lg line-clamp-3 font-medium max-w-2xl drop-shadow-md p-0 border-none">
                {currentHero.description || "Описание загружается..."}
              </p>
              <div className="flex flex-wrap gap-4 items-center pt-4">
                <Link to={`/anime/${currentHero.id}`} className="px-10 py-5 bg-primary hover:bg-violet-600 text-white font-black rounded-2xl flex items-center gap-3 w-fit uppercase text-xs tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95">
                  <PlayCircle className="w-6 h-6 fill-current" /> Смотреть
                </Link>
                <div className="flex gap-2">
                  {heroAnimes.map((_, i) => (
                    <button aria-label={`Go to slide ${i + 1}`} key={i} onClick={() => setHeroIndex(i)} className={`h-1.5 rounded-full transition-all ${i === heroIndex ? 'w-8 bg-primary' : 'w-2 bg-white/5'}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="h-[40vh] flex items-center justify-center text-slate-700 font-black uppercase tracking-widest text-xs border-b border-white/5 bg-surface/20">
          Контент временно недоступен
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-28">
        {/* Ongoing Section */}
        <section>
          <div className="flex flex-col md:flex-row justify-between gap-6 mb-10">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary shadow-lg shadow-primary/10">
                    <Clock className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Онгоинги</h3>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Выходят прямо сейчас</p>
                </div>
            </div>
            <div className="flex gap-3 items-center">
               <Link 
                 to="/catalog?order=ranked&status=ongoing"
                 className="px-6 py-4 rounded-2xl bg-surface border border-white/5 hover:bg-primary transition-all text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
               >
                 Смотреть все
               </Link>
               <div className="w-px h-8 bg-white/5 mx-2 hidden sm:block"></div>
               <button aria-label="Scroll left" onClick={() => scrollContainer(ongoingRef, 'left')} className="p-4 rounded-2xl bg-surface border border-white/5 hover:bg-primary transition-all text-slate-400 hover:text-white"><ChevronLeft className="w-6 h-6" /></button>
               <button aria-label="Scroll right" onClick={() => scrollContainer(ongoingRef, 'right')} className="p-4 rounded-2xl bg-surface border border-white/5 hover:bg-primary transition-all text-slate-400 hover:text-white"><ChevronRight className="w-6 h-6" /></button>
            </div>
          </div>
          
          <div ref={ongoingRef} className="flex gap-7 overflow-x-auto hide-scrollbar scroll-smooth pb-8 px-1 snap-x min-h-[400px]">
             {newAnimes.length > 0 ? (
                newAnimes.map((anime, idx) => (
                  <div key={`ongoing-${anime.id}-${idx}`} className="min-w-[220px] sm:min-w-[260px] snap-start">
                    <AnimeCard anime={anime} />
                  </div>
                ))
             ) : (
                Array.from({length: 4}).map((_, i) => (
                    <div key={i} className="min-w-[220px] sm:min-w-[260px] snap-start animate-pulse">
                        <div className="w-full aspect-[2/3] bg-white/5 rounded-[2.5rem] mb-5"></div>
                        <div className="h-4 bg-white/5 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-white/5 rounded w-1/2"></div>
                    </div>
                ))
             )}
          </div>
        </section>

        {/* Trending Section */}
        <section>
          <div className="flex flex-col md:flex-row justify-between gap-6 mb-10">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center text-accent shadow-lg shadow-accent/10">
                    <Crown className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">В тренде</h3>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Популярное сейчас</p>
                </div>
            </div>
            <div className="flex gap-3 items-center">
               <Link 
                 to="/catalog?order=popularity"
                 className="px-6 py-4 rounded-2xl bg-surface border border-white/5 hover:bg-primary transition-all text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
               >
                 Смотреть все
               </Link>
               <div className="w-px h-8 bg-white/5 mx-2 hidden sm:block"></div>
               <button aria-label="Scroll left" onClick={() => scrollContainer(trendingRef, 'left')} className="p-4 rounded-2xl bg-surface border border-white/5 hover:bg-primary transition-all text-slate-400 hover:text-white"><ChevronLeft className="w-6 h-6" /></button>
               <button aria-label="Scroll right" onClick={() => scrollContainer(trendingRef, 'right')} className="p-4 rounded-2xl bg-surface border border-white/5 hover:bg-primary transition-all text-slate-400 hover:text-white"><ChevronRight className="w-6 h-6" /></button>
            </div>
          </div>
          
          <div ref={trendingRef} className="flex gap-7 overflow-x-auto hide-scrollbar scroll-smooth pb-8 px-1 snap-x min-h-[400px]">
             {trendingAnimes.length > 0 ? (
                trendingAnimes.map((anime, idx) => (
                  <div key={`trend-${anime.id}-${idx}`} className="min-w-[220px] sm:min-w-[260px] snap-start">
                    <AnimeCard anime={anime} rank={idx + 1} />
                  </div>
                ))
             ) : (
                Array.from({length: 4}).map((_, i) => (
                    <div key={i} className="min-w-[220px] sm:min-w-[260px] snap-start animate-pulse">
                        <div className="w-full aspect-[2/3] bg-white/5 rounded-[2.5rem] mb-5"></div>
                        <div className="h-4 bg-white/5 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-white/5 rounded w-1/2"></div>
                    </div>
                ))
             )}
          </div>
        </section>

        {/* Schedule Section with Higher Z-Index */}
        {schedule.length > 0 && (
            <section className="relative z-20"> 
              <div className="flex items-center gap-4 mb-8">
                <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center text-accent shadow-lg shadow-accent/10">
                    <Calendar className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Расписание серий</h3>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Обновления этой недели</p>
                </div>
              </div>
              
              {/* Desktop Grid */}
              <div className="hidden md:grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                {schedule.map((day) => (
                  <div key={day.day} className="relative h-[160px] group">
                    <div className={`absolute top-0 left-0 right-0 w-full h-[160px] group-hover:h-[280px] overflow-hidden group-hover:overflow-y-auto bg-surface/90 border border-white/5 backdrop-blur-md rounded-[1.5rem] p-4 flex flex-col transition-all duration-300 ease-out origin-top z-10 group-hover:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)] group-hover:bg-surface group-hover:border-white/10 ${day.day === currentDayName ? 'border-primary/50 ring-1 ring-primary/20' : ''} custom-scrollbar`}>
                        {day.day === currentDayName && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-full animate-pulse z-20"></div>
                        )}
                        <h4 className={`text-[10px] font-black uppercase mb-3 text-center tracking-widest transition-colors shrink-0 ${day.day === currentDayName ? 'text-primary' : 'text-slate-500 group-hover:text-primary'}`}>{day.day}</h4>
                        <div className="space-y-2.5 flex-1">
                          {day.animes.length > 0 ? day.animes.map((item, idx) => (
                            <Link key={idx} to={`/anime/${item.id}`} className="block group/item hover:bg-white/5 p-1 rounded-lg transition-colors">
                              <div className="text-[7px] text-slate-500 font-black flex items-center gap-1 mb-0.5 group-hover/item:text-primary transition-colors uppercase"><Clock className="w-2.5 h-2.5" /> {item.time}</div>
                              <p className="text-[10px] font-bold text-white/80 leading-tight line-clamp-1 group-hover/item:line-clamp-none transition-colors group-hover/item:text-white">{item.title}</p>
                            </Link>
                          )) : <p className="text-[7px] text-slate-700 font-black uppercase text-center mt-2">Пусто</p>}
                        </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile Accordion */}
              <div className="md:hidden flex flex-col gap-3">
                {schedule.map((day) => {
                  const isExpanded = expandedDay === day.day || (expandedDay === null && day.day === currentDayName);
                  return (
                    <div key={day.day} className={`bg-surface/50 border ${isExpanded ? 'border-primary/30 bg-surface' : 'border-white/5'} rounded-2xl overflow-hidden transition-all duration-300`}>
                      <button 
                        onClick={() => setExpandedDay(isExpanded ? null : day.day)}
                        className="w-full p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-black uppercase tracking-widest ${day.day === currentDayName ? 'text-primary' : 'text-slate-400'}`}>{day.day}</span>
                          {day.day === currentDayName && <span className="px-2 py-0.5 bg-primary/20 text-primary text-[8px] font-bold rounded uppercase tracking-wider">Сегодня</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-slate-500">{day.animes.length} релизов</span>
                          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                          {day.animes.length > 0 ? day.animes.map((item, idx) => (
                            <Link key={idx} to={`/anime/${item.id}`} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5 active:scale-[0.98] transition-transform">
                              <div className="mt-0.5 min-w-[40px] px-1.5 py-1 bg-black/40 rounded text-[9px] font-black text-primary text-center tracking-wider border border-white/5">
                                {item.time}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white leading-snug line-clamp-2">{item.title}</p>
                              </div>
                            </Link>
                          )) : (
                            <div className="text-center py-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Нет релизов</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
        )}

        {/* News Section (z-10 to sit below Schedule dropdowns) */}
        {news.length > 0 && (
          <section className="relative z-10">
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary shadow-lg shadow-primary/10">
                        <Megaphone className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter">Новости</h3>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">События индустрии</p>
                    </div>
                </div>
                <Link to="/news" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors flex items-center gap-1">
                    Все новости <ChevronRight className="w-4 h-4" />
                </Link>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {news.slice(0, 4).map((item) => (
                   <div key={item.id} className="group bg-surface/30 border border-white/5 hover:border-primary/30 rounded-[2rem] overflow-hidden transition-all shadow-xl flex flex-col">
                      {item.video ? (
                        <div className="aspect-video w-full bg-black">
                           <iframe 
                             src={`https://www.youtube.com/embed/${item.video}`} 
                             className="w-full h-full" 
                             frameBorder="0" 
                             allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                             allowFullScreen
                           ></iframe>
                        </div>
                      ) : null}
                      <Link to={`/news/${item.id}`} className="p-6 flex-1 flex flex-col">
                         <div className="flex items-center justify-between mb-3">
                            <div className="text-[9px] font-black text-primary uppercase tracking-widest">{item.category}</div>
                            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{item.date}</div>
                         </div>
                         <h4 className="text-base font-black text-white leading-tight uppercase tracking-tight group-hover:text-primary transition-colors mb-3">{item.title}</h4>
                         <p className="text-slate-400 text-xs line-clamp-3 leading-relaxed">{item.summary.replace(/<[^>]*>?/gm, '')}</p>
                         <div className="mt-auto pt-4 flex items-center gap-1 text-[9px] font-black text-primary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                            Читать далее <ChevronRight className="w-3 h-3" />
                         </div>
                      </Link>
                   </div>
                ))}
             </div>
          </section>
        )}

        {/* Forum Discussions Section */}
        {forumTopics.length > 0 && (
          <section className="relative z-10">
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center text-violet-400 shadow-lg shadow-violet-500/10">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter">Обсуждения</h3>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Свежее на форуме</p>
                    </div>
                </div>
                <Link to="/forum" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors flex items-center gap-1">
                    Весь форум <ChevronRight className="w-4 h-4" />
                </Link>
             </div>

             <div className="grid gap-4">
                {forumTopics.map(topic => (
                  <Link key={topic.id} to={`/forum/${topic.id}`} className="group bg-surface/30 hover:bg-surface/50 border border-white/5 hover:border-primary/30 rounded-[1.5rem] p-6 transition-all cursor-pointer shadow-lg backdrop-blur-sm flex items-center gap-6">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[9px] font-black uppercase tracking-widest">
                          {topic.category}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                           {topic.author.name}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                           <Clock className="w-3 h-3" /> {new Date(topic.createdAt).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                      <h4 className="text-base font-black text-white group-hover:text-primary transition-colors uppercase tracking-tight line-clamp-1">
                        {topic.title}
                      </h4>
                      <p className="text-slate-400 text-xs line-clamp-1">{topic.content}</p>
                    </div>
                    
                    <div className="flex items-center gap-4 shrink-0 border-l border-white/5 pl-6">
                       <div className="text-center">
                          <div className="text-xs font-black text-white">{topic.repliesCount}</div>
                          <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Ответов</div>
                       </div>
                       <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                ))}
             </div>
          </section>
        )}

        {/* Premium Upscale Request Section (Hidden) */}
        {/* {user?.isPremium && (
          <section className="bg-gradient-to-br from-primary/20 to-accent/20 rounded-[3rem] border border-primary/20 p-10 shadow-2xl backdrop-blur-md relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-primary/20 transition-all duration-1000"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="space-y-4 max-w-xl">
                <div className="flex items-center gap-3 text-primary">
                  <Crown className="w-8 h-8 fill-current" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Premium Privilege</span>
                </div>
                <h3 className="text-3xl md:text-4xl font-display font-black text-white uppercase tracking-tighter leading-none">Заказать апскейл до 4K</h3>
                <p className="text-slate-400 font-medium leading-relaxed">
                  Как премиум-пользователь, вы можете выбрать одно аниме, которое мы обработаем с помощью ИИ и добавим в качестве 4K.
                </p>
              </div>
              
              {isUpscaleSent ? (
                <div className="bg-white/5 border border-white/10 p-8 rounded-3xl flex flex-col items-center gap-4 animate-in zoom-in-95 duration-500">
                  <Sparkles className="w-12 h-12 text-yellow-400" />
                  <p className="font-black uppercase tracking-widest text-xs text-white">Заявка принята!</p>
                </div>
              ) : (
                <form onSubmit={handleUpscaleRequest} className="w-full md:w-auto flex flex-col sm:flex-row gap-4">
                  <input 
                    type="text" 
                    value={upscaleAnime}
                    onChange={e => setUpscaleAnime(e.target.value)}
                    placeholder="Название аниме..."
                    className="h-16 px-8 bg-black/40 border border-white/10 rounded-2xl text-white placeholder-slate-600 focus:border-primary outline-none min-w-[300px] transition-all"
                  />
                  <button type="submit" className="h-16 px-10 bg-primary hover:bg-violet-600 text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-primary/20 uppercase text-[10px] tracking-widest">
                    Отправить <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </section>
        )} */}

        {/* Collections Section */}
        <section className="mt-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter font-display flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-primary" />
              Подборки
            </h2>
            <Link to="/collections" className="text-sm font-bold text-slate-400 hover:text-primary uppercase tracking-widest transition-colors flex items-center gap-1">
              Смотреть все <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {COLLECTIONS_DATA.slice(0, 4).map((collection, idx) => {
              const images = [
                trendingAnimes[0]?.image,
                newAnimes[0]?.image,
                heroAnimes[2]?.image,
                heroAnimes[1]?.image
              ];
              return (
              <Link key={collection.id} to={`/collections/${collection.id}`} className="group relative h-48 rounded-3xl overflow-hidden block shadow-xl border border-white/5">
                <img src={images[idx] || FALLBACK_IMAGE} alt={collection.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className={`absolute inset-0 bg-gradient-to-t ${collection.color} mix-blend-multiply opacity-80 group-hover:opacity-90 transition-opacity`}></div>
                <div className="absolute inset-0 p-6 flex flex-col justify-end z-10">
                  <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg text-white text-xs font-black w-fit mb-2 shadow-lg border border-white/10">
                    100+
                  </div>
                  <h3 className="text-white font-bold text-lg leading-tight drop-shadow-lg">{collection.title}</h3>
                </div>
              </Link>
            )})}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;