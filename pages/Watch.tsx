
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Info, ChevronLeft, Film, FastForward, Users, MessageCircle, Send } from 'lucide-react';
import { fetchAnimeDetails } from '../services/shikimori';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { Anime, ChatMessage } from '../types';
import { socketService } from '../services/socketService';

const Watch: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [anime, setAnime] = useState<Anime | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTogether, setIsTogether] = useState(false);
  const [togetherMessages, setTogetherMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const loadData = async () => {
        if (!id) return;
        setIsLoading(true);
        try {
          const details = await fetchAnimeDetails(id);
          setAnime(details);
          if (details && user?.email) {
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

  useEffect(() => {
    if (isTogether) {
      socketService.connect();
      socketService.joinRoom(`watch_${id}`);
      
      const handleSync = (data: any) => {
        if (data.userId !== user?.email) {
          // Sync player state if possible
          console.log("Syncing player:", data);
        }
      };

      const handleMsg = (msg: any) => {
        setTogetherMessages(prev => [...prev, msg]);
      };

      socketService.onWatchSync(handleSync);
      socketService.onGlobalMessage(handleMsg); // Reusing for room messages for now or custom event

      return () => {
        // cleanup
      };
    }
  }, [isTogether, id, user]);

  const skipOpening = () => {
    if (iframeRef.current) {
      // Kodik specific skip (approx 85s)
      iframeRef.current.contentWindow?.postMessage({ 
        key: 'kodik_player_api', 
        value: { method: 'seek', parameters: 85 } 
      }, '*');
    }
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
    socketService.sendGlobalMessage(msg); // Should be room specific in real app
    setChatText('');
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>;
  if (!anime) return <div className="max-w-4xl mx-auto py-20 text-center"><h2 className="text-white mt-4 font-black uppercase">Аниме не найдено</h2></div>;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col lg:flex-row gap-8">
        
        <div className="flex-1 space-y-6">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <Link to={`/anime/${id}`} className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-all mb-4">
                <ChevronLeft className="w-4 h-4" /> К описанию
              </Link>
              <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none">{anime.title}</h1>
            </div>
            <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsTogether(!isTogether)}
                  className={`flex items-center gap-3 px-6 py-3 rounded-2xl border transition-all font-black uppercase text-[10px] tracking-widest ${isTogether ? 'bg-primary text-white border-primary' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
                >
                    <Users className="w-5 h-5" />
                    {isTogether ? 'Совместный просмотр: ВКЛ' : 'Совместный просмотр'}
                </button>
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-3 rounded-2xl">
                    <Film className="w-5 h-5 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Прямая трансляция</span>
                </div>
            </div>
          </header>

          {/* Instant Player Container */}
          <div className="relative aspect-video bg-black rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,1)] border border-white/10 ring-1 ring-white/5 z-0 group">
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

          <div className="p-8 bg-surface/30 rounded-[2.5rem] border border-white/5 flex items-start gap-6 mt-4 shadow-xl backdrop-blur-sm">
             <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/10 text-primary">
                <Info className="w-6 h-6" />
             </div>
             <div>
                <h4 className="font-black text-white uppercase text-xs tracking-widest mb-2">Инструкция плеера</h4>
                <p className="text-slate-400 leading-relaxed text-sm font-medium">
                  Все доступные озвучки и список серий находятся прямо в интерфейсе плеера. 
                  Нажмите на значок «Шестеренка» или «Список» внутри видео, чтобы сменить перевод или выбрать нужный эпизод.
                </p>
             </div>
          </div>
        </div>

        {/* Watch Together Chat */}
        {isTogether && (
          <aside className="w-full lg:w-[400px] flex flex-col bg-surface/30 rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl backdrop-blur-md animate-in slide-in-from-right-10 duration-500">
            <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageCircle className="w-5 h-5 text-primary" />
                <span className="font-black uppercase text-xs tracking-widest text-white">Чат комнаты</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-black/30 rounded-full border border-white/5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">LIVE</span>
              </div>
            </div>
            
            <div className="flex-1 h-[500px] overflow-y-auto p-6 space-y-4">
              {togetherMessages.map(msg => (
                <div key={msg.id} className="flex gap-3">
                  <img src={msg.user.avatar} className="w-8 h-8 rounded-lg object-cover" alt="" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-white">{msg.user.name}</span>
                    </div>
                    <div className="p-3 bg-white/5 rounded-2xl rounded-tl-none text-xs text-slate-300 border border-white/5">
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="p-6 bg-black/20 border-t border-white/5 flex gap-3">
              <input 
                type="text" 
                value={chatText}
                onChange={e => setChatText(e.target.value)}
                placeholder="Написать..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-primary outline-none"
              />
              <button type="submit" className="w-10 h-10 bg-primary hover:bg-violet-600 text-white rounded-xl flex items-center justify-center transition-all">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </aside>
        )}
      </div>
    </div>
  );
};

export default Watch;