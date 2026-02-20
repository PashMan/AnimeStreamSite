
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { Loader2, Send, MessageSquare, ChevronLeft } from 'lucide-react';
import { PrivateMessage } from '../types';

const Messages: React.FC = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const msgEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const loadThreads = async () => {
      setIsLoading(true);
      const data = await db.getConversations(user.email);
      setConversations(data);
      setIsLoading(false);
    };
    loadThreads();
  }, [user]);

  useEffect(() => {
    if (!user || !activeThread) return;
    const loadMsgs = async () => {
      const data = await db.getPrivateMessages(user.email, activeThread);
      setMessages(data);
    };
    loadMsgs();
  }, [user, activeThread]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeThread || !inputText.trim()) return;
    const msg = await db.sendPrivateMessage(user.email, activeThread, inputText);
    setMessages([...messages, msg]);
    setInputText('');
    
    // Update last text in conversation list
    setConversations(prev => prev.map(c => c.email === activeThread ? {...c, lastText: inputText} : c));
  };

  if (!user) return <div className="text-center py-20">Авторизуйтесь для доступа к сообщениям</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 h-[calc(100vh-140px)]">
      <div className="bg-surface/30 rounded-[3rem] border border-white/5 h-full flex overflow-hidden shadow-2xl backdrop-blur-md">
        
        {/* Sidebar */}
        <aside className={`w-full md:w-80 lg:w-96 border-r border-white/5 flex flex-col ${activeThread ? 'hidden md:flex' : 'flex'}`}>
           <div className="p-8 border-b border-white/5">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Диалоги</h2>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-2 hide-scrollbar">
              {isLoading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div> : 
               conversations.length === 0 ? <div className="text-center py-10 text-slate-500 text-xs font-bold uppercase tracking-widest">У вас пока нет переписок</div> : 
               conversations.map(c => (
                 <button 
                    key={c.email} 
                    onClick={() => setActiveThread(c.email)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeThread === c.email ? 'bg-primary text-white' : 'hover:bg-white/5'}`}
                 >
                    <img src={c.avatar} className="w-12 h-12 rounded-xl object-cover shrink-0" alt="" />
                    <div className="text-left min-w-0">
                       <h4 className="font-black text-sm uppercase tracking-tight truncate">{c.name}</h4>
                       <p className={`text-[11px] truncate ${activeThread === c.email ? 'text-white/70' : 'text-slate-500'}`}>{c.lastText}</p>
                    </div>
                 </button>
               ))
              }
           </div>
        </aside>

        {/* Chat Area */}
        <main className={`flex-1 flex flex-col ${!activeThread ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
           {!activeThread ? (
             <div className="text-center opacity-20">
                <MessageSquare className="w-24 h-24 mx-auto mb-4" />
                <p className="font-black uppercase tracking-[0.3em] text-xs">Выберите чат для общения</p>
             </div>
           ) : (
             <>
                <header className="p-6 border-b border-white/5 flex items-center gap-4 bg-white/5">
                   <button onClick={() => setActiveThread(null)} className="md:hidden p-2 bg-white/5 rounded-lg"><ChevronLeft /></button>
                   <img src={conversations.find(c => c.email === activeThread)?.avatar} className="w-10 h-10 rounded-xl" alt="" />
                   <h3 className="font-black text-white uppercase tracking-tighter">{conversations.find(c => c.email === activeThread)?.name}</h3>
                </header>
                <div className="flex-1 overflow-y-auto p-8 space-y-6 hide-scrollbar">
                   {messages.map(m => (
                     <div key={m.id} className={`flex ${m.from === user.email ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] p-4 rounded-2xl text-sm font-medium ${m.from === user.email ? 'bg-primary text-white rounded-tr-none' : 'bg-white/5 text-slate-200 rounded-tl-none'}`}>
                           {m.text}
                           <div className="text-[9px] mt-1 opacity-50 text-right">{new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                        </div>
                     </div>
                   ))}
                   <div ref={msgEndRef} />
                </div>
                <form onSubmit={handleSend} className="p-6 border-t border-white/5 flex gap-4 bg-dark/20">
                   <input 
                     type="text" 
                     value={inputText}
                     onChange={e => setInputText(e.target.value)}
                     placeholder="Введите сообщение..."
                     className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-primary outline-none"
                   />
                   <button type="submit" disabled={!inputText.trim()} className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center transition-all disabled:opacity-50">
                      <Send className="w-6 h-6" />
                   </button>
                </form>
             </>
           )}
        </main>
      </div>
    </div>
  );
};

export default Messages;