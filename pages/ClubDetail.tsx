import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { Club, ClubMember, ClubMessage } from '../types';
import { 
  Users, 
  MessageSquare, 
  Shield, 
  LogOut, 
  Send, 
  Loader2, 
  ArrowLeft,
  Settings,
  Plus
} from 'lucide-react';
import SEO from '../components/SEO';

const ClubDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [messages, setMessages] = useState<ClubMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isMember = user && members.some(m => m.userId === user.id);
  const userRole = user ? members.find(m => m.userId === user.id)?.role : null;
  const isAdmin = userRole === 'admin' || userRole === 'moderator';

  useEffect(() => {
    if (!id) return;

    const loadClubData = async () => {
      setIsLoading(true);
      try {
        const clubData = await db.getClub(id);
        if (!clubData) {
          navigate('/social');
          return;
        }
        setClub(clubData);

        const membersData = await db.getClubMembers(id);
        setMembers(membersData);

        const messagesData = await db.getClubMessages(id);
        setMessages(messagesData);
      } catch (error) {
        console.error('Error loading club:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadClubData();

    // Set up real-time subscription for messages if needed
    // For now, we'll just poll or rely on manual refresh
  }, [id, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleJoin = async () => {
    if (!user?.id || !id || isJoining) return;
    setIsJoining(true);
    try {
      const success = await db.joinClub(id, user.id);
      if (success) {
        const updatedMembers = await db.getClubMembers(id);
        setMembers(updatedMembers);
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!user?.id || !id || !window.confirm('Вы уверены, что хотите покинуть клуб?')) return;
    try {
      const success = await db.leaveClub(id, user.id);
      if (success) {
        const updatedMembers = await db.getClubMembers(id);
        setMembers(updatedMembers);
      }
    } catch (error) {
      console.error('Error leaving club:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !id || !newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const success = await db.sendClubMessage(id, user.id, newMessage.trim());
      if (success) {
        setNewMessage('');
        const updatedMessages = await db.getClubMessages(id);
        setMessages(updatedMessages);
      }
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!club) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 min-h-screen">
      <SEO title={`${club.name} - Клуб Сообщества`} description={club.description || ''} />
      
      <button 
        onClick={() => navigate('/social')}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-xs font-black uppercase tracking-widest">Назад к сообществу</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Club Info & Members */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-surface/30 rounded-3xl p-6 border border-white/5 backdrop-blur-md text-center">
            <img 
              src={club.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${club.name}`} 
              alt={club.name} 
              className="w-32 h-32 rounded-3xl mx-auto mb-6 object-cover shadow-2xl shadow-primary/20"
            />
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">{club.name}</h1>
            <p className="text-sm text-slate-400 mb-6">{club.description || 'Нет описания'}</p>
            
            <div className="flex flex-col gap-3">
              {isMember ? (
                <button 
                  onClick={handleLeave}
                  className="w-full py-4 bg-white/5 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-red-500/20 hover:text-red-500 transition-all border border-white/5 flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> Покинуть клуб
                </button>
              ) : (
                <button 
                  onClick={handleJoin}
                  disabled={isJoining}
                  className="w-full py-4 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-violet-600 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isJoining ? <Loader2 className="animate-spin" /> : <Plus className="w-4 h-4" />} Вступить в клуб
                </button>
              )}
              {isAdmin && (
                <button className="w-full py-4 bg-white/5 text-slate-400 text-xs font-black uppercase tracking-widest rounded-2xl hover:text-white transition-all border border-white/5 flex items-center justify-center gap-2">
                  <Settings className="w-4 h-4" /> Настройки
                </button>
              )}
            </div>
          </div>

          <div className="bg-surface/30 rounded-3xl p-6 border border-white/5 backdrop-blur-md">
            <h2 className="text-lg font-black text-white uppercase tracking-tighter mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Участники ({members.length})
            </h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {members.map(member => (
                <div key={member.userId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={member.user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.userId}`} alt={member.user?.name} className="w-8 h-8 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{member.user?.name}</div>
                      <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{member.role}</div>
                    </div>
                  </div>
                  {member.role === 'admin' && <Shield className="w-3 h-3 text-primary shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content: Chat */}
        <div className="lg:col-span-3 flex flex-col h-[700px] bg-surface/30 rounded-3xl border border-white/5 backdrop-blur-md overflow-hidden">
          <div className="p-6 border-bottom border-white/5 bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-black text-white uppercase tracking-tighter">Общий чат</h2>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest">Сообщений пока нет. Начните общение!</p>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex gap-4 ${msg.userId === user?.id ? 'flex-row-reverse' : ''}`}>
                  <img src={msg.user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.userId}`} alt={msg.user?.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                  <div className={`flex flex-col max-w-[70%] ${msg.userId === user?.id ? 'items-end' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">{msg.user?.name}</span>
                      <span className="text-[9px] text-slate-600 font-bold">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className={`p-4 rounded-2xl text-sm ${msg.userId === user?.id ? 'bg-primary text-white rounded-tr-none' : 'bg-white/5 text-slate-200 rounded-tl-none'}`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {isMember ? (
            <form onSubmit={handleSendMessage} className="p-6 bg-black/20 border-t border-white/5 flex gap-4">
              <input 
                type="text" 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Напишите сообщение..."
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-colors"
              />
              <button 
                type="submit" 
                disabled={!newMessage.trim() || isSending}
                className="px-8 bg-primary text-white rounded-2xl hover:bg-violet-600 transition-colors disabled:opacity-50 shadow-lg shadow-primary/20"
              >
                {isSending ? <Loader2 className="animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </form>
          ) : (
            <div className="p-8 bg-black/40 text-center border-t border-white/5">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Вступите в клуб, чтобы участвовать в чате</p>
              <button 
                onClick={handleJoin}
                className="px-8 py-3 bg-primary/20 text-primary border border-primary/30 rounded-xl hover:bg-primary hover:text-white transition-all font-black uppercase tracking-widest text-[10px]"
              >
                Вступить сейчас
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClubDetail;
