import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { User } from '../types';
import { Search, UserPlus, MessageSquare, Users, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

const Social: React.FC = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);

  useEffect(() => {
    if (!user?.email) return;

    const loadData = async () => {
      setIsLoadingFriends(true);
      try {
        // Load recent users immediately
        db.getRecentUsers(5).then(recentData => {
          let recent = recentData;
          if (recent.length === 0) {
              recent = [
                  { id: 'mock1', name: 'Admin', email: 'admin@example.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin', isPremium: true, episodesWatched: 1240, watchedTime: '500ч', bio: 'Создатель платформы' },
                  { id: 'mock2', name: 'Otaku_King', email: 'king@example.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Otaku', isPremium: false, episodesWatched: 850, watchedTime: '300ч', bio: 'Люблю сёнены' },
                  { id: 'mock3', name: 'AnimeGirl', email: 'girl@example.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Girl', isPremium: true, episodesWatched: 420, watchedTime: '150ч', bio: 'Смотрю только романтику' },
              ];
          }
          setRecentUsers(recent.filter(u => u.email !== user?.email));
        }).catch(console.error);

        // Load friends asynchronously
        if (user.friends && user.friends.length > 0) {
          // Limit initial load to 20 friends
          db.getFriendsList(user.friends.slice(0, 20)).then(friendsData => {
            setFriends(friendsData);
            setIsLoadingFriends(false);
          }).catch(err => {
            console.error(err);
            setIsLoadingFriends(false);
          });
        } else {
          setIsLoadingFriends(false);
        }
      } catch (e) {
        console.error('Failed to load social data', e);
        setIsLoadingFriends(false);
      }
    };
    loadData();
  }, [user?.email]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await db.searchUsers(searchQuery);
    // Filter out self
    setSearchResults(results.filter(u => u.email !== user?.email));
    setIsSearching(false);
  };

  const handleAddFriend = async (targetEmail: string) => {
    if (!user) return;
    const success = await db.addFriend(user.email, targetEmail);
    if (success) {
      // Refresh friends list or optimistic update
      // For now, just reload page or re-fetch
       const updatedUser = await db.getProfile(user.email);
       if (updatedUser && updatedUser.friends) {
           const data = await db.getFriendsList(updatedUser.friends);
           setFriends(data);
       }
       // Also update search results to show "Added" status if needed
    }
  };

  if (!user) return <div className="text-center py-20">Авторизуйтесь для доступа к социальным функциям</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 min-h-screen">
      <SEO title="Люди - Поиск и друзья" description="Находите друзей, общайтесь и делитесь впечатлениями об аниме." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Friends List */}
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-surface/30 rounded-3xl p-6 border border-white/5 backdrop-blur-md">
              <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-6 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Мои друзья
              </h2>
              {isLoadingFriends ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
              ) : friends.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs font-bold uppercase tracking-widest">
                      У вас пока нет друзей
                  </div>
              ) : (
                  <div className="space-y-4">
                      {friends.map(friend => (
                          <div key={friend.id} className="flex items-center justify-between bg-white/5 p-3 rounded-xl gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                  <Link to={`/user/${friend.id || friend.email}`} className="shrink-0">
                                      <img src={friend.avatar} alt={friend.name} className="w-10 h-10 rounded-lg object-cover" />
                                  </Link>
                                  <div className="min-w-0">
                                      <Link to={`/user/${friend.id || friend.email}`} className="font-bold text-sm text-white truncate hover:text-primary transition-colors">{friend.name}</Link>
                                      <div className="text-[10px] text-slate-500 uppercase tracking-wider truncate">Online</div>
                                  </div>
                              </div>
                              <Link to={`/messages?user=${friend.email}`} className="p-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-colors shrink-0">
                                  <MessageSquare className="w-4 h-4" />
                              </Link>
                          </div>
                      ))}
                  </div>
              )}
           </div>
        </div>

        {/* Search Area */}
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface/30 rounded-3xl p-8 border border-white/5 backdrop-blur-md">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-6">Поиск людей</h2>
                <form onSubmit={handleSearch} className="flex gap-4 mb-8">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Введите имя пользователя..."
                            className="w-full bg-black/20 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:border-primary outline-none transition-colors"
                        />
                    </div>
                    <button type="submit" disabled={isSearching} className="px-8 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-violet-600 transition-colors disabled:opacity-50">
                        {isSearching ? <Loader2 className="animate-spin" /> : 'Найти'}
                    </button>
                </form>

                <div className="space-y-4">
                    {searchResults.length > 0 && (
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Результаты поиска</div>
                    )}
                    
                    {/* Show Recent Users if no search results */}
                    {searchResults.length === 0 && !searchQuery && (
                        <div className="space-y-4">
                            <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Недавние пользователи</div>
                            {recentUsers.map(result => {
                                const isFriend = friends.some(f => f.id === result.id);
                                return (
                                    <div key={result.id} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl hover:bg-white/10 transition-colors gap-4">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <Link to={`/user/${result.id || result.email}`} className="shrink-0">
                                                <img src={result.avatar} alt={result.name} className="w-12 h-12 rounded-xl object-cover" />
                                            </Link>
                                            <div className="min-w-0">
                                                <Link to={`/user/${result.id || result.email}`} className="font-bold text-white truncate hover:text-primary transition-colors">{result.name}</Link>
                                                <div className="text-xs text-slate-400 truncate">{result.bio || 'Нет описания'}</div>
                                            </div>
                                        </div>
                                        {isFriend ? (
                                            <Link to={`/messages?user=${result.email}`} className="px-4 py-2 bg-white/5 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-white/10 transition-colors flex items-center gap-2 shrink-0">
                                                <MessageSquare className="w-4 h-4" /> <span className="hidden sm:inline">Написать</span>
                                            </Link>
                                        ) : (
                                            <button 
                                                onClick={() => handleAddFriend(result.email)}
                                                className="px-4 py-2 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-violet-600 transition-colors flex items-center gap-2 shadow-lg shadow-primary/20 shrink-0"
                                            >
                                                <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Добавить</span>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {searchResults.map(result => {
                        const isFriend = friends.some(f => f.id === result.id);
                        return (
                            <div key={result.id} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl hover:bg-white/10 transition-colors gap-4">
                                <div className="flex items-center gap-4 min-w-0">
                                    <Link to={`/user/${result.id || result.email}`} className="shrink-0">
                                        <img src={result.avatar} alt={result.name} className="w-12 h-12 rounded-xl object-cover" />
                                    </Link>
                                    <div className="min-w-0">
                                        <Link to={`/user/${result.id || result.email}`} className="font-bold text-white truncate hover:text-primary transition-colors">{result.name}</Link>
                                        <div className="text-xs text-slate-400 truncate">{result.bio || 'Нет описания'}</div>
                                    </div>
                                </div>
                                {isFriend ? (
                                    <Link to={`/messages?user=${result.email}`} className="px-4 py-2 bg-white/5 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-white/10 transition-colors flex items-center gap-2 shrink-0">
                                        <MessageSquare className="w-4 h-4" /> <span className="hidden sm:inline">Написать</span>
                                    </Link>
                                ) : (
                                    <button 
                                        onClick={() => handleAddFriend(result.email)}
                                        className="px-4 py-2 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-violet-600 transition-colors flex items-center gap-2 shadow-lg shadow-primary/20 shrink-0"
                                    >
                                        <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Добавить</span>
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    {searchResults.length === 0 && searchQuery && !isSearching && (
                        <div className="text-center py-10 text-slate-500">Ничего не найдено</div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Social;
