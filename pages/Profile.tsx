
import React, { useEffect, useState } from 'react';
import { History, Heart, Settings, Clock, PlayCircle, LogIn, Loader2, Mail, CheckCircle, User as UserIcon, Crown, Users, Save, Edit2, Camera, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { fetchAnimes } from '../services/shikimori';
import { Anime, User } from '../types';
import { Link } from 'react-router-dom';
import imageCompression from 'browser-image-compression';

const Profile: React.FC = () => {
  const { user, openAuthModal, updateProfile } = useAuth();
  const [favorites, setFavorites] = useState<Anime[]>([]);
  const [watched, setWatched] = useState<Anime[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'favs' | 'watched' | 'history' | 'friends' | 'settings'>('favs');
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editBio, setEditBio] = useState(user?.bio || '');
  const [editAvatar, setEditAvatar] = useState(user?.avatar || '');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Неподдерживаемый формат файла. Разрешены: JPG, PNG, WEBP, GIF');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit before compression
      setUploadError('Файл слишком большой. Максимум 10МБ');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // Compression options
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };

      const compressedFile = await imageCompression(file, options);
      
      const publicUrl = await db.uploadAvatar(compressedFile, user.id || user.email);
      if (publicUrl) {
        setEditAvatar(publicUrl);
        // If not in editing mode, save immediately
        if (!isEditing) {
          await updateProfile({ avatar: publicUrl });
        }
      } else {
        setUploadError('Ошибка при загрузке файла в хранилище');
      }
    } catch (err) {
      console.error('Compression/Upload error:', err);
      setUploadError('Произошла ошибка при обработке изображения');
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (!user?.email) return;

    const loadUserData = async () => {
      setIsLoading(true);
      try {
        const [favIds, watchedIds, historyData] = await Promise.all([
          db.getFavorites(user.email),
          db.getWatched(user.email),
          db.getHistory(user.email)
        ]);

        if (favIds.length > 0) {
          const data = await Promise.all(favIds.map(async (id: string) => {
            const res = await fetchAnimes({ ids: id, limit: 1 });
            return res[0];
          }));
          setFavorites(data.filter((a: Anime) => !!a));
        } else setFavorites([]);

        if (watchedIds.length > 0) {
            const data = await Promise.all(watchedIds.map(async (id: string) => {
              const res = await fetchAnimes({ ids: id, limit: 1 });
              return res[0];
            }));
            setWatched(data.filter((a: Anime) => !!a));
        } else setWatched([]);

        setHistory(historyData);
        // Mock friends for now or fetch from DB
        setFriends(user.friends || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [user]);

  const handleSaveProfile = async () => {
    const success = await updateProfile({
      name: editName,
      bio: editBio,
      avatar: editAvatar
    });
    if (success) setIsEditing(false);
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <LogIn className="w-20 h-20 text-slate-600 mx-auto mb-8" />
        <h2 className="text-3xl font-black text-white mb-4 uppercase">Личный кабинет</h2>
        <p className="text-slate-500 mb-10 font-medium">Авторизуйтесь, чтобы синхронизировать ваши данные.</p>
        <button onClick={openAuthModal} className="px-10 py-4 bg-primary rounded-2xl font-black text-white uppercase tracking-widest text-xs">Войти в аккаунт</button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col lg:flex-row gap-10">
        <aside className="w-full lg:w-80 flex-shrink-0 space-y-6">
           <div className="glass p-10 rounded-[2.5rem] flex flex-col items-center text-center border border-white/10 shadow-2xl relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-full h-32 ${user.isPremium ? 'bg-gradient-to-b from-yellow-500/20 to-transparent' : 'bg-gradient-to-b from-primary/20 to-transparent'}`}></div>
              <div className="relative mb-6 group">
                <img src={editAvatar || user.avatar} alt="Profile" className={`w-28 h-28 rounded-full border-4 border-dark ring-2 object-cover ${user.isPremium ? 'ring-yellow-400' : 'ring-primary/50'}`} />
                {user.isPremium && <Crown className="absolute -top-2 -right-2 w-8 h-8 text-yellow-400 fill-current drop-shadow-lg" />}
                
                <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  {isUploading ? <Loader2 className="w-8 h-8 text-white animate-spin" /> : <Camera className="w-8 h-8 text-white" />}
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isUploading} />
                </label>
              </div>
              {uploadError && <p className="text-[10px] text-red-400 font-bold uppercase mb-4">{uploadError}</p>}
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{user.name}</h2>
              <div className="flex flex-col items-center gap-3 mt-4">
                 <span className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-xl border tracking-widest ${user.isPremium ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20' : 'bg-primary/20 text-primary border-primary/20'}`}>
                    {user.isPremium ? 'Premium Member' : 'Пользователь'}
                 </span>
                 <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-widest"><Mail className="w-3 h-3" /> {user.email}</div>
              </div>
              {user.bio && <p className="mt-6 text-slate-400 text-xs font-medium leading-relaxed italic">"{user.bio}"</p>}
           </div>

           <nav className="glass rounded-3xl p-3 space-y-2 border border-white/5 shadow-xl">
              <button onClick={() => setActiveTab('favs')} className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all ${activeTab === 'favs' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-white/5'}`}>
                <div className="flex items-center gap-3"><Heart className="w-5 h-5 fill-current" /><span className="font-black text-[10px] uppercase tracking-widest">Избранное</span></div>
                <span className="text-[10px] font-black bg-black/20 px-2 py-0.5 rounded-lg">{favorites.length}</span>
              </button>
              <button onClick={() => setActiveTab('watched')} className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all ${activeTab === 'watched' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-white/5'}`}>
                <div className="flex items-center gap-3"><CheckCircle className="w-5 h-5 fill-current" /><span className="font-black text-[10px] uppercase tracking-widest">Просмотрено</span></div>
                <span className="text-[10px] font-black bg-black/20 px-2 py-0.5 rounded-lg">{watched.length}</span>
              </button>
              <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${activeTab === 'history' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-white/5'}`}>
                <History className="w-5 h-5" /><span className="font-black text-[10px] uppercase tracking-widest">История</span>
              </button>
              <button onClick={() => setActiveTab('friends')} className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all ${activeTab === 'friends' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-white/5'}`}>
                <div className="flex items-center gap-3"><Users className="w-5 h-5" /><span className="font-black text-[10px] uppercase tracking-widest">Друзья</span></div>
                <span className="text-[10px] font-black bg-black/20 px-2 py-0.5 rounded-lg">{friends.length}</span>
              </button>
              <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${activeTab === 'settings' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-white/5'}`}>
                <Settings className="w-5 h-5" /><span className="font-black text-[10px] uppercase tracking-widest">Настройки</span>
              </button>
           </nav>
        </aside>

        <div className="flex-grow space-y-12">
           {isLoading ? (
             <div className="flex justify-center py-32"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>
           ) : activeTab === 'settings' ? (
             <section className="glass p-10 rounded-[2.5rem] border border-white/10 shadow-2xl animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Настройки профиля</h3>
                  <button 
                    onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20"
                  >
                    {isEditing ? <><Save className="w-4 h-4" /> Сохранить</> : <><Edit2 className="w-4 h-4" /> Редактировать</>}
                  </button>
                </div>
                
                <div className="grid gap-8 max-w-2xl">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Имя пользователя</label>
                    <input 
                      type="text" 
                      disabled={!isEditing}
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full h-14 px-6 bg-white/5 border border-white/10 rounded-2xl text-white focus:border-primary outline-none disabled:opacity-50 transition-all"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Ссылка на аватар</label>
                    <input 
                      type="text" 
                      disabled={!isEditing}
                      value={editAvatar}
                      onChange={e => setEditAvatar(e.target.value)}
                      className="w-full h-14 px-6 bg-white/5 border border-white/10 rounded-2xl text-white focus:border-primary outline-none disabled:opacity-50 transition-all"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">О себе</label>
                    <textarea 
                      disabled={!isEditing}
                      value={editBio}
                      onChange={e => setEditBio(e.target.value)}
                      className="w-full h-32 p-6 bg-white/5 border border-white/10 rounded-2xl text-white focus:border-primary outline-none disabled:opacity-50 transition-all resize-none"
                    />
                  </div>
                </div>
             </section>
           ) : activeTab === 'friends' ? (
             <section className="animate-in fade-in duration-500">
                <h3 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tighter mb-8">
                   <Users className="text-primary" /> Список друзей
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {friends.length > 0 ? friends.map((friend: string, idx: number) => (
                    <div key={idx} className="glass p-6 rounded-[2rem] border border-white/5 flex items-center gap-4 group hover:border-primary/30 transition-all">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${friend}`} className="w-14 h-14 rounded-2xl object-cover" alt="" />
                      <div className="flex-grow">
                        <h4 className="text-white font-black uppercase tracking-tighter">{friend.split('@')[0]}</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{friend}</p>
                      </div>
                      <Link to={`/messages?to=${friend}`} className="p-3 bg-white/5 hover:bg-primary text-slate-400 hover:text-white rounded-xl transition-all">
                        <Mail className="w-5 h-5" />
                      </Link>
                    </div>
                  )) : (
                    <div className="col-span-full p-16 text-center glass rounded-[2rem] border border-white/5">
                      <Users className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                      <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Друзей пока нет</p>
                    </div>
                  )}
                </div>
             </section>
           ) : (
             <section className="animate-in fade-in duration-500">
                <h3 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tighter mb-8">
                   {activeTab === 'favs' ? <Heart className="text-primary" /> : activeTab === 'watched' ? <CheckCircle className="text-primary" /> : <History className="text-primary" />} 
                   {activeTab === 'favs' ? 'Избранное' : activeTab === 'watched' ? 'Просмотрено' : 'История просмотров'}
                </h3>
                
                {(activeTab === 'favs' ? favorites : activeTab === 'watched' ? watched : []).length > 0 || (activeTab === 'history' && history.length > 0) ? (
                    <div className={activeTab === 'history' ? "grid gap-4" : "grid grid-cols-2 sm:grid-cols-4 gap-6"}>
                        {activeTab === 'history' ? history.map((item: any, idx: number) => (
                            <Link to={`/watch/${item.animeId}?ep=${item.episode}`} key={idx} className="glass p-4 rounded-3xl flex items-center gap-6 group border border-transparent hover:border-white/10 transition-all">
                                <div className="w-40 h-24 rounded-2xl overflow-hidden shrink-0"><img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700" alt="" /></div>
                                <div className="flex-grow"><h4 className="text-lg font-black text-white truncate uppercase tracking-tighter">{item.title}</h4><p className="text-xs text-slate-400 font-bold mt-1 uppercase">Серия {item.episode}</p></div>
                                <PlayCircle className="w-10 h-10 text-primary opacity-0 group-hover:opacity-100 transition-all" />
                            </Link>
                        )) : (activeTab === 'favs' ? favorites : watched).map((anime: Anime) => (
                            <Link to={`/anime/${anime.id}`} key={anime.id} className="group relative rounded-3xl overflow-hidden glass border border-transparent hover:border-primary transition-all">
                               <div className="aspect-[2/3] relative">
                                  <img src={anime.image} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700" alt="" />
                                  <div className="absolute inset-0 bg-gradient-to-t from-dark opacity-90"></div>
                                  <div className="absolute bottom-4 left-4 right-4"><h4 className="text-xs font-black text-white truncate uppercase mb-1">{anime.title}</h4><div className="text-[9px] font-black text-primary uppercase">{anime.type}</div></div>
                               </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="p-16 text-center glass rounded-[2rem] border border-white/5"><p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Список пуст</p></div>
                )}
             </section>
           )}
        </div>
      </div>
    </div>
  );
};

export default Profile;