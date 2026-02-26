import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useParams, Link, useNavigate } from 'react-router-dom';
import { Star, Heart, Loader2, ChevronLeft, ChevronRight, Film, CheckCircle, Forward, MessageSquare, Users, Send, X, Link as LinkIcon, Check, Home as HomeIcon, Copy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchAnimeDetails, fetchRelatedAnimes, fetchSimilarAnimes } from '../services/shikimori';
import { FALLBACK_IMAGE as PLACEHOLDER_IMAGE, MOCK_ANIME } from '../constants';
import { db, supabase } from '../services/db';
import { Anime, Comment } from '../types';
import AnimeCard from '../components/AnimeCard';
import SEO from '../components/SEO';

const Details: React.FC = () => {
  const { id: paramId } = useParams<{ id: string }>();
  // Extract numeric ID from the start of the string (e.g. "123-anime-slug" -> "123")
  const id = paramId ? parseInt(paramId).toString() : undefined;

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
  const [isMainLoading, setIsMainLoading] = useState(true);
  const [isRelatedLoading, setIsRelatedLoading] = useState(true);
  const [isSimilarLoading, setIsSimilarLoading] = useState(true);
  const [isCommentsLoading, setIsCommentsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFavorite, setIsFavorite] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);

  // Watch Together State
  const [isWatchTogether, setIsWatchTogether] = useState(false);
  const roomIdFromUrl = searchParams.get('room');
  const [roomId, setRoomId] = useState<string | null>(roomIdFromUrl);
  const [wtMessages, setWtMessages] = useState<{user: string, text: string, avatar: string}[]>([]);
  const [wtInput, setWtInput] = useState('');
  const [wtUsers, setWtUsers] = useState<number>(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  const roomLink = `${window.location.origin}/anime/${id}?room=${roomId || user?.email || ''}`;

  const handleCopyLink = () => {
    const text = roomLink;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }).catch(() => {
        // Fallback
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
          console.error('Fallback copy failed', err);
        }
        document.body.removeChild(textArea);
      });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
    }
  };
  const channelRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastTimeRef = useRef<number>(0);
  const isRemoteAction = useRef<boolean>(false);

  const anonymousUser = useRef({
    name: `Аноним ${Math.floor(Math.random() * 1000)}`,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`,
    email: `anon-${Math.random()}@example.com`
  });

  const currentUser = user || anonymousUser.current;

  const handleOpenInviteModal = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    const profile = await db.getProfile(user.email);
    if (profile && profile.friends) {
      const friends = await db.getFriendsList(profile.friends);
      setFriendsList(friends);
    }
    setIsInviteModalOpen(true);
  };

  const handleInviteFriend = async (friendEmail: string) => {
    if (!user || !roomId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('wt', 'true');
    url.searchParams.set('room', roomId);
    const message = `Присоединяйся к совместному просмотру: ${url.toString()}`;
    await db.sendPrivateMessage(user.email, friendEmail, message);
    setIsInviteModalOpen(false);
  };

  const copyInviteLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId || id || '');
    const text = url.toString();
    
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const toggleWatchTogether = async () => {
    if (!isWatchTogether) {
      const newRoomId = user?.email || Math.random().toString(36).substring(2, 10);
      await db.createWatchRoom(newRoomId, id!, currentUser.name);
      
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('room', newRoomId);
      window.history.replaceState({}, '', newUrl.toString());
      
      setRoomId(newRoomId);
      setIsWatchTogether(true);
    } else {
      if (roomId) await db.deleteWatchRoom(roomId);
      setIsWatchTogether(false);
      setRoomId(null);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('room');
      window.history.replaceState({}, '', newUrl.toString());
    }
  };

  // Auto-join logic
  useEffect(() => {
    const checkRoom = async () => {
      if (roomIdFromUrl) {
        // We'll be more lenient: if it's an email or we can find it, join.
        // Even if it doesn't exist in DB yet, we try to connect to the channel.
        setIsWatchTogether(true);
        setRoomId(roomIdFromUrl);
        
        // Still check DB to see if it's a valid registered room
        const exists = await db.checkWatchRoom(roomIdFromUrl);
        if (!exists) {
          console.log('Room not in DB, but joining channel anyway');
        }
      }
    };
    checkRoom();
  }, [roomIdFromUrl]);

  useEffect(() => {
    const handlePlayerMessage = (event: MessageEvent) => {
      if (!isWatchTogether || !channelRef.current || isRemoteAction.current) return;
      
      const data = event.data;
      if (typeof data !== 'object' || !data.key) return;

      if (data.key === 'kodik_player_time_update') {
        const currentTime = data.value;
        // Detect manual seek: if time jumped more than 2 seconds
        if (Math.abs(currentTime - lastTimeRef.current) > 2) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'player_sync',
            payload: { action: 'seek', time: currentTime }
          });
        }
        lastTimeRef.current = currentTime;
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

  const requestSync = () => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'request_sync',
      payload: { from: currentUser.name }
    });
  };

  useEffect(() => {
    if (isWatchTogether && roomId && supabase) {
      const channel = supabase.channel(`watch-${roomId}`, {
        config: {
          presence: {
            key: currentUser.email,
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
        .on('broadcast', { event: 'request_sync' }, () => {
          // If we are playing, broadcast our current state
          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'player_sync',
              payload: { action: 'seek', time: lastTimeRef.current }
            });
          }
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
          
          // Shorter lockout to remain responsive
          setTimeout(() => { isRemoteAction.current = false; }, 500);
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              user: currentUser.name,
              online_at: new Date().toISOString(),
            });
          }
        });

      channelRef.current = channel;
      return () => {
        channel.unsubscribe();
      };
    }
  }, [isWatchTogether, roomId, currentUser.email]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [wtMessages]);

  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  // Watch Together State

  const sendWtMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!wtInput.trim() || !channelRef.current) return;
    
    const msg = { user: currentUser.name, text: wtInput, avatar: currentUser.avatar };
    channelRef.current.send({
      type: 'broadcast',
      event: 'chat',
      payload: msg
    });
    setWtMessages(prev => [...prev, msg]);
    setWtInput('');
  };

  const lastLoadedId = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadDetails = async () => {
      if (!id) return;
      
      // If we already loaded this anime, only update user-specific data if user changed
      if (lastLoadedId.current === id) {
        if (user?.email) {
          db.getFavorites(user.email).then(favs => {
            if (isMounted) setIsFavorite(favs.includes(id));
          });
          db.getWatched(user.email).then(watched => {
            if (isMounted) setIsWatched(watched.includes(id));
          });
        }
        return;
      }

      lastLoadedId.current = id;
      
      // Reset states
      setIsMainLoading(true);
      setError(null);
      setIsRelatedLoading(true);
      setIsSimilarLoading(true);
      setIsCommentsLoading(true);
      setAnime(null);
      setRelated([]);
      setSimilar([]);
      setComments([]);
      setIsDescriptionExpanded(false);

      try {
        // 1. Critical Path: Main Details
        let data = await fetchAnimeDetails(id);
        
        if (!isMounted) return;

        if (!data) {
          // Fallback for bots/crawlers or critical failure: use mock data to render SOMETHING
          // This prevents 404/Error pages for search engines
          console.warn(`[Details] API failed for ID ${id}, using fallback mock data`);
          const mock = MOCK_ANIME.find(a => a.id === id) || MOCK_ANIME[0];
          // Create a minimal valid anime object from mock
          data = {
             ...mock,
             id: id, // Ensure ID matches URL
             title: mock.title || 'Аниме',
             description: mock.description || 'Описание временно недоступно',
             image: mock.image || PLACEHOLDER_IMAGE,
             cover: mock.cover || PLACEHOLDER_IMAGE,
             genres: mock.genres || [],
             rating: mock.rating || 0,
             year: mock.year || new Date().getFullYear(),
             type: mock.type || 'TV Series',
             status: mock.status || 'Released',
             episodes: mock.episodes || 0,
             episodesAired: mock.episodesAired || 0,
             studio: mock.studio || 'Unknown',
             slug: mock.slug || '',
             originalName: mock.originalName || ''
          };
        }
        
        setAnime(data);
        setIsMainLoading(false); // Unblock UI immediately

        // 2. Lazy Path: Independent fetches
        
        // Fetch Related
        fetchRelatedAnimes(id).then(relatedData => {
          if (!isMounted) return;
          const priorityRelations = ['Продолжение', 'Предыстория', 'Sequel', 'Prequel'];
          const sortedRelated = [...relatedData].sort((a, b) => {
            const aPri = priorityRelations.indexOf(a.relation);
            const bPri = priorityRelations.indexOf(b.relation);
            if (aPri !== -1 && bPri === -1) return -1;
            if (aPri === -1 && bPri !== -1) return 1;
            if (aPri !== -1 && bPri !== -1) return aPri - bPri;
            return 0;
          });
          setRelated(sortedRelated);
        }).catch(err => console.error("Related fetch error", err))
          .finally(() => { if (isMounted) setIsRelatedLoading(false); });

        // Fetch Similar
        fetchSimilarAnimes(id).then(similarData => {
          if (isMounted) setSimilar(similarData);
        }).catch(err => console.error("Similar fetch error", err))
          .finally(() => { if (isMounted) setIsSimilarLoading(false); });

        // Fetch Comments
        db.getUserComments(id).then(userComments => {
          if (isMounted) setComments(userComments);
        }).catch(err => console.error("Comments fetch error", err))
          .finally(() => { if (isMounted) setIsCommentsLoading(false); });

        // User specific data (Favorites/Watched) - can be done in parallel with lazy load
        if (user?.email) {
          Promise.all([
            db.getFavorites(user.email),
            db.getWatched(user.email)
          ]).then(([favs, watched]) => {
            if (isMounted) {
              setIsFavorite(favs.includes(id));
              setIsWatched(watched.includes(id));
            }
          }).catch(err => console.error("User data fetch error", err));
        }

      } catch (err: any) {
        if (!isMounted) return;
        console.error("Details Page Load Error:", err);
        setError(err.message || "Произошла ошибка при загрузке");
        setIsMainLoading(false);
      }
    };
    loadDetails();
    return () => { isMounted = false; };
  }, [id, user?.email]);

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

  if (isMainLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>;
  if (error || !anime) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-3xl font-black text-white mb-4">Не удалось загрузить аниме</h2>
        <p className="text-slate-400 mb-8 max-w-md">Возможно, сервер Shikimori перегружен. Попробуйте обновить страницу через пару секунд.</p>
        <button onClick={() => window.location.reload()} className="px-8 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/80 transition-colors">Обновить страницу</button>
    </div>
  );

  return (
    <div className="w-full relative overflow-x-hidden pb-20">
      <SEO 
        title={`Смотреть ${anime.title}`} 
        description={anime.description?.slice(0, 160) || `Смотреть аниме ${anime.title} онлайн бесплатно в хорошем качестве на AnimeStream.`}
        image={anime.image}
        type="video.movie"
        keywords={`${anime.title}, смотреть ${anime.title}, ${anime.genres.join(', ')}, аниме онлайн`}
        schemaData={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Movie",
              "name": anime.title,
              "alternateName": anime.originalName,
              "description": anime.description,
              "image": anime.image,
              "genre": anime.genres,
              "datePublished": anime.year,
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": anime.rating,
                "bestRating": "10",
                "worstRating": "1",
                "ratingCount": "100"
              }
            },
            {
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Главная",
                  "item": "https://anime-stream.ru/"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Каталог",
                  "item": "https://anime-stream.ru/catalog"
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": anime.title,
                  "item": `https://anime-stream.ru/anime/${anime.id}${anime.slug ? `-${anime.slug}` : ''}`
                }
              ]
            }
          ]
        }}
      />
      <div className="absolute top-0 left-0 w-full h-[60vh] overflow-hidden z-0">
        <img src={anime.cover || anime.image} alt="" referrerPolicy="no-referrer" loading="eager" fetchPriority="high" className="w-full h-full object-cover blur-[2px] brightness-[0.4] scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/60 to-transparent" />
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-24 md:pt-32">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8 overflow-x-auto hide-scrollbar whitespace-nowrap">
          <Link to="/" className="flex items-center gap-1.5 hover:text-white transition-colors">
            <HomeIcon className="w-3 h-3" /> Главная
          </Link>
          <ChevronRight className="w-3 h-3 text-slate-700" />
          <Link to="/catalog" className="hover:text-white transition-colors">Каталог</Link>
          <ChevronRight className="w-3 h-3 text-slate-700" />
          <span className="text-primary truncate max-w-[200px]">{anime.title}</span>
        </nav>

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
                 <div className="relative">
                    <p className={`text-slate-200 leading-relaxed font-medium text-base md:text-lg transition-all duration-500 overflow-hidden ${!isDescriptionExpanded ? 'max-h-[150px] md:max-h-none' : 'max-h-[2000px]'}`}>
                      {anime.description}
                    </p>
                    {!isDescriptionExpanded && (
                      <div className="absolute bottom-0 left-0 w-full h-20 bg-gradient-to-t from-surface/80 to-transparent md:hidden pointer-events-none" />
                    )}
                    <button 
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      className="mt-4 text-primary font-black text-[10px] uppercase tracking-widest md:hidden flex items-center gap-2"
                    >
                      {isDescriptionExpanded ? 'Свернуть' : 'Читать полностью'}
                      <ChevronRight className={`w-3 h-3 transition-transform ${isDescriptionExpanded ? '-rotate-90' : 'rotate-90'}`} />
                    </button>
                  </div>
               </section>

              <section className="scroll-mt-24" id="watch">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-lg shadow-primary/20"><Film className="w-6 h-6" /></div> Смотреть онлайн
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    {isWatchTogether && (
                      <>
                        <button 
                          onClick={requestSync}
                          className="px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-xl bg-white/10 text-white hover:bg-white/20 border border-white/10"
                          title="Синхронизировать плеер с другими участниками"
                        >
                          <Forward className="w-4 h-4" />
                          СИНХРОНИЗИРОВАТЬ
                        </button>
                        <button 
                          onClick={handleOpenInviteModal}
                          className="px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-xl bg-white/10 text-white hover:bg-white/20 border border-white/10"
                        >
                          <Users className="w-4 h-4" />
                          ПРИГЛАСИТЬ ДРУГА
                        </button>
                      </>
                    )}
                    <button 
                      onClick={toggleWatchTogether}
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
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={handleCopyLink}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white flex items-center gap-2"
                            title="Скопировать ссылку"
                          >
                            {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button aria-label="Close chat" onClick={() => setIsWatchTogether(false)} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-black/40 border-b border-white/5">
                        <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">Ссылка на комнату:</p>
                        <div className="flex items-center gap-2 bg-black/40 p-2 rounded-lg border border-white/5">
                          <input 
                            readOnly 
                            value={roomLink} 
                            className="bg-transparent text-[10px] text-slate-300 flex-1 outline-none truncate"
                          />
                          <button onClick={handleCopyLink} className="text-primary hover:text-white transition-colors">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
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
                            <img src={m.avatar} loading="lazy" className="w-8 h-8 rounded-lg object-cover" alt="" />
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
                        <button aria-label="Send message" type="submit" className="p-2 bg-primary text-white rounded-xl hover:scale-105 active:scale-95 transition-all"><Send className="w-4 h-4" /></button>
                      </form>
                    </div>
                  )}
                </div>
              </section>

              {isRelatedLoading ? (
                <section>
                  <div className="flex items-center justify-between mb-8">
                    <div className="h-8 w-48 bg-white/10 rounded-lg animate-pulse"></div>
                  </div>
                  <div className="flex gap-6 overflow-hidden">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="w-[180px] shrink-0">
                        <div className="aspect-[2/3] bg-white/5 rounded-3xl mb-3 animate-pulse"></div>
                        <div className="h-3 w-20 bg-white/5 rounded mb-2 animate-pulse"></div>
                        <div className="h-4 w-full bg-white/5 rounded animate-pulse"></div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : related.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Связанное</h3>
                    <div className="flex gap-2">
                      <button aria-label="Scroll left" onClick={() => scrollSlider(relatedRef, 'left')} className="p-2.5 bg-white/5 hover:bg-primary rounded-xl transition-all shadow-xl active:scale-90"><ChevronLeft className="w-5 h-5" /></button>
                      <button aria-label="Scroll right" onClick={() => scrollSlider(relatedRef, 'right')} className="p-2.5 bg-white/5 hover:bg-primary rounded-xl transition-all shadow-xl active:scale-90"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                  </div>
                  <div ref={relatedRef} className="flex gap-6 overflow-x-auto hide-scrollbar pb-6 snap-x">
                    {related.map((item, idx) => {
                      const isPriority = ['Продолжение', 'Предыстория', 'Sequel', 'Prequel'].includes(item.relation);
                      return (
                        <div key={idx} className="w-[180px] shrink-0 snap-start">
                          <Link to={`/anime/${item.anime.id}${item.anime.slug ? `-${item.anime.slug}` : ''}`} className="block group relative">
                            <div className={`aspect-[2/3] rounded-3xl overflow-hidden mb-3 border transition-all duration-500 shadow-xl ${isPriority ? 'border-primary shadow-[0_0_15px_rgba(139,92,246,0.3)]' : 'border-white/5 group-hover:border-primary/30'}`}>
                              <img src={item.anime.image} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
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

              {isSimilarLoading ? (
                <section>
                  <div className="flex items-center justify-between mb-8">
                    <div className="h-8 w-48 bg-white/10 rounded-lg animate-pulse"></div>
                  </div>
                  <div className="flex gap-6 overflow-hidden">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="w-[200px] md:w-[240px] shrink-0">
                        <div className="aspect-[2/3] bg-white/5 rounded-3xl mb-3 animate-pulse"></div>
                        <div className="h-4 w-3/4 bg-white/5 rounded mb-2 animate-pulse"></div>
                        <div className="h-3 w-1/2 bg-white/5 rounded animate-pulse"></div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : similar.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Похожее</h3>
                    <div className="flex gap-2">
                      <button aria-label="Scroll left" onClick={() => scrollSlider(similarRef, 'left')} className="p-2.5 bg-white/5 hover:bg-accent rounded-xl transition-all shadow-xl active:scale-90"><ChevronLeft className="w-5 h-5" /></button>
                      <button aria-label="Scroll right" onClick={() => scrollSlider(similarRef, 'right')} className="p-2.5 bg-white/5 hover:bg-accent rounded-xl transition-all shadow-xl active:scale-90"><ChevronRight className="w-5 h-5" /></button>
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
                <h3 className="text-2xl font-black text-white uppercase mb-10">Комментарии ({isCommentsLoading ? '...' : comments.length})</h3>
                <div className="bg-surface/30 rounded-[2.5rem] p-8 border border-white/5 mb-12 shadow-2xl backdrop-blur-sm">
                   {user ? (
                      <form onSubmit={handleAddComment} className="flex flex-col gap-6">
                         <div className="flex gap-5 items-start">
                            <img src={user.avatar} loading="lazy" className="w-14 h-14 rounded-2xl object-cover shadow-lg ring-2 ring-white/5" alt="" />
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
                   {isCommentsLoading ? (
                     [...Array(3)].map((_, i) => (
                        <div key={i} className="flex gap-6">
                           <div className="w-14 h-14 bg-white/5 rounded-2xl shrink-0 animate-pulse"></div>
                           <div className="flex-1">
                              <div className="h-4 w-32 bg-white/5 rounded mb-3 animate-pulse"></div>
                              <div className="h-24 w-full bg-white/5 rounded-[2rem] animate-pulse"></div>
                           </div>
                        </div>
                     ))
                   ) : (
                     comments.map((comment) => (
                        <div key={comment.id} className="flex gap-6 group">
                           <img src={comment.user.avatar} loading="lazy" className="w-14 h-14 rounded-2xl object-cover shrink-0 shadow-md ring-2 ring-white/5" alt="" />
                           <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-3">
                                 <span className="font-black text-white text-base">{comment.user.name}</span>
                                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{comment.date}</span>
                              </div>
                              <div className="text-slate-400 text-base leading-relaxed bg-white/[0.02] p-6 rounded-[2rem] border border-white/5 group-hover:border-white/10 transition-all shadow-sm">{comment.text}</div>
                           </div>
                        </div>
                     ))
                   )}
                </div>
             </section>
           </div>
        </div>
      </div>

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-black text-white uppercase tracking-widest">Пригласить друга</h3>
              <button onClick={() => setIsInviteModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {friendsList.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-bold uppercase tracking-widest">У вас пока нет друзей</p>
                  <Link to="/social" className="text-primary hover:underline mt-2 inline-block text-xs">Найти друзей</Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {friendsList.map(friend => (
                    <div key={friend.id} className="flex items-center justify-between bg-white/5 p-3 rounded-2xl hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <img src={friend.avatar} alt={friend.name} className="w-10 h-10 rounded-xl object-cover" />
                        <span className="font-bold text-white text-sm">{friend.name}</span>
                      </div>
                      <button 
                        onClick={() => handleInviteFriend(friend.email)}
                        className="px-4 py-2 bg-primary hover:bg-violet-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-95"
                      >
                        Пригласить
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Details;
