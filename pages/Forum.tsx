import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { MessageSquare, Plus, User, Clock, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { ForumTopic } from '../types';

const Forum: React.FC = () => {
  const [searchParams] = useSearchParams();
  const animeId = searchParams.get('animeId');
  const { user, openAuthModal } = useAuth();
  
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicContent, setNewTopicContent] = useState('');

  useEffect(() => {
    const loadTopics = async () => {
      setIsLoading(true);
      const data = await db.getForumTopics(animeId || undefined);
      setTopics(data);
      setIsLoading(false);
    };
    loadTopics();
  }, [animeId]);

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { openAuthModal(); return; }
    if (!newTopicTitle.trim() || !newTopicContent.trim()) return;
    
    const topic = await db.createForumTopic({
      title: newTopicTitle,
      content: newTopicContent,
      author: user.email,
      animeId: animeId || undefined
    });
    
    if (topic) {
      setTopics([topic, ...topics]);
      setNewTopicTitle('');
      setNewTopicContent('');
      setIsCreating(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
        <div className="space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" /> На главную
          </Link>
          <h1 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">
            {animeId ? 'Обсуждение аниме' : 'Форум сообщества'}
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Делитесь мнениями и создавайте темы</p>
        </div>
        
        <button 
          onClick={() => user ? setIsCreating(!isCreating) : openAuthModal()}
          className="px-8 py-4 bg-primary hover:bg-violet-600 text-white font-black rounded-2xl flex items-center gap-3 transition-all active:scale-95 shadow-xl shadow-primary/20 uppercase text-[10px] tracking-widest"
        >
          <Plus className="w-5 h-5" /> Создать тему
        </button>
      </div>

      {isCreating && (
        <div className="mb-12 bg-surface/30 border border-primary/20 rounded-[2.5rem] p-8 md:p-10 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-300">
          <form onSubmit={handleCreateTopic} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Заголовок темы</label>
              <input 
                type="text" 
                value={newTopicTitle}
                onChange={e => setNewTopicTitle(e.target.value)}
                placeholder="О чем вы хотите поговорить?"
                className="w-full h-16 px-8 bg-black/40 border border-white/10 rounded-2xl text-white focus:border-primary outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Содержание</label>
              <textarea 
                value={newTopicContent}
                onChange={e => setNewTopicContent(e.target.value)}
                placeholder="Раскройте вашу мысль..."
                className="w-full h-40 p-8 bg-black/40 border border-white/10 rounded-[2rem] text-white focus:border-primary outline-none transition-all resize-none"
              />
            </div>
            <div className="flex justify-end gap-4">
              <button type="button" onClick={() => setIsCreating(false)} className="px-8 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors">Отмена</button>
              <button type="submit" className="px-10 py-4 bg-primary text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">Опубликовать</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-6">
        {topics.length === 0 ? (
          <div className="text-center py-20 bg-surface/20 rounded-[3rem] border border-white/5">
            <MessageSquare className="w-16 h-16 text-slate-800 mx-auto mb-6" />
            <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Тем пока нет. Будьте первым!</p>
          </div>
        ) : (
          topics.map(topic => (
            <div key={topic.id} className="group bg-surface/30 hover:bg-surface/50 border border-white/5 hover:border-primary/30 rounded-[2rem] p-8 transition-all cursor-pointer shadow-xl backdrop-blur-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[8px] font-black uppercase tracking-widest">Обсуждение</span>
                    <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(topic.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-white group-hover:text-primary transition-colors uppercase tracking-tight leading-tight">{topic.title}</h3>
                  <div className="flex items-center gap-3 text-slate-400 text-xs font-medium">
                    <User className="w-4 h-4 text-slate-600" />
                    <span>{topic.author}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-500 group-hover:text-white transition-colors font-black uppercase text-[10px] tracking-widest">
                  Перейти <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Forum;
