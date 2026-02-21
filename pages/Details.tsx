import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Star, Heart, Loader2, ChevronLeft, ChevronRight, Film, CheckCircle, Forward, MessageSquare, Users, Send, FastForward } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchAnimeDetails, fetchRelatedAnimes, fetchSimilarAnimes } from '../services/shikimori';
import { db } from '../services/db';
import { Anime, Comment, ChatMessage } from '../types';
import AnimeCard from '../components/AnimeCard';
import { socketService } from '../services/socketService';

const Details: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { openAuthModal, user } = useAuth();
  const relatedRef = useRef<HTMLDivElement>(null);
  const similarRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [anime, setAnime] = useState<Anime | null>(null);
  const [related, setRelated] = useState<Anime[]>([]);
  const [similar, setSimilar] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWatched, setIsWatched] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  // Watch Together State
  const [isTogether, setIsTogether] = useState(false);
  const [togetherMessages, setTogetherMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      setIsLoading(true);
      window.scrollTo(0, 0);
      try {
        const [details, rel, sim] = await Promise.all([
          fetchAnimeDetails(id),
          fetchRelatedAnimes(id),
          fetchSimilarAnimes(id)
        ]);
        setAnime(details);
        setRelated(rel.map(r => r.anime as unknown as Anime));
        setSimilar(sim as unknown as Anime[]);

        if (user?.email && details) {
          const [favs, watchedList] = await Promise.all([
            db.getFavorites(user.email),
            db.getWatched(user.email)
          ]);
          setIsFavorite(favs.includes(id));
          setIsWatched(watchedList.includes(id));
          
          // Add to history
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

  // Socket connection for Watch Together
  useEffect(() => {
    if (isTogether && id) {
      socketService.connect();
      socketService.joinRoom(`watch_${id}`);
      
      const handleSync = (data: any) => {
        if (data.userId !== user?.email) {
          console.log("Syncing player:", data);
        }
      };

      const handleMsg = (msg: any) => {
        setTogetherMessages(prev => [...prev, msg]);
      };

      socketService.onWatchSync(handleSync);
      socketService.onRoomMessage(handleMsg);

      return () => {
        socketService.disconnect();
      };
    }
  }, [isTogether, id, user]);

  const handleToggleFavorite = async () => {
    if (!user) { openAuthModal(); return; }
    if (!id) return;
    setIsActionLoading(true);
    try {
      const newState = await db.toggleFavorite(user.email, id);
      setIsFavorite(newState);
    } catch (e) { console.error(e); }
    setIsActionLoading(false);
  };

  const handleWatched = async () => {
    if (!user) { openAuthModal(); return; }
    if (!id) return;
    setIsActionLoading(true);
    try {
      const newState = await db.toggleWatched(user.email, id);
      setIsWatched(newState);
    } catch (e) { console.error(e); }
    setIsActionLoading(false);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim() || !user) return;
    const msg: ChatMessage = {
      id: Math.random().toString(),
      user: { name: user.name, avatar: user.avatar, email: user.email },
      text: chatText,
      timestamp: Date.now()
    };
    if (id) {
      socketService.sendRoomMessage(`watch_${id}`, msg);
    }
    setChatText('');
  };

  const skipOpening = () => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage({ 
        key: 'kodik_player_api', 
        value: { method: 'seek', parameters: 85 } 
      }, '*');
    }
  };

  const scrollToPlayer = () => {
    playerRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>;
  if (!anime) return <div className="max-w-4xl mx-auto py-20 text-center"><h2 className="text-white mt-4 font-black uppercase">Аниме не найдено</h2></div>;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Left Column: Poster & Actions */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
          <div className="relative aspect-[2/3] rounded-[2.5rem] overflow-hidden shadow-2xl group">
            <img src={anime.image} alt={anime.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-white">
              {anime.type}
            </div>
            {anime.score && (
              <div className="absolute top-4 right-4 bg-primary px-3 py-1 rounded-xl text-[10px] font-black text-white shadow-lg shadow-primary/30 flex items-center gap-1">
                <Star className="w-3 h-3 fill-current" /> {anime.score}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button 
              onClick={scrollToPlayer}
              className="w-full py-4 bg-primary hover:bg-violet-600 text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-primary/20 uppercase text-[10px] tracking-widest"
            >
              <Film className="w-4 h-4" /> Смотреть
            </button>
            <button 
              onClick={handleToggleFavorite} 
              disabled={isActionLoading} 
              className={`w-full py-4 glass font-black text-[10px] tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 ${isFavorite ? 'text-red-500 bg-red-500/10 border-red-500/20 shadow-lg shadow-red-500/10' : 'text-white hover:bg-white/10'}`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} /> {isFavorite ? 'В ИЗБРАННОМ' : 'В ИЗБРАННОЕ'}
            </button>
            <button 
              onClick={handleWatched} 
              disabled={isActionLoading} 
              className={`w-full py-4 glass font-black text-[10px] tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 ${isWatched ? 'text-green-500 bg-green-500/10 border-green-500/20 shadow-lg shadow-green-500/10' : 'text-white hover:bg-white/10'}`}
            >
              <CheckCircle className={`w-4 h-4 ${isWatched ? 'fill-current' : ''}`} /> {isWatched ? 'ПРОСМОТРЕНО' : 'ОТМЕТИТЬ ПРОСМОТРЕННЫМ'}
            </button>
            <button 
              onClick={() => navigate(`/forum?animeId=${id}`)}
              className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 font-black text-[10px] tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 text-white"
            >
              <MessageSquare className="w-4 h-4" /> ОБСУДИТЬ НА ФОРУМЕ
            </button>
          </div>

          <div className="bg-surface/50 p-6 rounded-[2rem] border border-white/5 space-y-4 backdrop-blur-md shadow-xl">
            <div className="flex justify-between items-center pb-4 border-b border-white/5">
              <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Статус</span>
              <span className="text-white text-[10px] font-black uppercase tracking-widest">{anime.status === 'released' || anime.status === 'Completed' ? 'Вышел' : 'Онгоинг'}</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-white/5">
              <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Эпизоды</span>
              <span className="text-white text-[10px] font-black uppercase tracking-widest">{anime.episodes || '?'}</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-white/5">
              <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Длительность</span>
              <span className="text-white text-[10px] font-black uppercase tracking-widest">{anime.duration || '?'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Рейтинг</span>
              <span className="text-white text-[10px] font-black uppercase tracking-widest">{anime.score || anime.rating || '?'}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Info & Player */}
        <div className="flex-1 space-y-10">
          <div>
            <h1 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter leading-none mb-6">{anime.title}</h1>
            <div className="flex flex-wrap gap-2 mb-8">
              {anime.genres?.map(g => (
                <span key={g} className="px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors cursor-default">
                  {g}
                </span>
              ))}
            </div>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-400 text-sm md:text-base leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: anime.description || 'Описание отсутствует' }} />
            </div>
          </div>

          {/* Player Section */}
          <div ref={playerRef} className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                <Film className="text-primary" /> Просмотр
              </h2>
              <button 
                onClick={() => setIsTogether(!isTogether)}
                className={`flex items-center gap-3 px-6 py-3 rounded-2xl border transition-all font-black uppercase text-[10px] tracking-widest ${isTogether ? 'bg-primary text-white border-primary' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
              >
                  <Users className="w-5 h-5" />
                  {isTogether ? 'Совместный просмотр: ВКЛ' : 'Совместный просмотр'}
              </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 relative aspect-video bg-black rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,1)] border border-white/10 ring-1 ring-white/5 z-0 group">
                <iframe 
                    ref={iframeRef}
                    src={`https://kodik.cc/find-player?shikimoriID=${id}`} 
                    className="w-full h-full border-0 rounded-[2.5rem]" 
                    allowFullScreen 
                    allow="autoplay *; fullscreen *"
                    title="Anime Player"
                />
                
                {/* Skip Opening Overlay */}
                <button 
                  onClick={skipOpening}
                  className="absolute bottom-20 right-8 px-6 py-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl text-white font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-primary transition-all opacity-0 group-hover:opacity-100"
                >
                  <FastForward className="w-4 h-4" /> Пропустить опенинг
                </button>
              </div>

              {/* Watch Together Chat */}
              {isTogether && (
                <aside className="w-full lg:w-[350px] flex flex-col bg-surface/30 rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl backdrop-blur-md animate-in slide-in-from-right-10 duration-500 h-[500px] lg:h-auto">
                  <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-5 h-5 text-primary" />
                      <span className="font-black uppercase text-xs tracking-widest text-white">Чат комнаты</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-black/30 rounded-full border border-white/5">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">LIVE</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
                    {togetherMessages.map(msg => (
                      <div key={msg.id} className="flex gap-3">
                        <img src={msg.user.avatar} className="w-8 h-8 rounded-lg object-cover shrink-0" alt="" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-white truncate">{msg.user.name}</span>
                          </div>
                          <div className="p-3 bg-white/5 rounded-2xl rounded-tl-none text-xs text-slate-300 border border-white/5 break-words">
                            {msg.text}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendChat} className="p-6 bg-black/20 border-t border-white/5 flex gap-3 shrink-0">
                    <input 
                      type="text" 
                      value={chatText}
                      onChange={e => setChatText(e.target.value)}
                      placeholder="Написать..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-primary outline-none"
                    />
                    <button type="submit" className="w-10 h-10 bg-primary hover:bg-violet-600 text-white rounded-xl flex items-center justify-center transition-all shrink-0">
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </aside>
              )}
            </div>
          </div>

          {/* Related & Similar */}
          <div className="space-y-12">
            {related.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Связанное</h3>
                  <div className="flex gap-2">
                    <button onClick={() => relatedRef.current?.scrollBy({ left: -300, behavior: 'smooth' })} className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-all"><ChevronLeft className="w-5 h-5" /></button>
                    <button onClick={() => relatedRef.current?.scrollBy({ left: 300, behavior: 'smooth' })} className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-all"><ChevronRight className="w-5 h-5" /></button>
                  </div>
                </div>
                <div ref={relatedRef} className="flex gap-6 overflow-x-auto pb-8 snap-x scrollbar-hide">
                  {related.map(anime => (
                    <div key={anime.id} className="w-[200px] flex-shrink-0 snap-start">
                      <AnimeCard anime={anime} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {similar.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Похожее</h3>
                  <div className="flex gap-2">
                    <button onClick={() => similarRef.current?.scrollBy({ left: -300, behavior: 'smooth' })} className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-all"><ChevronLeft className="w-5 h-5" /></button>
                    <button onClick={() => similarRef.current?.scrollBy({ left: 300, behavior: 'smooth' })} className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-all"><ChevronRight className="w-5 h-5" /></button>
                  </div>
                </div>
                <div ref={similarRef} className="flex gap-6 overflow-x-auto pb-8 snap-x scrollbar-hide">
                  {similar.map(anime => (
                    <div key={anime.id} className="w-[200px] flex-shrink-0 snap-start">
                      <AnimeCard anime={anime} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Details;
