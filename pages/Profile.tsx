
import React, { useEffect, useState } from 'react';
import { History, Heart, Settings, Clock, PlayCircle, LogIn, Loader2, Mail, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { fetchAnimes } from '../services/shikimori';
import { Anime } from '../types';
import { Link } from 'react-router-dom';

const Profile: React.FC = () => {
  const { user, openAuthModal } = useAuth();
  const [favorites, setFavorites] = useState<Anime[]>([]);
  const [watched, setWatched] = useState<Anime[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'favs' | 'watched' | 'history'>('favs');

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
          const data = await Promise.all(favIds.map(async (id) => {
            const res = await fetchAnimes({ ids: id, limit: 1 });
            return res[0];
          }));
          setFavorites(data.filter(a => !!a));
        } else setFavorites([]);

        if (watchedIds.length > 0) {
            const data = await Promise.all(watchedIds.map(async (id) => {
              const res = await fetchAnimes({ ids: id, limit: 1 });
              return res[0];
            }));
            setWatched(data.filter(a => !!a));
        } else setWatched([]);

        setHistory(historyData);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [user]);

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
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/20 to-transparent"></div>
              <img src={user.avatar} alt="Profile" className="w-28 h-28 rounded-full border-4 border-dark relative mb-6 ring-2 ring-primary/50" />
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{user.name}</h2>
              <div className="flex flex-col items-center gap-3 mt-4">
                 <span className="px-4 py-1.5 bg-primary/20 text-primary text-[10px] font-black uppercase rounded-xl border border-primary/20 tracking-widest">Пользователь</span>
                 <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-widest"><Mail className="w-3 h-3" /> {user.email}</div>
              </div>
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
           </nav>
        </aside>

        <div className="flex-grow space-y-12">
           {isLoading ? (
             <div className="flex justify-center py-32"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>
           ) : (
             <section>
                <h3 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tighter mb-8">
                   {activeTab === 'favs' ? <Heart className="text-primary" /> : activeTab === 'watched' ? <CheckCircle className="text-primary" /> : <History className="text-primary" />} 
                   {activeTab === 'favs' ? 'Избранное' : activeTab === 'watched' ? 'Просмотрено' : 'История просмотров'}
                </h3>
                
                {(activeTab === 'favs' ? favorites : activeTab === 'watched' ? watched : []).length > 0 || (activeTab === 'history' && history.length > 0) ? (
                    <div className={activeTab === 'history' ? "grid gap-4" : "grid grid-cols-2 sm:grid-cols-4 gap-6"}>
                        {activeTab === 'history' ? history.map((item, idx) => (
                            <Link to={`/watch/${item.animeId}?ep=${item.episode}`} key={idx} className="glass p-4 rounded-3xl flex items-center gap-6 group border border-transparent hover:border-white/10 transition-all">
                                <div className="w-40 h-24 rounded-2xl overflow-hidden shrink-0"><img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700" alt="" /></div>
                                <div className="flex-grow"><h4 className="text-lg font-black text-white truncate uppercase tracking-tighter">{item.title}</h4><p className="text-xs text-slate-400 font-bold mt-1 uppercase">Серия {item.episode}</p></div>
                                <PlayCircle className="w-10 h-10 text-primary opacity-0 group-hover:opacity-100 transition-all" />
                            </Link>
                        )) : (activeTab === 'favs' ? favorites : watched).map(anime => (
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