import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useParams, Link, useNavigate } from 'react-router-dom';
import { Star, Heart, Loader2, ChevronLeft, ChevronRight, Film, CheckCircle, Forward, MessageSquare, Users, Send, X, Link as LinkIcon, Check, Home as HomeIcon, Copy, Share2, AlertTriangle, Shield, Bell, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchAnimeDetails, fetchRelatedAnimes, fetchSimilarAnimes } from '../services/shikimori';
import { FALLBACK_IMAGE as PLACEHOLDER_IMAGE, MOCK_ANIME } from '../constants';
import { db, supabase } from '../services/db';
import { Anime, Comment, User, Review } from '../types';
import { Image } from '../components/Image';
import AnimeCard from '../components/AnimeCard';
import SEO from '../components/SEO';
import ReviewSection from '../components/ReviewSection';
import { ReportModal } from '../components/ReportModal';
import { LazyRender } from '../components/LazyRender';
import { usePlayerSync } from '../hooks/usePlayerSync';
import { CustomPlayer } from '../components/CustomPlayer';

const Details: React.FC = () => {
  const { id: paramId, episode: paramEpisode } = useParams<{ id: string, episode?: string }>();
  // Extract numeric ID from the start of the string (e.g. "123-anime-slug" -> "123")
  const id = paramId ? parseInt(paramId).toString() : undefined;

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { openAuthModal, user } = useAuth();
  const relatedRef = useRef<HTMLDivElement>(null);
  const similarRef = useRef<HTMLDivElement>(null);
  
  const [anime, setAnime] = useState<Anime | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('Kodik');
  const [players, setPlayers] = useState<{ name: string; iframe: string | null; isCustom?: boolean }[]>([
    { name: 'Kodik', iframe: null }
  ]);
  const [hasFetchedPlayers, setHasFetchedPlayers] = useState(false);
  const [isPlayersLoading, setIsPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [related, setRelated] = useState<{ relation: string; anime: Anime }[]>([]);
  const [similar, setSimilar] = useState<Anime[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [userComment, setUserComment] = useState('');
  
  const [isLoading, setIsLoading] = useState(true); 
  const [isMainLoading, setIsMainLoading] = useState(true);
  const [isRelatedLoading, setIsRelatedLoading] = useState(true);
  const [isSimilarLoading, setIsSimilarLoading] = useState(true);
  const [isReviewsLoading, setIsReviewsLoading] = useState(true);
  const [isCommentsLoading, setIsCommentsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFavorite, setIsFavorite] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);

  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isRelatedExpanded, setIsRelatedExpanded] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const [roomId, setRoomId] = useState<string | null>(searchParams.get('room'));
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const nativeVideoRef = useRef<HTMLVideoElement>(null);
  const isCustomPlayer = players.find(p => p.name === selectedPlayer)?.isCustom || false;
  const { role, usersCount, myId, sync } = usePlayerSync(roomId, iframeRef, nativeVideoRef, isCustomPlayer);
  
  const [isRoomInstructionOpen, setIsRoomInstructionOpen] = useState(false);

  useEffect(() => {
    if (roomId) {
      const hasSeenInstruction = sessionStorage.getItem(`seen_room_instruction_${roomId}`);
      if (!hasSeenInstruction) {
        setIsRoomInstructionOpen(true);
        sessionStorage.setItem(`seen_room_instruction_${roomId}`, 'true');
      }
    }
  }, [roomId]);

  const handleCreateRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 10);
    setRoomId(newRoomId);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('room', newRoomId);
    window.history.pushState({}, '', newUrl);
  };

  // Lazy loading states
  const [shouldLoadRelated, setShouldLoadRelated] = useState(false);
  const [shouldLoadSimilar, setShouldLoadSimilar] = useState(false);
  const [shouldLoadReviews, setShouldLoadReviews] = useState(false);
  const [shouldLoadComments, setShouldLoadComments] = useState(false);
  
  // Share feature
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [friendsList, setFriendsList] = useState<User[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{type: 'comment' | 'review', id: string, content?: string, link?: string} | null>(null);

  const lastLoadedId = useRef<string | null>(null);

  useEffect(() => {
    if (isShareModalOpen && user?.friends && user.friends.length > 0) {
      setIsLoadingFriends(true);
      db.getFriendsList(user.friends)
        .then(setFriendsList)
        .catch(console.error)
        .finally(() => setIsLoadingFriends(false));
    }
  }, [isShareModalOpen, user?.friends]);

  const [animeStatus, setAnimeStatus] = useState<'watched' | 'watching' | 'dropped' | 'planned' | 'none'>('none');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadDetails = async () => {
      if (!id) return;
      
      // If we already loaded this anime, only update user-specific data if user changed
      if (lastLoadedId.current === id) {
        if (user?.email) {
          db.getProfile(user.email).then(profile => {
            if (isMounted && profile) {
              let status: 'watched' | 'watching' | 'dropped' | 'planned' | 'none' = 'none';
              if (profile.watchedAnimeIds?.includes(id)) status = 'watched';
              else if (profile.watchingAnimeIds?.includes(id)) status = 'watching';
              else if (profile.droppedAnimeIds?.includes(id)) status = 'dropped';
              
              if (status === 'none') {
                 db.getFavorites(user.email).then(favs => {
                    if (isMounted) {
                       if (favs.includes(id)) setAnimeStatus('planned');
                       else setAnimeStatus('none');
                    }
                 });
              } else {
                 setAnimeStatus(status);
              }
            }
          });
        } else {
          setAnimeStatus('none');
        }
        return;
      }

      lastLoadedId.current = id;
      
      // Reset states
      setIsMainLoading(true);
      setError(null);
      setIsRelatedLoading(true);
      setIsSimilarLoading(true);
      setIsReviewsLoading(true);
      setIsCommentsLoading(true);
      setAnime(null);
      setRelated([]);
      setSimilar([]);
      setReviews([]);
      setComments([]);
      setIsDescriptionExpanded(false);
      setPlayers([
        { name: 'Kodik', iframe: null }
      ]);
      setHasFetchedPlayers(false);
      setSelectedPlayer('Kodik');

      // Reset lazy load triggers
      setShouldLoadRelated(false);
      setShouldLoadSimilar(false);
      setShouldLoadReviews(false);
      setShouldLoadComments(false);

      try {
        // 1. Critical Path: Main Details
        let data = await fetchAnimeDetails(id);
        
        if (!isMounted) return;

        if (!data) {
          console.warn(`[Details] API failed for ID ${id}, using fallback mock data`);
          const mock = MOCK_ANIME.find(a => a.id === id) || MOCK_ANIME[0];
          data = {
             ...mock,
             id: id,
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
        setIsMainLoading(false);

        // Fetch DMCA blocks
        db.getDmcaBlocks().then(blocks => {
          if (isMounted) setIsBlocked(blocks.includes(id));
        }).catch(console.error);

        // User specific data (Favorites/Watched) - can be done in parallel with lazy load
        if (user?.email) {
          Promise.all([
            db.getFavorites(user.email),
            db.getProfile(user.email)
          ]).then(([favs, profile]) => {
            if (isMounted && profile) {
              setIsFavorite(favs.includes(id));
              setIsWatched(profile.watchedAnimeIds?.includes(id) || false);
              
              let status: 'watched' | 'watching' | 'dropped' | 'planned' | 'none' = 'none';
              if (profile.watchedAnimeIds?.includes(id)) status = 'watched';
              else if (profile.watchingAnimeIds?.includes(id)) status = 'watching';
              else if (profile.droppedAnimeIds?.includes(id)) status = 'dropped';
              else if (favs.includes(id)) status = 'planned';
              
              setAnimeStatus(status);
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

  // Lazy Load Effects
  useEffect(() => {
    if (shouldLoadRelated && id && related.length === 0) {
      fetchRelatedAnimes(id).then(relatedData => {
        const filteredRelated = relatedData.filter(item => !['Музыка', 'Music'].includes(item.relation));
        const priorityRelations = ['Продолжение', 'Предыстория', 'Sequel', 'Prequel', 'Фильм', 'Movie'];
        const sortedRelated = [...filteredRelated].sort((a, b) => {
          const aPri = priorityRelations.indexOf(a.relation);
          const bPri = priorityRelations.indexOf(b.relation);
          if (aPri !== -1 && bPri === -1) return -1;
          if (aPri === -1 && bPri !== -1) return 1;
          if (aPri !== -1 && bPri !== -1) return aPri - bPri;
          const typeOrder: Record<string, number> = { 'TV Series': 1, 'Movie': 2, 'OVA': 3, 'ONA': 4 };
          const aType = typeOrder[a.anime.type] || 5;
          const bType = typeOrder[b.anime.type] || 5;
          if (aType !== bType) return aType - bType;
          return 0;
        });
        setRelated(sortedRelated);
      }).catch(err => {
        if (err.name !== 'AbortError' && !err.message?.includes('aborted')) console.error("Related fetch error", err);
      })
        .finally(() => setIsRelatedLoading(false));
    }
  }, [shouldLoadRelated, id]);

  useEffect(() => {
    if (shouldLoadSimilar && id && similar.length === 0) {
      fetchSimilarAnimes(id).then(similarData => {
        setSimilar(similarData);
      }).catch(err => {
        if (err.name !== 'AbortError' && !err.message?.includes('aborted')) console.error("Similar fetch error", err);
      })
        .finally(() => setIsSimilarLoading(false));
    }
  }, [shouldLoadSimilar, id]);

  useEffect(() => {
    if (shouldLoadReviews && id && reviews.length === 0) {
      db.getAnimeReviews(id).then(setReviews)
        .catch(err => {
          if (err.name !== 'AbortError' && !err.message?.includes('aborted')) console.error("Reviews fetch error", err);
        })
        .finally(() => setIsReviewsLoading(false));
    }
  }, [shouldLoadReviews, id]);

  useEffect(() => {
    if (shouldLoadComments && id && comments.length === 0) {
      db.getUserComments(id).then(setComments)
        .catch(err => {
          if (err.name !== 'AbortError' && !err.message?.includes('aborted')) console.error("Comments fetch error", err);
        })
        .finally(() => setIsCommentsLoading(false));
    }
  }, [shouldLoadComments, id]);

  // Listen to Kodik player messages to update URL when episode changes
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        if (event.data && (event.data.key === 'kodik_player_message' || event.data.key === 'kodik_player_api')) {
          const { value } = event.data;
          // Kodik sends event: 'kodik_player_current_episode' or 'kodik_player_play'
          if (value && value.episode) {
            const currentEpisode = value.episode;
            const newUrl = `/anime/${id}/episode/${currentEpisode}`;
            if (window.location.pathname !== newUrl) {
              window.history.replaceState(null, '', newUrl);
            }
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [id]);

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

  const handleShareToFriend = async (friendEmail: string) => {
    if (!user?.email || !anime) return;
    setIsSharing(true);
    try {
      const animeUrl = window.location.href;
      const message = `Привет! Посмотри это аниме: ${anime.title}\n${animeUrl}`;
      await db.sendPrivateMessage(user.email, friendEmail, message);
      alert('Ссылка отправлена другу!');
    } catch (e) {
      alert('Ошибка при отправке сообщения');
    } finally {
      setIsSharing(false);
    }
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
    } catch (err: any) {
      alert(err.message || 'Произошла ошибка при отправке комментария');
    } finally {
      setIsCommenting(false);
    }
  };

  const handleStatusChange = async (status: 'watched' | 'watching' | 'dropped' | 'planned' | 'none') => {
    if (!user?.email) { openAuthModal(); return; }
    setIsActionLoading(true);
    const success = await db.setAnimeStatus(user.email, id!, status);
    if (success) {
      setAnimeStatus(status);
      setIsFavorite(status === 'planned');
      setIsWatched(status === 'watched');
    }
    setIsActionLoading(false);
    setIsStatusDropdownOpen(false);
  };

  const scrollSlider = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const amount = direction === 'left' ? -400 : 400;
      ref.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!hasFetchedPlayers && !isPlayersLoading && !playersError && anime) {
      const fetchPlayers = async () => {
        setIsPlayersLoading(true);
        setPlayersError(null);
        try {
          const title = anime.originalName || anime.title;
          const year = anime.year || 0;
          
          const { fetchPlayersClientSide } = await import('../services/balancer');
          const data = await fetchPlayersClientSide(anime.id, title, year.toString());
          
          if (Array.isArray(data) && data.length > 0) {
            // Append episode to iframe URLs if paramEpisode exists
            if (paramEpisode) {
              data.forEach(p => {
                if (p.iframe) {
                  const separator = p.iframe.includes('?') ? '&' : '?';
                  p.iframe = `${p.iframe}${separator}episode=${paramEpisode}`;
                }
              });
            }
            setPlayers(data);
            setHasFetchedPlayers(true);
            // Default to custom player, then first player with an iframe, or Kodik
            const customPlayer = data.find(p => p.isCustom);
            const playerWithIframe = data.find(p => p.iframe);
            if (customPlayer) {
              setSelectedPlayer(customPlayer.name);
            } else if (playerWithIframe) {
              setSelectedPlayer(playerWithIframe.name);
            } else {
              setSelectedPlayer('Kodik');
            }
          } else {
            setHasFetchedPlayers(true);
            throw new Error('Плееры не найдены');
          }
        } catch (err: any) {
          if (err.message !== 'Плееры не найдены') {
            console.error('Balancer Error:', err);
          }
          setPlayersError(err.message || 'Ошибка загрузки плееров');
        } finally {
          setIsPlayersLoading(false);
        }
      };
      
      fetchPlayers();
    }
  }, [anime, hasFetchedPlayers, isPlayersLoading, playersError]);

  if (isMainLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>;
  if (error || !anime) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-3xl font-black text-white mb-4">Не удалось загрузить аниме</h2>
        <p className="text-slate-400 mb-8 max-w-md">Возможно, сервер Shikimori перегружен. Попробуйте обновить страницу через пару секунд.</p>
        <button onClick={() => window.location.reload()} className="px-8 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/80 transition-colors">Обновить страницу</button>
    </div>
  );

  const isYourName = id === '32281';
  const isSuzume = id === '50594';
  
  const seoTitle = isYourName 
    ? `Смотреть Твоё имя (Kimi no Na wa) в 4K онлайн бесплатно` 
    : isSuzume
    ? `Смотреть Судзумэ, закрывающая двери (Suzume no Tojimari) в 4K онлайн бесплатно`
    : `Смотреть ${anime.title} ${anime.originalName ? `/ ${anime.originalName} ` : ''}онлайн бесплатно в хорошем качестве`;
  
  const seoDescription = isYourName
    ? `Смотреть аниме Твоё имя (Kimi no Na wa) в ультра-высоком качестве 4K (UHD) онлайн бесплатно. Потрясающая детализация шедевра Макото Синкая без рекламы.`
    : isSuzume
    ? `Смотреть аниме Судзумэ, закрывающая двери (Suzume no Tojimari) в ультра-высоком качестве 4K (UHD) онлайн бесплатно. Насладитесь потрясающей детализацией шедевра Макото Синкая в 2160p без рекламы.`
    : `Аниме ${anime.title} (${anime.year}). ${anime.description ? anime.description.slice(0, 120) : `Смотреть все серии онлайн бесплатно в хорошем качестве.`}... Смотреть все серии онлайн в озвучке Kodik и других.`;

  const seoKeywords = isYourName
    ? `смотреть твоё имя в 4к, твое имя 4k онлайн, kimi no na wa 4k, макото синкай твое имя 4к, смотреть аниме в 4к, ${anime.title}, ${anime.originalName}`
    : isSuzume
    ? `смотреть судзумэ в 4к, судзумэ закрывающая двери 4k онлайн, suzume no tojimari 4k, макото синкай судзумэ 4к, смотреть аниме в 4к, 2160p, uhd, ${anime.title}, ${anime.originalName}`
    : `${anime.title}, ${anime.originalName}, смотреть ${anime.title}, ${anime.genres.join(', ')}, аниме онлайн, смотреть аниме бесплатно`;

  return (
    <div className="w-full relative overflow-x-hidden pb-20">
      <SEO 
        title={seoTitle} 
        description={seoDescription}
        image={anime.image}
        type="video.movie"
        keywords={seoKeywords}
        schemaData={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": anime.type === 'TV Series' ? "TVSeries" : "Movie",
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
                  "item": "https://animeshka.club/"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Каталог",
                  "item": "https://animeshka.club/catalog"
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": anime.title,
                  "item": `https://animeshka.club/anime/${anime.id}${anime.slug ? `-${anime.slug}` : ''}`
                }
              ]
            }
          ]
        }}
      />
      <div className="absolute top-0 left-0 w-full h-[60vh] overflow-hidden z-0">
        <Image src={anime.cover || anime.image} alt="" animeId={anime.id} animeTitle={anime.originalName || anime.title} priority className="w-full h-full object-cover blur-[2px] brightness-[0.4] scale-105" />
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

        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-12 items-stretch">
           <div className="flex flex-col gap-4 h-full">
              <div className="aspect-[2/3] rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 ring-4 ring-dark bg-surface hidden lg:block shrink-0">
                <Image src={anime.image} alt={anime.title} animeId={anime.id} animeTitle={anime.originalName || anime.title} className="w-full h-full object-cover" />
              </div>
              
              <div className="grid grid-cols-1 gap-3 relative shrink-0" ref={statusDropdownRef}>
                <button 
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  disabled={isActionLoading} 
                  className={`w-full py-4 glass font-black text-[10px] tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 ${animeStatus !== 'none' ? 'text-primary bg-primary/10 border-primary/20 shadow-lg shadow-primary/10' : 'text-white hover:bg-white/10'}`}
                >
                  {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <>
                      {animeStatus === 'watched' && <CheckCircle className="w-4 h-4" />}
                      {animeStatus === 'watching' && <Film className="w-4 h-4" />}
                      {animeStatus === 'dropped' && <X className="w-4 h-4" />}
                      {animeStatus === 'planned' && <Heart className="w-4 h-4 fill-current" />}
                      {animeStatus === 'none' && <Star className="w-4 h-4" />}
                      
                      {animeStatus === 'watched' && 'ПРОСМОТРЕНО'}
                      {animeStatus === 'watching' && 'СМОТРЮ'}
                      {animeStatus === 'dropped' && 'БРОШЕНО'}
                      {animeStatus === 'planned' && 'В ПЛАНАХ'}
                      {animeStatus === 'none' && 'ВЫБРАТЬ СТАТУС'}
                    </>
                  )}
                </button>

                {isStatusDropdownOpen && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-dark/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    <button onClick={() => handleStatusChange('watched')} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/5 flex items-center gap-3 transition-colors">
                      <CheckCircle className="w-4 h-4 text-green-500" /> Просмотрено
                    </button>
                    <button onClick={() => handleStatusChange('watching')} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/5 flex items-center gap-3 transition-colors">
                      <Film className="w-4 h-4 text-blue-500" /> Смотрю
                    </button>
                    <button onClick={() => handleStatusChange('planned')} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/5 flex items-center gap-3 transition-colors">
                      <Heart className="w-4 h-4 text-pink-500" /> В планах
                    </button>
                    <button onClick={() => handleStatusChange('dropped')} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/5 flex items-center gap-3 transition-colors">
                      <X className="w-4 h-4 text-red-500" /> Брошено
                    </button>
                    <button onClick={() => handleStatusChange('none')} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/5 flex items-center gap-3 transition-colors border-t border-white/5">
                      Удалить из списка
                    </button>
                  </div>
                )}

                <button 
                  onClick={() => navigate(`/forum?animeId=${id}`)}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 font-black text-[10px] tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 text-white"
                >
                  <MessageSquare className="w-4 h-4" /> ОБСУДИТЬ НА ФОРУМЕ
                </button>
                <button 
                  onClick={() => {
                    if (!user) { openAuthModal(); return; }
                    setIsShareModalOpen(true);
                  }}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 font-black text-[10px] tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 text-white"
                >
                  <Share2 className="w-4 h-4" /> ПОДЕЛИТЬСЯ С ДРУГОМ
                </button>
                <button 
                  onClick={() => {
                    const url = window.location.href;
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(url);
                      alert('Ссылка скопирована в буфер обмена!');
                    }
                  }}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 font-black text-[10px] tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 text-white"
                >
                  <Copy className="w-4 h-4" /> КОПИРОВАТЬ ССЫЛКУ
                </button>
              </div>

              <div className="bg-surface/50 p-6 rounded-[2rem] border border-white/5 space-y-4 backdrop-blur-md shadow-xl flex-1">
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
                   <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full md:w-auto">
                     {!roomId && (
                       <button
                         onClick={handleCreateRoom}
                         className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap"
                       >
                         <Users className="w-4 h-4" /> Совместный просмотр
                       </button>
                     )}
                     {anime?.status !== 'released' && (
                       <button 
                         onClick={() => {
                           const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'KamiAnime_bot';
                           window.open(`https://t.me/${botUsername}?start=anime_${id}`, '_blank');
                         }}
                         className="px-4 py-2 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 border border-[#0088cc]/20 text-[#0088cc] rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap"
                       >
                         <Bell className="w-4 h-4" /> Уведомлять о сериях
                       </button>
                     )}
                     <div className="flex gap-2 bg-white/5 p-1 rounded-xl overflow-x-auto w-full sm:w-auto">
                       {players.map(player => (
                         <button 
                           key={player.name}
                           onClick={() => setSelectedPlayer(player.name)}
                           className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${selectedPlayer === player.name ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                         >
                           {player.name}
                         </button>
                       ))}
                     </div>
                   </div>
                 </div>

                 {roomId && (
                   <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                     <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400">
                         <Users className="w-5 h-5" />
                       </div>
                       <div>
                         <h4 className="text-white font-bold">Совместный просмотр</h4>
                         <p className="text-sm text-slate-400">
                           Роль: <span className="text-purple-400 font-bold">{role === 'host' ? 'Хост' : 'Зритель'}</span> • Зрителей: {usersCount}
                           {myId && <span className="ml-2 text-[10px] opacity-50 font-mono">({myId.substring(0, 5)})</span>}
                         </p>
                       </div>
                     </div>
                     <div className="flex items-center gap-2">
                       <button 
                         onClick={() => {
                           navigator.clipboard.writeText(window.location.href);
                           // Optional: add a toast here
                         }}
                         className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                       >
                         <Copy className="w-4 h-4" /> Копировать ссылку
                       </button>
                       <button 
                         onClick={() => {
                           setRoomId(null);
                           const newUrl = new URL(window.location.href);
                           newUrl.searchParams.delete('room');
                           window.history.pushState({}, '', newUrl);
                         }}
                         className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                       >
                         <X className="w-4 h-4" />
                       </button>
                     </div>
                   </div>
                 )}

                 <div className="grid gap-6 transition-all duration-500 grid-cols-1">
                   <div className="w-full aspect-video bg-black rounded-[2rem] overflow-hidden border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] relative group">
                       {isBlocked ? (
                         <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-center p-6">
                           <Shield className="w-16 h-16 text-red-500 mb-4" />
                           <h4 className="text-xl font-bold text-white mb-2">Видео недоступно</h4>
                           <p className="text-gray-400">Удалено по требованию правообладателя</p>
                         </div>
                       ) : (
                         <>
                            {isPlayersLoading ? (
                              <div className="absolute inset-0 bg-dark/90 flex flex-col items-center justify-center text-center p-6">
                                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                                <p className="text-slate-300 font-bold text-sm uppercase tracking-widest">Поиск плеера...</p>
                              </div>
                            ) : (players.find(p => p.name === selectedPlayer)?.iframe || players.find(p => p.name === selectedPlayer)?.isCustom) ? (() => {
                              const player = players.find(p => p.name === selectedPlayer)!;
                              if (player.isCustom) {
                                const isSuzume = id === '50594';
                                const customSrc = isSuzume 
                                  ? "https://cdn1.kamianime.club/suzume/master.m3u8" 
                                  : "https://cdn.kamianime.club/kimi-no-na-wa/master.m3u8";
                                const maxTracks = isSuzume ? 5 : undefined;
                                const audioTrackNames = isSuzume ? ['Crunchyroll', 'Flarrow Films', 'TVShows', 'Leviafilm', 'AniLibria'] : undefined;
                                
                                return <CustomPlayer ref={nativeVideoRef} src={customSrc} maxAudioTracks={maxTracks} audioTrackNames={audioTrackNames} />;
                              }
                              let finalIframeUrl = player.iframe;
                              if (paramEpisode && finalIframeUrl && player.name === 'Kodik') {
                                try {
                                  const url = new URL(finalIframeUrl);
                                  url.searchParams.set('episode', paramEpisode);
                                  finalIframeUrl = url.toString();
                                } catch (e) {}
                              }
                              return (
                                <iframe 
                                  ref={iframeRef}
                                  src={finalIframeUrl || undefined} 
                                  width="100%" 
                                  height="100%" 
                                  allow="autoplay *; fullscreen *; accelerometer; gyroscope; picture-in-picture; encrypted-media;" 
                                  referrerPolicy="origin" 
                                  className="w-full h-full border-0" 
                                  title="Player" 
                                />
                              );
                            })() : (
                              <div className="absolute inset-0 bg-dark/90 flex flex-col items-center justify-center text-center p-6">
                                <AlertTriangle className="w-12 h-12 text-slate-500 mb-4" />
                                <p className="text-slate-300 font-bold text-sm uppercase tracking-widest">{playersError || 'Видео не найдено'}</p>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">Возможно, аниме еще не вышло</p>
                              </div>
                            )}
                         </>
                       )}
                   </div>
                 </div>
               </section>
             </div>
          </div>

          {/* Content after player aligned to right column */}
          <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-12 mt-16">
             <div className="hidden lg:block"></div>
             <div className="space-y-16">
              <LazyRender onVisible={() => setShouldLoadRelated(true)}>
                {isRelatedLoading ? (
                  <section>
                    <div className="flex items-center justify-between mb-8">
                      <div className="h-8 w-48 bg-white/10 rounded-lg animate-pulse"></div>
                    </div>
                    <div className="flex flex-col gap-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex gap-4 p-4 rounded-2xl bg-white/5 animate-pulse">
                          <div className="w-16 h-24 bg-white/10 rounded-xl shrink-0"></div>
                          <div className="flex-1 py-2 space-y-2">
                             <div className="h-3 w-20 bg-white/10 rounded"></div>
                             <div className="h-4 w-3/4 bg-white/10 rounded"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : related.length > 0 && (
                  <section>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-8">Порядок просмотра</h3>
                    <div className="flex flex-col gap-3">
                      {related.slice(0, isRelatedExpanded ? related.length : 8).map((item, idx) => {
                        const isPriority = ['Продолжение', 'Предыстория', 'Sequel', 'Prequel'].includes(item.relation);
                        return (
                          <Link key={idx} to={`/anime/${item.anime.id}${item.anime.slug ? `-${item.anime.slug}` : ''}`} className={`flex gap-4 p-3 rounded-2xl transition-all group items-center ${isPriority ? 'bg-primary/10 border border-primary/20 hover:bg-primary/20' : 'bg-white/5 hover:bg-white/10 border border-transparent'}`}>
                            <div className="w-12 h-16 shrink-0 rounded-lg overflow-hidden relative">
                              <img src={item.anime.image} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" alt="" />
                              {isPriority && <div className="absolute inset-0 bg-primary/20"></div>}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <div className={`text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-2 ${isPriority ? 'text-primary' : 'text-slate-500'}`}>
                                {item.relation}
                                {isPriority && <Forward className="w-3 h-3" />}
                              </div>
                              <h4 className={`text-sm font-bold text-white truncate group-hover:text-primary transition-colors`}>{item.anime.title}</h4>
                              <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{item.anime.year} • {item.anime.type}</div>
                            </div>
                            <ChevronRight className={`w-4 h-4 ${isPriority ? 'text-primary' : 'text-slate-600'} group-hover:translate-x-1 transition-transform`} />
                          </Link>
                        );
                      })}
                      {related.length > 8 && (
                          <button 
                              onClick={() => setIsRelatedExpanded(!isRelatedExpanded)}
                              className="text-primary font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 mt-2"
                          >
                              {isRelatedExpanded ? 'Свернуть' : 'Показать еще'}
                              <ChevronRight className={`w-3 h-3 transition-transform ${isRelatedExpanded ? '-rotate-90' : 'rotate-90'}`} />
                          </button>
                      )}
                    </div>
                  </section>
                )}
              </LazyRender>

              <LazyRender onVisible={() => setShouldLoadSimilar(true)}>
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
              </LazyRender>

              <LazyRender onVisible={() => setShouldLoadReviews(true)}>
                <ReviewSection 
                  animeId={id!} 
                  reviews={reviews} 
                  onReviewAdded={(newReview) => setReviews([newReview, ...reviews])} 
                  onReport={(reviewId) => {
                    setReportTarget({ 
                      type: 'review', 
                      id: reviewId, 
                      content: reviews.find(r => r.id === reviewId)?.content,
                      link: window.location.pathname
                    });
                    setIsReportModalOpen(true);
                  }}
                  onDelete={async (reviewId) => {
                    if (window.confirm('Удалить рецензию?')) {
                      await db.deleteReview(reviewId);
                      setReviews(reviews.filter(r => r.id !== reviewId));
                    }
                  }}
                />
              </LazyRender>

              <LazyRender onVisible={() => setShouldLoadComments(true)}>
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
                                <div className="text-slate-400 text-base leading-relaxed bg-white/[0.02] p-6 rounded-[2rem] border border-white/5 group-hover:border-white/10 transition-all shadow-sm">
                                  {comment.text}
                                  <div className="mt-4 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={() => {
                                        setReportTarget({ 
                                          type: 'comment', 
                                          id: comment.id,
                                          content: comment.text,
                                          link: window.location.pathname
                                        });
                                        setIsReportModalOpen(true);
                                      }}
                                      className="text-[10px] font-bold text-slate-500 hover:text-red-500 uppercase tracking-widest flex items-center gap-1"
                                    >
                                      <AlertTriangle className="w-3 h-3" /> Пожаловаться
                                    </button>
                                    {(user?.role === 'admin' || user?.role === 'moderator') && (
                                      <button 
                                        onClick={async () => {
                                          if (window.confirm('Удалить комментарий?')) {
                                            await db.deleteComment(comment.id);
                                            setComments(comments.filter(c => c.id !== comment.id));
                                          }
                                        }}
                                        className="text-[10px] font-bold text-red-500 hover:text-red-400 uppercase tracking-widest flex items-center gap-1"
                                      >
                                        Удалить
                                      </button>
                                    )}
                                  </div>
                                </div>
                             </div>
                          </div>
                       ))
                     )}
                  </div>
                </section>
              </LazyRender>
            </div>
          </div>
        </div>

      {/* Room Instruction Modal */}
      {isRoomInstructionOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface border border-white/10 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-primary"></div>
            <button 
              onClick={() => setIsRoomInstructionOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center text-purple-400 mb-6">
              <Users className="w-6 h-6" />
            </div>
            
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">
              Совместный просмотр
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Добро пожаловать в комнату совместного просмотра! Вот как это работает:
            </p>
            
            <div className="space-y-4 mb-8">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-1">
                  <span className="font-bold text-sm">1</span>
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm">Роли в комнате</h4>
                  <p className="text-slate-400 text-xs mt-1">
                    <strong className="text-purple-400">Хост</strong> (создатель) управляет плеером. <strong className="text-purple-400">Зрители</strong> смотрят синхронно с хостом.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-1">
                  <span className="font-bold text-sm">2</span>
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm">Синхронизация</h4>
                  <p className="text-slate-400 text-xs mt-1">
                    Если видео рассинхронизировалось, просто кликните по плееру, чтобы принудительно синхронизироваться с хостом.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-1">
                  <span className="font-bold text-sm">3</span>
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm">Приглашение друзей</h4>
                  <p className="text-slate-400 text-xs mt-1">
                    Скопируйте ссылку на комнату и отправьте друзьям, чтобы они могли присоединиться к просмотру.
                  </p>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setIsRoomInstructionOpen(false)}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-colors"
            >
              Понятно, начать просмотр
            </button>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-black text-white uppercase tracking-widest">Поделиться с другом</h3>
              <button onClick={() => setIsShareModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {isLoadingFriends ? (
                <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
              ) : friendsList.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-bold uppercase tracking-widest">У вас пока нет друзей</p>
                  <Link to="/community" className="text-primary hover:underline mt-2 inline-block text-xs">Найти друзей</Link>
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
                        onClick={() => handleShareToFriend(friend.email)}
                        disabled={isSharing}
                        className="px-4 py-2 bg-primary hover:bg-violet-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50"
                      >
                        Отправить
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {reportTarget && (
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={() => {
            setIsReportModalOpen(false);
            setReportTarget(null);
          }}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          targetContent={reportTarget.content}
          targetLink={reportTarget.link}
        />
      )}
    </div>
  );
};

export default Details;
