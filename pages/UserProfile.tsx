
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { User, Anime } from '../types';
import { fetchAnimes } from '../services/shikimori';
import { Loader2, Heart, History, ArrowLeft, UserPlus, MessageSquare, Check, Film, X } from 'lucide-react';
import SEO from '../components/SEO';
import { Image } from '../components/Image';
import { useSlugBlocks } from '../store/slugBlocks';
import { useDmcaBlocks } from '../store/dmcaBlocks';

const UserProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const { slugBlocks } = useSlugBlocks();
  const { dmcaBlocks } = useDmcaBlocks();
  const [profile, setProfile] = useState<User | null>(null);
  const [allFavIds, setAllFavIds] = useState<string[]>([]);
  const [allWatchedIds, setAllWatchedIds] = useState<string[]>([]);
  const [allWatchingIds, setAllWatchingIds] = useState<string[]>([]);
  const [allDroppedIds, setAllDroppedIds] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Anime[]>([]);
  const [watched, setWatched] = useState<Anime[]>([]);
  const [watching, setWatching] = useState<Anime[]>([]);
  const [dropped, setDropped] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'favs' | 'watched' | 'watching' | 'dropped'>('favs');
  const [isFriend, setIsFriend] = useState(false);
  const [isAddingFriend, setIsAddingFriend] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        let user: User | null = null;
        
        // Check if ID is UUID or email (simple check)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        
        if (isUuid) {
            user = await db.getProfileById(id);
        } else if (id.includes('@')) {
            user = await db.getProfile(id);
        } else {
            // Try fetching by name first, then fallback to ID
            user = await db.getProfileByName(id);
            if (!user) {
                user = await db.getProfileById(id);
            }
        }

        if (user) {
          setProfile(user);
          setIsLoading(false); // Stop loading immediately after profile is found
          
          // Check friendship status
          if (currentUser && currentUser.friends && (currentUser.friends.includes(user.email) || currentUser.friends.includes(user.id || ''))) {
              setIsFriend(true);
          }
          
          // Load lists asynchronously
          const [favIds, watchedIds] = await Promise.all([
            db.getFavorites(user.email),
            db.getWatched(user.email)
          ]);

          setAllFavIds(favIds);
          setAllWatchedIds(watchedIds);
          setAllWatchingIds(user.watchingAnimeIds || []);
          setAllDroppedIds(user.droppedAnimeIds || []);

        } else {
            setIsLoading(false);
        }
      } catch (e) {
        console.error('Failed to load user profile', e);
        setIsLoading(false);
      }
    };
    loadProfile();
  }, [id, currentUser]);

  // Lazy load tab content
  useEffect(() => {
    const loadTabContent = async () => {
      if (activeTab === 'favs' && favorites.length === 0 && Array.isArray(allFavIds) && allFavIds.length > 0) {
         const idsToLoad = allFavIds.filter(Boolean).slice(0, 20);
         if (idsToLoad.length === 0) return;
         try {
            const data = await fetchAnimes({ ids: idsToLoad.join(','), limit: idsToLoad.length }, true);
            setFavorites(data);
         } catch (e) {
            console.error("Error loading favorites", e);
         }
      } else if (activeTab === 'watched' && watched.length === 0 && Array.isArray(allWatchedIds) && allWatchedIds.length > 0) {
         const idsToLoad = allWatchedIds.filter(Boolean).slice(0, 20);
         if (idsToLoad.length === 0) return;
         try {
            const data = await fetchAnimes({ ids: idsToLoad.join(','), limit: idsToLoad.length }, true);
            setWatched(data);
         } catch (e) {
            console.error("Error loading watched", e);
         }
      } else if (activeTab === 'watching' && watching.length === 0 && Array.isArray(allWatchingIds) && allWatchingIds.length > 0) {
         const idsToLoad = allWatchingIds.filter(Boolean).slice(0, 20);
         if (idsToLoad.length === 0) return;
         try {
            const data = await fetchAnimes({ ids: idsToLoad.join(','), limit: idsToLoad.length }, true);
            setWatching(data);
         } catch (e) {
            console.error("Error loading watching", e);
         }
      } else if (activeTab === 'dropped' && dropped.length === 0 && Array.isArray(allDroppedIds) && allDroppedIds.length > 0) {
         const idsToLoad = allDroppedIds.filter(Boolean).slice(0, 20);
         if (idsToLoad.length === 0) return;
         try {
            const data = await fetchAnimes({ ids: idsToLoad.join(','), limit: idsToLoad.length }, true);
            setDropped(data);
         } catch (e) {
            console.error("Error loading dropped", e);
         }
      }
    };
    loadTabContent();
  }, [activeTab, allFavIds, allWatchedIds, allWatchingIds, allDroppedIds]);

  const handleAddFriend = async () => {
      if (!currentUser || !profile) return;
      setIsAddingFriend(true);
      try {
          const success = await db.addFriend(currentUser.email, profile.email);
          if (success) setIsFriend(true);
      } catch (e) {
          console.error(e);
      } finally {
          setIsAddingFriend(false);
      }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold text-white">Пользователь не найден</h1>
        <Link to="/" className="text-primary hover:underline">На главную</Link>
      </div>
    );
  }

  const isOwnProfile = currentUser?.email === profile.email;

  return (
    <div className="min-h-screen pb-20">
      <SEO title={`${profile.name} - Профиль`} description={`Профиль пользователя ${profile.name} на KamiAnime`} />
      
      {/* Banner */}
      <div className="h-64 md:h-80 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface/90 z-10"></div>
        {profile.profileBanner ? (
          <img src={profile.profileBanner} alt="Banner" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-surface-light/10"></div>
        )}
        <Link to="/" className="absolute top-8 left-8 z-20 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors">
            <ArrowLeft className="w-6 h-6" />
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 relative z-20">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Avatar & Info */}
          <div className="w-full md:w-80 flex flex-col gap-6">
             <div className="relative group mx-auto md:mx-0">
                <div className={`w-40 h-40 md:w-48 md:h-48 ${profile.avatarShape === 'round' ? 'rounded-full' : profile.avatarShape === 'square' ? 'rounded-none' : 'rounded-3xl'} overflow-hidden border-4 border-surface shadow-2xl bg-surface`}>
                  <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                </div>
             </div>

             <div className="bg-surface/50 backdrop-blur-md border border-white/5 rounded-3xl p-6 space-y-4">
                <h1 className="text-2xl font-black text-white uppercase tracking-tight text-center md:text-left">{profile.name}</h1>
                {profile.bio && (
                    <p className="text-slate-400 text-sm leading-relaxed text-center md:text-left">{profile.bio}</p>
                )}
                
                {!isOwnProfile && (
                    <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
                        {isFriend ? (
                            <button disabled className="w-full py-3 bg-green-500/20 text-green-500 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 cursor-default">
                                <Check className="w-4 h-4" /> В друзьях
                            </button>
                        ) : (
                            <button 
                                onClick={handleAddFriend}
                                disabled={isAddingFriend || !currentUser}
                                className="w-full py-3 bg-primary text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-violet-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                            >
                                {isAddingFriend ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                Добавить в друзья
                            </button>
                        )}
                        
                        <Link 
                            to={`/messages?user=${profile.email}`}
                            className="w-full py-3 bg-white/5 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                        >
                            <MessageSquare className="w-4 h-4" />
                            Написать сообщение
                        </Link>
                    </div>
                )}
             </div>
          </div>

          {/* Content */}
          <div className="flex-1 w-full">
             {/* Tabs */}
             <div className="flex gap-4 border-b border-white/5 mb-8 overflow-x-auto pb-2">
                <button 
                  onClick={() => setActiveTab('favs')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'favs' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                >
                    <Heart className="w-4 h-4" /> Избранное <span className="opacity-50 ml-1">{favorites.length}</span>
                </button>
                <button 
                  onClick={() => setActiveTab('watched')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'watched' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                >
                    <History className="w-4 h-4" /> Просмотрено <span className="opacity-50 ml-1">{allWatchedIds.length}</span>
                </button>
                <button 
                  onClick={() => setActiveTab('watching')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'watching' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                >
                    <Film className="w-4 h-4" /> Смотрю <span className="opacity-50 ml-1">{allWatchingIds.length}</span>
                </button>
                <button 
                  onClick={() => setActiveTab('dropped')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'dropped' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                >
                    <X className="w-4 h-4" /> Брошено <span className="opacity-50 ml-1">{allDroppedIds.length}</span>
                </button>
             </div>

             {/* Grid */}
             <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {activeTab === 'favs' && favorites.map(anime => {
                    const isDmcaBlocked = dmcaBlocks.includes(anime.id.toString());
                    const isSlugBlocked = slugBlocks.includes(anime.id.toString());
                    const targetUrl = isDmcaBlocked ? `/anime/${anime.id}-watch` : `/anime/${anime.id}${anime.slug && !isSlugBlocked ? `-${anime.slug}` : ''}`;
                    return (
                    <Link key={anime.id} to={targetUrl} className="group relative aspect-[2/3] rounded-2xl overflow-hidden bg-surface-light">
                        <Image src={anime.image} animeId={anime.id} animeTitle={anime.originalName || anime.title} alt={anime.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                            <h3 className="text-white font-bold text-sm line-clamp-2">{anime.title}</h3>
                        </div>
                    </Link>
                )})}
                {activeTab === 'watched' && watched.map(anime => {
                    const isDmcaBlocked = dmcaBlocks.includes(anime.id.toString());
                    const isSlugBlocked = slugBlocks.includes(anime.id.toString());
                    const targetUrl = isDmcaBlocked ? `/anime/${anime.id}-watch` : `/anime/${anime.id}${anime.slug && !isSlugBlocked ? `-${anime.slug}` : ''}`;
                    return (
                    <Link key={anime.id} to={targetUrl} className="group relative aspect-[2/3] rounded-2xl overflow-hidden bg-surface-light">
                        <Image src={anime.image} animeId={anime.id} animeTitle={anime.originalName || anime.title} alt={anime.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                            <h3 className="text-white font-bold text-sm line-clamp-2">{anime.title}</h3>
                        </div>
                    </Link>
                )})}
                {activeTab === 'watching' && watching.map(anime => {
                    const isDmcaBlocked = dmcaBlocks.includes(anime.id.toString());
                    const isSlugBlocked = slugBlocks.includes(anime.id.toString());
                    const targetUrl = isDmcaBlocked ? `/anime/${anime.id}-watch` : `/anime/${anime.id}${anime.slug && !isSlugBlocked ? `-${anime.slug}` : ''}`;
                    return (
                    <Link key={anime.id} to={targetUrl} className="group relative aspect-[2/3] rounded-2xl overflow-hidden bg-surface-light">
                        <Image src={anime.image} animeId={anime.id} animeTitle={anime.originalName || anime.title} alt={anime.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                            <h3 className="text-white font-bold text-sm line-clamp-2">{anime.title}</h3>
                        </div>
                    </Link>
                )})}
                {activeTab === 'dropped' && dropped.map(anime => {
                    const isDmcaBlocked = dmcaBlocks.includes(anime.id.toString());
                    const isSlugBlocked = slugBlocks.includes(anime.id.toString());
                    const targetUrl = isDmcaBlocked ? `/anime/${anime.id}-watch` : `/anime/${anime.id}${anime.slug && !isSlugBlocked ? `-${anime.slug}` : ''}`;
                    return (
                    <Link key={anime.id} to={targetUrl} className="group relative aspect-[2/3] rounded-2xl overflow-hidden bg-surface-light">
                        <Image src={anime.image} animeId={anime.id} animeTitle={anime.originalName || anime.title} alt={anime.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                            <h3 className="text-white font-bold text-sm line-clamp-2">{anime.title}</h3>
                        </div>
                    </Link>
                )})}
             </div>
             
             {((activeTab === 'favs' && favorites.length === 0 && allFavIds.length === 0) || 
               (activeTab === 'watched' && watched.length === 0 && allWatchedIds.length === 0) ||
               (activeTab === 'watching' && watching.length === 0 && allWatchingIds.length === 0) ||
               (activeTab === 'dropped' && dropped.length === 0 && allDroppedIds.length === 0)) && (
                 <div className="text-center py-20 text-slate-500 text-sm uppercase tracking-widest font-bold">
                     Список пуст
                 </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
