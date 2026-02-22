import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useParams, Link, useNavigate } from 'react-router-dom';
import { Star, Heart, Loader2, ChevronLeft, ChevronRight, Film, CheckCircle, Forward, MessageSquare, Users, Send, X, Link as LinkIcon, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchAnimeDetails, fetchRelatedAnimes, fetchSimilarAnimes } from '../services/shikimori';
import { db, supabase } from '../services/db';
import { Anime, Comment } from '../types';
import AnimeCard from '../components/AnimeCard';

const Details: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { openAuthModal, user } = useAuth();
  const relatedRef = useRef<HTMLDivElement>(null);
  const similarRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [anime, setAnime] = useState<Anime | null>(null);
  const [related, setRelated] = useState<{ relation: string; anime: Anime }[]>([]);
  const [similar, setSimilar] = useState<Anime[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [userComment, setUserComment] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);

  // Watch Together State
  const [isWatchTogether, setIsWatchTogether] = useState(searchParams.get('wt') === 'true');
  const [wtMessages, setWtMessages] = useState<{user: string, text: string, avatar: string}[]>([]);
  const [wtInput, setWtInput] = useState('');
  const [wtUsers, setWtUsers] = useState<number>(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const channelRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastTimeRef = useRef<number>(0);
  const isRemoteAction = useRef<boolean>(false);

  const copyInviteLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('wt', 'true');
    navigator.clipboard.writeText(url.toString());
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  useEffect(() => {
    if (isWatchTogether && id && user && supabase) {
      const channel = supabase.channel(`watch-${id}`, {
        config: {
          presence: {
            key: user.email,
          },
        },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          setWtUsers(Object.keys(state).length);
        })
        .on('broadcast', { event: 'chat' }, ({ payload }: { payload: any }) => {
          setWtMessages(prev => [...prev, payload]);
        })
        .on('broadcast', { event: 'player_sync' }, ({ payload }: { payload: any }) => {
          if (!iframeRef.current?.contentWindow) return;
          isRemoteAction.current = true;
          const win = iframeRef.current.contentWindow;
          
          if (payload.action === 'play') {
            win.postMessage({ key: 'kodik_player_seek', value: payload.time }, '*');
            win.postMessage({ key: 'kodik_player_play' }, '*');
          } else if (payload.action === 'pause') {
            win.postMessage({ key: 'kodik_player_pause' }, '*');
          } else if (payload.action === 'seek') {
            win.postMessage({ key: 'kodik_player_seek', value: payload.time }, '*');
          }
          
          setTimeout(() => { isRemoteAction.current = false; }, 1000);
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              user: user.name,
              online_at: new Date().toISOString(),
            });
          }
        });

      channelRef.current = channel;
      return () => {
        channel.unsubscribe();
      };
    }
  }, [isWatchTogether, id, user]);

  useEffect(() => {
    const handlePlayerMessage = (event: MessageEvent) => {
      if (!isWatchTogether || !channelRef.current || isRemoteAction.current) return;
      
      const data = event.data;
      if (typeof data !== 'object' || !data.key) return;

      if (data.key === 'kodik_player_time_update') {
        lastTimeRef.current = data.value;
      } else if (data.key === 'kodik_player_play') {
        channelRef.current.send({
          type: 'broadcast',
          event: 'player_sync',
          payload: { action: 'play', time: lastTimeRef.current }
        });
      } else if (data.key === 'kodik_player_pause') {
        channelRef.current.send({
          type: 'broadcast',
          event: 'player_sync',
          payload: { action: 'pause' }
        });
      }
    };

    window.addEventListener('message', handlePlayerMessage);
    return () => window.removeEventListener('message', handlePlayerMessage);
  }, [isWatchTogether]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [wtMessages]);

  const sendWtMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!wtInput.trim() || !channelRef.current || !user) return;
    
    const msg = { user: user.name, text: wtInput, avatar: user.avatar };
    channelRef.current.send({
      type: 'broadcast',
      event: 'chat',
      payload: msg
    });
    setWtMessages(prev => [...prev, msg]);
    setWtInput('');
  };

  useEffect(() => {
    const loadDetails = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const [data, relatedData, similarData, userComments] = await Promise.all([
          fetchAnimeDetails(id),
          fetchRelatedAnimes(id),
          fetchSimilarAnimes(id),
          db.getUserComments(id)
        ]);

        const priorityRelations = ['Продолжение', 'Предыстория', 'Sequel', 'Prequel'];
        const sortedRelated = [...relatedData].sort((a, b) => {
          const aPri = priorityRelations.indexOf(a.relation);
          const bPri = priorityRelations.indexOf(b.relation);
          if (aPri !== -1 && bPri === -1) return -1;
          if (aPri === -1 && bPri !== -1) return 1;
          if (aPri !== -1 && bPri !== -1) return aPri - bPri;
          return 0;
        });

        setAnime(data);
        setRelated(sortedRelated);
        setSimilar(similarData);
        setComments(userComments);

        if (user?.email) {
          const [favs, watched] = await Promise.all([
            db.getFavorites(user.email),
            db.getWatched(user.email)
          ]);
          setIsFavorite(favs.includes(id));
          setIsWatched(watched.includes(id));
        }
      } catch (err) {
        console.error("Details Page Load Error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadDetails();
  }, [id, user]);

  const handleFavorite = async () => {
    if (!user?.email) { openAuthModal(); return; }
    setIsActionLoading(true);
    const newState = await db.toggleFavorite(user.email, id!);
    setIsFavorite(newState);
    setIsActionLoading(false);
  };

  const handleWatched = async () => {
    if (!user?.email) { openAuthModal(); return; }
    setIsActionLoading(true);
    const newState = await db.toggleWatched(user.email, id!);
    setIsWatched(newState);
    setIsActionLoading(false);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { openAuthModal(); return; }
    if (!userComment.trim()) return;
    setIsCommenting(true);
    try {
      const newComment = await db.addComment(id!, user, userComment);
      setComments([newComment, ...comments]);
      setUserComment('');
    } finally {
      setIsCommenting(false);
    }
  };

  const scrollSlider = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const amount = direction === 'left' ? -400 : 400;
      ref.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>;
  if (!anime) return <div className="text-center py-20 text-white font-bold">Аниме не найдено</div>;

  return (
    <div className="w-full relative overflow-x-hidden pb-20">
      <div className="absolute top-0 left-0 w-full h-[60vh] overflow-hidden z-0">
        <img src={anime.cover || anime.image} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover blur-[2px] brightness-[0.4] scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/60 to-transparent" />
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-24 md:pt-32">
        <div className="mb-10 animate-in slide-in-from-bottom-5 duration-700">
           <div className="flex flex-wrap items-center gap-4 mb-4">
              <span className="px-3 py-1 bg-white/10 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest text-white">{anime.type}</span>
              <span className="px-3 py-1 bg-white/10 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest text-white">{anime.year}</span>
              <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${anime.status === 'Ongoing' ? 'bg-green-500/20 text-green-400' : 'bg-primary/20 text-primary'}`}>{anime.status}</span>
           </div>
           <h1 className="text-4xl md:text-6xl font-display font-black text-white leading-tight mb-2 uppercase tracking-tighter drop-shadow-2xl">{anime.title}</h1>
           {anime.originalName && <h2 className="text-xl md:text-2xl font-bold text-slate-400 mb-6">{anime.originalName}</h2>}
           <div className="flex items-center gap-2 text-yellow-400 font-black text-lg bg-black/40 px-4 py-2 rounded-xl border border-white/5 w-fit shadow-xl">
              <Star className="w-5 h-5 fill-current" /> {anime.rating}
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-12">
           <div className="flex flex-col gap-4">
              <div className="aspect-[2/3] rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 ring-4 ring-dark bg-surface hidden lg:block">
                <img src={anime.image} alt={anime.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={handleFavorite} 
                  disabled={isActionLoading} 
                  className={`w-full py-4 glass font-black text-[10px] tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 ${isFavorite ? 'text-pink-500 bg-pink-500/10 border-pink-500/20 shadow-lg shadow-pink-500/10' : 'text-white hover:bg-white/10'}`}
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
                 <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Информация</h3>
                 <div className="space-y-3 text-sm font-medium">
                    <div className="flex justify-between border-b border-white/5 pb-2"><span className="text-slate-400">Тип</span><span className="font-bold text-white">{anime.type}</span></div>
                    <div className="flex justify-between border-b border-white/5 pb-2"><span className="text-slate-400">Эпизоды</span><span className="font-bold text-white">{anime.episodesAired} / {anime.episodes}</span></div>
                    <div className="flex justify-between border-b border-white/5 pb-2"><span className="text-slate-400">Студия</span><span className="font-bold text-white">{anime.studio}</span></div>
                    <div className="pt-2">
                       <span className="text-slate-400 block mb-2">Жанры</span>
                       <div className="flex flex-wrap gap-2">
                          {anime.genres.map(g => (
                            <Link to={`/catalog?genre=${g}`} key={g} className="text-[10px] font-bold bg-white/5 px-2 py-1 rounded text-slate-300 hover:text-primary transition-colors">{g}</Link>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           <div className="space-y-16">
              <section className="bg-surface/30 p-8 md:p-10 rounded-[2.5rem] border border-white/5 shadow-xl backdrop-blur-sm">
                 <h3 className="text-[10px] font-black text-slate-500 mb-6 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-4 h-[2px] bg-primary"></div> Описание
                 </h3>
                 <p className="text-slate-200 leading-relaxed font-medium text-base md:text-lg">{anime.description}</p>
              </section>

              <section className="scroll-mt-24" id="watch">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-lg shadow-primary/20"><Film className="w-6 h-6" /></div> Смотреть онлайн
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    {isWatchTogether && (
                      <button 
                        onClick={copyInviteLink}
                        className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-xl ${copySuccess ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}`}
                      >
                        {copySuccess ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                        {copySuccess ? 'ССЫЛКА СКОПИРОВАНА' : 'ПРИГЛАСИТЬ ДРУГА'}
                      </button>
                    )}
                    <button 
                      onClick={() => user ? setIsWatchTogether(!isWatchTogether) : openAuthModal()}
                      className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-xl ${isWatchTogether ? 'bg-primary text-white shadow-primary/20' : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'}`}
                    >
                      <Users className="w-4 h-4" /> {isWatchTogether ? `СОВМЕСТНЫЙ ПРОСМОТР (${wtUsers})` : 'СОВМЕСТНЫЙ ПРОСМОТР'}
                    </button>
                  </div>
                </div>

                <div className={`grid gap-6 transition-all duration-500 ${isWatchTogether ? 'grid-cols-1 xl:grid-cols-[1fr_350px]' : 'grid-cols-1'}`}>
                  <div className="w-full aspect-video bg-black rounded-[2rem] overflow-hidden border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] relative group">
                      <iframe 
                        ref={iframeRef}
                        src={`https://kodik.cc/find-player?shikimoriID=${id}&js_api=1`} 
                        width="100%" 
                        height="100%" 
                        allow="autoplay *; fullscreen *" 
                        referrerPolicy="origin" 
                        className="w-full h-full border-0" 
                        title="Player" 
                      />
                  </div>

                  {isWatchTogether && (
                    <div className="flex flex-col h-[500px] xl:h-auto bg-surface/50 border border-white/10 rounded-[2rem] overflow-hidden backdrop-blur-md animate-in slide-in-from-right-10 duration-500">
                      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Чат комнаты
                        </span>
                        <button onClick={() => setIsWatchTogether(false)} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar">
                        {wtMessages.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                            <MessageSquare className="w-12 h-12 text-slate-700" />
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Здесь пока пусто. Начните общение!</p>
                          </div>
                        )}
                        {wtMessages.map((m, i) => (
                          <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <img src={m.avatar} className="w-8 h-8 rounded-lg object-cover" alt="" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">{m.user}</p>
                              <div className="bg-white/5 p-3 rounded-2xl rounded-tl-none border border-white/5 text-sm text-slate-300 break-words">{m.text}</div>
                            </div>
                          </div>
                        ))}
                        <div ref={chatEndRef} />
                      </div>

                      <form onSubmit={sendWtMessage} className="p-4 bg-black/20 border-t border-white/5 flex gap-2">
                        <input 
                          type="text" 
                          value={wtInput} 
                          onChange={e => setWtInput(e.target.value)} 
                          placeholder="Сообщение..." 
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-primary outline-none transition-all"
                        />
                        <button type="submit" className="p-2 bg-primary text-white rounded-xl hover:scale-105 active:scale-95 transition-all"><Send className="w-4 h-4" /></button>
                      </form>
                    </div>
                  )}
                </div>
              </section>

              {related.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Связанное</h3>
                    <div className="flex gap-2">
                      <button onClick={() => scrollSlider(relatedRef, 'left')} className="p-2.5 bg-white/5 hover:bg-primary rounded-xl transition-all shadow-xl active:scale-90"><ChevronLeft className="w-5 h-5" /></button>
                      <button onClick={() => scrollSlider(relatedRef, 'right')} className="p-2.5 bg-white/5 hover:bg-primary rounded-xl transition-all shadow-xl active:scale-90"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                  </div>
                  <div ref={relatedRef} className="flex gap-6 overflow-x-auto hide-scrollbar pb-6 snap-x">
                    {related.map((item, idx) => {
                      const isPriority = ['Продолжение', 'Предыстория', 'Sequel', 'Prequel'].includes(item.relation);
                      return (
                        <div key={idx} className="w-[180px] shrink-0 snap-start">
                          <Link to={`/anime/${item.anime.id}`} className="block group relative">
                            <div className={`aspect-[2/3] rounded-3xl overflow-hidden mb-3 border transition-all duration-500 shadow-xl ${isPriority ? 'border-primary shadow-[0_0_15px_rgba(139,92,246,0.3)]' : 'border-white/5 group-hover:border-primary/30'}`}>
                              <img src={item.anime.image} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                              {isPriority && (
                                <div className="absolute top-3 right-3 bg-primary text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg shadow-xl flex items-center gap-1 z-10 animate-pulse">
                                  <Forward className="w-2 h-2" /> NEXT ARC
                                </div>
                              )}
                            </div>
                            <p className={`text-[10px] font-black uppercase mb-1 tracking-widest ${isPriority ? 'text-primary' : 'text-slate-500'}`}>{item.relation}</p>
                            <h4 className={`text-sm font-bold text-white line-clamp-2 group-hover:text-primary transition-colors tracking-tight uppercase`}>{item.anime.title}</h4>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {similar.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Похожее</h3>
                    <div className="flex gap-2">
                      <button onClick={() => scrollSlider(similarRef, 'left')} className="p-2.5 bg-white/5 hover:bg-accent rounded-xl transition-all shadow-xl active:scale-90"><ChevronLeft className="w-5 h-5" /></button>
                      <button onClick={() => scrollSlider(similarRef, 'right')} className="p-2.5 bg-white/5 hover:bg-accent rounded-xl transition-all shadow-xl active:scale-90"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                  </div>
                  <div ref={similarRef} className="flex gap-6 overflow-x-auto hide-scrollbar pb-6 snap-x">
                    {similar.map((sim, idx) => (
                      <div key={idx} className="w-[200px] md:w-[240px] shrink-0 snap-start">
                        <AnimeCard anime={sim} />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="pt-10 border-t border-white/5">
                <h3 className="text-2xl font-black text-white uppercase mb-10">Комментарии ({comments.length})</h3>
                <div className="bg-surface/30 rounded-[2.5rem] p-8 border border-white/5 mb-12 shadow-2xl backdrop-blur-sm">
                   {user ? (
                      <form onSubmit={handleAddComment} className="flex flex-col gap-6">
                         <div className="flex gap-5 items-start">
                            <img src={user.avatar} className="w-14 h-14 rounded-2xl object-cover shadow-lg ring-2 ring-white/5" alt="" />
                            <textarea value={userComment} onChange={(e) => setUserComment(e.target.value)} placeholder="Напишите ваш отзыв..." className="flex-1 bg-dark/60 border border-white/10 rounded-3xl p-6 text-sm text-white focus:border-primary outline-none min-h-[140px] resize-none transition-all shadow-inner" />
                         </div>
                         <button type="submit" disabled={isCommenting || !userComment.trim()} className="self-end px-12 py-4 bg-primary text-white font-black text-[10px] uppercase rounded-2xl shadow-xl shadow-primary/20 disabled:opacity-50 hover:scale-105 active:scale-95 transition-all tracking-widest">
                            {isCommenting ? 'ОТПРАВКА...' : 'ОПУБЛИКОВАТЬ'}
                         </button>
                      </form>
                   ) : (
                      <div className="text-center py-10"><button onClick={openAuthModal} className="px-12 py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-white text-[10px] uppercase hover:bg-white/10 transition-all tracking-widest">АВТОРИЗАЦИЯ</button></div>
                   )}
                </div>

                <div className="space-y-8">
                   {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-6 group">
                         <img src={comment.user.avatar} className="w-14 h-14 rounded-2xl object-cover shrink-0 shadow-md ring-2 ring-white/5" alt="" />
                         <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-3">
                               <span className="font-black text-white text-base">{comment.user.name}</span>
                               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{comment.date}</span>
                            </div>
                            <div className="text-slate-400 text-base leading-relaxed bg-white/[0.02] p-6 rounded-[2rem] border border-white/5 group-hover:border-white/10 transition-all shadow-sm">{comment.text}</div>
                         </div>
                      </div>
                   ))}
                </div>
             </section>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Details;
