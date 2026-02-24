
import React, { useEffect, useState, useRef } from 'react';
import { History, Heart, Settings, Clock, PlayCircle, LogIn, Loader2, Mail, CheckCircle, User as UserIcon, Crown, Users, Save, Edit2, Camera, Upload, Palette, Layout, Image as ImageIcon, LayoutTemplate } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { fetchAnimes } from '../services/shikimori';
import { Anime, User } from '../types';
import { Link } from 'react-router-dom';
import imageCompression from 'browser-image-compression';
import SEO from '../components/SEO';

const Profile: React.FC = () => {
  const { user, openAuthModal, updateProfile } = useAuth();
  const [favorites, setFavorites] = useState<Anime[]>([]);
  const [watched, setWatched] = useState<Anime[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'favs' | 'watched' | 'history' | 'friends' | 'settings' | 'design'>('favs');
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editBio, setEditBio] = useState(user?.bio || '');
  const [editAvatar, setEditAvatar] = useState(user?.avatar || '');
  
  // Design State
  const [editBg, setEditBg] = useState(user?.profileBg || '');
  const [editBanner, setEditBanner] = useState(user?.profileBanner || '');
  const [editLayout, setEditLayout] = useState<'standard' | 'reversed' | 'centered'>(user?.profileLayout || 'standard');
  const [editTheme, setEditTheme] = useState(user?.themeColor || '#8b5cf6'); // Default primary
  const [editAvatarShape, setEditAvatarShape] = useState<'round' | 'rounded' | 'square'>(user?.avatarShape || 'round');
  const [editCardOpacity, setEditCardOpacity] = useState(user?.cardOpacity ?? 80);
  const [editCardBlur, setEditCardBlur] = useState(user?.cardBlur ?? 10);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        // If not in editing mode (e.g. clicking camera icon), save immediately
        if (!isEditing && activeTab !== 'settings') {
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
        
        // Sync state with user
        setEditName(user.name);
        setEditBio(user.bio || '');
        setEditAvatar(user.avatar);
        setEditBg(user.profileBg || '');
        setEditBanner(user.profileBanner || '');
        setEditLayout(user.profileLayout || 'standard');
        setEditTheme(user.themeColor || '#8b5cf6');
        setEditAvatarShape(user.avatarShape || 'round');
        setEditCardOpacity(user.cardOpacity ?? 80);
        setEditCardBlur(user.cardBlur ?? 10);

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
      avatar: editAvatar,
      profileBg: editBg,
      profileBanner: editBanner,
      profileLayout: editLayout,
      themeColor: editTheme,
      avatarShape: editAvatarShape,
      cardOpacity: editCardOpacity,
      cardBlur: editCardBlur
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

  // Styles based on customization
  const containerStyle = user.profileBg ? {
      backgroundImage: `url(${user.profileBg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed'
  } : {};

  const overlayStyle = user.profileBg ? {
      backgroundColor: `rgba(0,0,0,${1 - (user.cardOpacity ?? 80) / 100})`,
      backdropFilter: 'blur(10px)'
  } : {};

  const cardStyle = {
      backgroundColor: `rgba(20, 20, 20, ${(user.cardOpacity ?? 80) / 100})`,
      backdropFilter: `blur(${user.cardBlur ?? 10}px)`,
      borderColor: user.themeColor || 'rgba(255,255,255,0.1)'
  };

  const avatarClass = user.avatarShape === 'square' ? 'rounded-none' : user.avatarShape === 'rounded' ? 'rounded-2xl' : 'rounded-full';

  return (
    <div className="min-h-screen transition-all duration-500" style={containerStyle}>
      <SEO 
        title={`Профиль ${user.name}`} 
        description={`Личный кабинет пользователя ${user.name} на AnimeStream. История просмотров, избранное и настройки.`}
        image={user.avatar}
      />
      <div className="w-full h-full min-h-screen transition-all duration-500" style={overlayStyle}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className={`flex gap-10 ${user.profileLayout === 'reversed' ? 'flex-col-reverse lg:flex-row-reverse' : user.profileLayout === 'centered' ? 'flex-col items-center lg:items-center' : 'flex-col lg:flex-row'}`}>
            
            {/* Sidebar / Profile Card */}
            <aside className={`w-full ${user.profileLayout === 'centered' ? 'lg:w-2/3' : 'lg:w-80'} flex-shrink-0 space-y-6`}>
               <div className="p-10 rounded-[2.5rem] flex flex-col items-center text-center border shadow-2xl relative overflow-hidden transition-all duration-500" style={cardStyle}>
                  <div 
                    className="absolute top-0 left-0 w-full h-32 bg-cover bg-center"
                    style={{ 
                        backgroundImage: user.profileBanner ? `url(${user.profileBanner})` : undefined,
                        backgroundColor: user.themeColor ? `${user.themeColor}33` : undefined // 20% opacity fallback
                    }}
                  >
                    {!user.profileBanner && <div className={`w-full h-full ${user.isPremium ? 'bg-gradient-to-b from-yellow-500/20 to-transparent' : 'bg-gradient-to-b from-primary/20 to-transparent'}`}></div>}
                  </div>
                  
                  <div className="relative mb-6 group">
                    <img 
                        src={editAvatar || user.avatar} 
                        alt="Profile" 
                        className={`w-28 h-28 border-4 border-dark outline outline-2 object-cover transition-all duration-300 ${avatarClass}`}
                        style={{ outlineColor: user.themeColor || '#8b5cf6' }}
                    />
                    {user.isPremium && <Crown className="absolute -top-2 -right-2 w-8 h-8 text-yellow-400 fill-current drop-shadow-lg" />}
                    
                    <label className={`absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${avatarClass}`}>
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
                     {/* Email hidden from public view as requested */}
                  </div>
                  {user.bio && <p className="mt-6 text-slate-400 text-xs font-medium leading-relaxed italic">"{user.bio}"</p>}
               </div>

               <nav className="rounded-3xl p-3 space-y-2 border shadow-xl transition-all duration-500" style={cardStyle}>
                  <button onClick={() => setActiveTab('favs')} className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all ${activeTab === 'favs' ? 'text-white' : 'text-slate-500 hover:bg-white/5'}`} style={activeTab === 'favs' ? { backgroundColor: user.themeColor || '#8b5cf6' } : {}}>
                    <div className="flex items-center gap-3"><Heart className="w-5 h-5 fill-current" /><span className="font-black text-[10px] uppercase tracking-widest">Избранное</span></div>
                    <span className="text-[10px] font-black bg-black/20 px-2 py-0.5 rounded-lg">{favorites.length}</span>
                  </button>
                  <button onClick={() => setActiveTab('watched')} className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all ${activeTab === 'watched' ? 'text-white' : 'text-slate-500 hover:bg-white/5'}`} style={activeTab === 'watched' ? { backgroundColor: user.themeColor || '#8b5cf6' } : {}}>
                    <div className="flex items-center gap-3"><CheckCircle className="w-5 h-5 fill-current" /><span className="font-black text-[10px] uppercase tracking-widest">Просмотрено</span></div>
                    <span className="text-[10px] font-black bg-black/20 px-2 py-0.5 rounded-lg">{watched.length}</span>
                  </button>
                  <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${activeTab === 'history' ? 'text-white' : 'text-slate-500 hover:bg-white/5'}`} style={activeTab === 'history' ? { backgroundColor: user.themeColor || '#8b5cf6' } : {}}>
                    <History className="w-5 h-5" /><span className="font-black text-[10px] uppercase tracking-widest">История</span>
                  </button>
                  <button onClick={() => setActiveTab('friends')} className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all ${activeTab === 'friends' ? 'text-white' : 'text-slate-500 hover:bg-white/5'}`} style={activeTab === 'friends' ? { backgroundColor: user.themeColor || '#8b5cf6' } : {}}>
                    <div className="flex items-center gap-3"><Users className="w-5 h-5" /><span className="font-black text-[10px] uppercase tracking-widest">Друзья</span></div>
                    <span className="text-[10px] font-black bg-black/20 px-2 py-0.5 rounded-lg">{friends.length}</span>
                  </button>
                  <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${activeTab === 'settings' ? 'text-white' : 'text-slate-500 hover:bg-white/5'}`} style={activeTab === 'settings' ? { backgroundColor: user.themeColor || '#8b5cf6' } : {}}>
                    <Settings className="w-5 h-5" /><span className="font-black text-[10px] uppercase tracking-widest">Настройки</span>
                  </button>
                  {user.isPremium && (
                      <button onClick={() => setActiveTab('design')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${activeTab === 'design' ? 'text-black' : 'text-yellow-500 hover:bg-white/5'}`} style={activeTab === 'design' ? { backgroundColor: '#eab308' } : {}}>
                        <Palette className="w-5 h-5" /><span className="font-black text-[10px] uppercase tracking-widest">Дизайн</span>
                      </button>
                  )}
               </nav>
            </aside>

            {/* Main Content Area */}
            <div className="flex-grow space-y-12">
               {isLoading ? (
                 <div className="flex justify-center py-32"><Loader2 className="w-12 h-12 animate-spin" style={{ color: user.themeColor || '#8b5cf6' }} /></div>
               ) : activeTab === 'settings' ? (
                 <section className="p-10 rounded-[2.5rem] border shadow-2xl animate-in fade-in duration-500" style={cardStyle}>
                    <div className="flex items-center justify-between mb-10">
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Настройки профиля</h3>
                      <button 
                        onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
                        className="flex items-center gap-2 px-6 py-3 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg"
                        style={{ backgroundColor: user.themeColor || '#8b5cf6', boxShadow: `0 10px 15px -3px ${user.themeColor}40` }}
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
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Аватар</label>
                        <div className="flex items-center gap-6">
                            <img src={editAvatar} alt="Avatar Preview" className="w-20 h-20 rounded-2xl object-cover border border-white/10" />
                            {isEditing && (
                                <div className="flex flex-col gap-2">
                                    <button 
                                        onClick={() => fileInputRef.current?.click()} 
                                        disabled={isUploading}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
                                    >
                                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                        Загрузить изображение
                                    </button>
                                    <input 
                                        ref={fileInputRef}
                                        type="file" 
                                        className="hidden" 
                                        accept="image/*" 
                                        onChange={handleAvatarUpload} 
                                    />
                                    <p className="text-[10px] text-slate-500">JPG, PNG, GIF до 10MB</p>
                                </div>
                            )}
                        </div>
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
               ) : activeTab === 'design' && user.isPremium ? (
                 <section className="p-10 rounded-[2.5rem] border shadow-2xl animate-in fade-in duration-500" style={cardStyle}>
                    <div className="flex items-center justify-between mb-10">
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Дизайн профиля</h3>
                      <button 
                        onClick={handleSaveProfile}
                        className="flex items-center gap-2 px-6 py-3 bg-yellow-500 text-black rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-yellow-500/20 hover:bg-yellow-400 transition-colors"
                      >
                        <Save className="w-4 h-4" /> Сохранить изменения
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      {/* Background Image */}
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Фоновое изображение (URL)</label>
                        <div className="relative">
                          <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                          <input 
                            type="text" 
                            value={editBg} 
                            onChange={(e) => setEditBg(e.target.value)} 
                            placeholder="https://example.com/background.jpg" 
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:border-yellow-500 outline-none transition-all" 
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 ml-2">Ссылка на изображение для фона всего профиля.</p>
                      </div>

                      {/* Banner Image */}
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Баннер профиля (URL)</label>
                        <div className="relative">
                          <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                          <input 
                            type="text" 
                            value={editBanner} 
                            onChange={(e) => setEditBanner(e.target.value)} 
                            placeholder="https://example.com/banner.jpg" 
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:border-yellow-500 outline-none transition-all" 
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 ml-2">Ссылка на изображение для шапки карточки профиля.</p>
                      </div>

                      {/* Theme Color */}
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Акцентный цвет</label>
                        <div className="flex items-center gap-4">
                          <input 
                            type="color" 
                            value={editTheme} 
                            onChange={(e) => setEditTheme(e.target.value)}
                            className="w-12 h-12 rounded-xl cursor-pointer border-0 p-0 bg-transparent"
                          />
                          <div className="flex-1">
                             <input 
                                type="text" 
                                value={editTheme} 
                                onChange={(e) => setEditTheme(e.target.value)} 
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white font-mono uppercase focus:border-yellow-500 outline-none transition-all"
                             />
                          </div>
                        </div>
                      </div>

                      {/* Layout */}
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Макет профиля</label>
                        <div className="grid grid-cols-3 gap-3">
                          <button 
                            onClick={() => setEditLayout('standard')}
                            className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${editLayout === 'standard' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                          >
                            <LayoutTemplate className="w-6 h-6" />
                            <span className="text-[10px] font-bold uppercase">Стандарт</span>
                          </button>
                          <button 
                            onClick={() => setEditLayout('reversed')}
                            className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${editLayout === 'reversed' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                          >
                            <LayoutTemplate className="w-6 h-6 rotate-180" />
                            <span className="text-[10px] font-bold uppercase">Реверс</span>
                          </button>
                          <button 
                            onClick={() => setEditLayout('centered')}
                            className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${editLayout === 'centered' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                          >
                            <LayoutTemplate className="w-6 h-6" />
                            <span className="text-[10px] font-bold uppercase">Центр</span>
                          </button>
                        </div>
                      </div>

                      {/* Avatar Shape */}
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Форма аватара</label>
                        <div className="grid grid-cols-3 gap-3">
                          <button 
                            onClick={() => setEditAvatarShape('round')}
                            className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${editAvatarShape === 'round' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                          >
                            <div className="w-6 h-6 rounded-full bg-current opacity-50"></div>
                            <span className="text-[10px] font-bold uppercase">Круг</span>
                          </button>
                          <button 
                            onClick={() => setEditAvatarShape('rounded')}
                            className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${editAvatarShape === 'rounded' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                          >
                            <div className="w-6 h-6 rounded-lg bg-current opacity-50"></div>
                            <span className="text-[10px] font-bold uppercase">Скругленный</span>
                          </button>
                          <button 
                            onClick={() => setEditAvatarShape('square')}
                            className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${editAvatarShape === 'square' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                          >
                            <div className="w-6 h-6 rounded-none bg-current opacity-50"></div>
                            <span className="text-[10px] font-bold uppercase">Квадрат</span>
                          </button>
                        </div>
                      </div>

                      {/* Card Opacity & Blur */}
                      <div className="space-y-4">
                         <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Прозрачность карточек: {editCardOpacity}%</label>
                         <input 
                            type="range" 
                            min="20" 
                            max="100" 
                            value={editCardOpacity} 
                            onChange={(e) => setEditCardOpacity(Number(e.target.value))}
                            className="w-full accent-yellow-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                         />
                      </div>

                      <div className="space-y-4">
                         <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Размытие фона (Blur): {editCardBlur}px</label>
                         <input 
                            type="range" 
                            min="0" 
                            max="40" 
                            value={editCardBlur} 
                            onChange={(e) => setEditCardBlur(Number(e.target.value))}
                            className="w-full accent-yellow-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
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
                                    <div className="w-40 h-24 rounded-2xl overflow-hidden shrink-0">
                                      <img 
                                        src={item.image} 
                                        className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700" 
                                        alt="" 
                                        onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/300x450?text=No+Image'; }}
                                      />
                                    </div>
                                    <div className="flex-grow"><h4 className="text-lg font-black text-white truncate uppercase tracking-tighter">{item.title}</h4><p className="text-xs text-slate-400 font-bold mt-1 uppercase">Серия {item.episode}</p></div>
                                    <PlayCircle className="w-10 h-10 text-primary opacity-0 group-hover:opacity-100 transition-all" />
                                </Link>
                            )) : (activeTab === 'favs' ? favorites : watched).map((anime: Anime) => (
                                <Link to={`/anime/${anime.id}`} key={anime.id} className="group relative rounded-3xl overflow-hidden glass border border-transparent hover:border-primary transition-all">
                                   <div className="aspect-[2/3] relative">
                                      <img 
                                        src={anime.image} 
                                        className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700" 
                                        alt="" 
                                        onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/300x450?text=No+Image'; }}
                                      />
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
      </div>
    </div>
  );
};

export default Profile;