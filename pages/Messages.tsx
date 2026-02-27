import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Send, ArrowLeft, MessageSquare, Loader2, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { PrivateMessage, User as UserType } from '../types';
import SEO from '../components/SEO';

const Messages: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const targetEmail = searchParams.get('user');
  
  const [conversations, setConversations] = useState<{email: string, name: string, avatar: string, lastText: string}[]>([]);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [targetUser, setTargetUser] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyLink = () => {
    const link = `${window.location.origin}/messages?user=${targetEmail}`;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(link).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations list
  useEffect(() => {
    if (user?.email) {
      loadConversations();
    }
  }, [user?.email]);

  // Load target user if selected
  useEffect(() => {
    const loadTarget = async () => {
      if (targetEmail && user?.email) {
        setIsLoading(true);
        try {
          const [profile, msgs] = await Promise.all([
            db.getProfile(targetEmail),
            db.getPrivateMessages(user.email, targetEmail)
          ]);
          
          if (profile) {
            setTargetUser(profile);
            setMessages(msgs);
            // Initial scroll to bottom
            setTimeout(() => {
              if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
              }
            }, 100);
          }
        } catch (error) {
          console.error('Failed to load chat target', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setTargetUser(null);
      }
    };
    loadTarget();
  }, [targetEmail, user?.email]);

  // Poll for new messages every 3 seconds if chat is open
  useEffect(() => {
    if (!targetUser || !user?.email) return;

    const interval = setInterval(() => {
      loadMessages(targetUser.email);
    }, 3000);

    return () => clearInterval(interval);
  }, [targetUser, user?.email]);

  const loadConversations = async () => {
    if (!user) return;
    const convs = await db.getConversations(user.email);
    setConversations(convs);
  };

  const loadMessages = async (email: string) => {
    if (!user) return;
    const msgs = await db.getPrivateMessages(user.email, email);
    
    // Only scroll if message count changed
    const hadMessages = messages.length > 0;
    const gotNewMessages = msgs.length > messages.length;
    
    setMessages(msgs);
    
    if (gotNewMessages || !hadMessages) {
      scrollToBottom();
    }
  };

  const scrollToBottom = () => {
    // Small timeout to ensure DOM is updated
    setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !targetUser) return;

    const text = newMessage;
    setNewMessage(''); // Optimistic clear

    try {
      await db.sendPrivateMessage(user.email, targetUser.email, text);
      loadMessages(targetUser.email);
      loadConversations(); // Update last message in sidebar
    } catch (error) {
      console.error('Failed to send message', error);
      setNewMessage(text); // Restore on error
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white pt-20">
        <div className="text-center">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p>Пожалуйста, войдите в аккаунт, чтобы пользоваться чатом.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark pt-24 pb-20 flex flex-col md:flex-row h-[calc(100vh-96px)] max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
      <SEO title="Сообщения - AnimeStream" />
      
      {/* Sidebar - Conversations List */}
      <div className={`w-full md:w-80 lg:w-96 bg-surface border border-white/5 rounded-2xl md:rounded-r-none flex flex-col overflow-hidden ${targetUser ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 border-b border-white/5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Сообщения
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Нет активных диалогов. Найдите друзей в <Link to="/social" className="text-primary hover:underline">Людях</Link>!
            </div>
          ) : (
            conversations.map(conv => (
              <Link 
                key={conv.email} 
                to={`/messages?user=${conv.email}`}
                className={`p-4 flex items-center gap-3 hover:bg-white/5 transition-colors border-b border-white/5 ${targetEmail === conv.email ? 'bg-white/5 border-l-2 border-l-primary' : ''}`}
              >
                <img src={conv.avatar} alt={conv.name} className="w-12 h-12 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-sm truncate">{conv.name}</div>
                  <div className="text-xs text-slate-400 truncate">{conv.lastText}</div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col bg-black/20 border border-white/5 border-l-0 rounded-2xl md:rounded-l-none overflow-hidden ${!targetUser ? 'hidden md:flex' : 'flex'}`}>
        {targetUser ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-surface border-b border-white/5 flex items-center gap-4">
              <Link to="/messages" className="md:hidden p-2 hover:bg-white/5 rounded-full text-white">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <img src={targetUser.avatar} alt={targetUser.name} className="w-10 h-10 rounded-full object-cover" />
              <div className="flex-1">
                <div className="font-bold text-white">{targetUser.name}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                   <span className="w-2 h-2 bg-green-500 rounded-full"></span> Онлайн
                </div>
              </div>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar flex flex-col">
              <div className="flex-1"></div> {/* Spacer to push messages down if few */}
              {messages.map(msg => {
                const isMe = msg.from === user.email;
                const renderText = (text: string) => {
                  const urlRegex = /(https?:\/\/[^\s]+)/g;
                  return text.split(urlRegex).map((part, i) => {
                    if (part.match(urlRegex)) {
                      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-white underline hover:text-white/80 break-all">{part}</a>;
                    }
                    return part;
                  });
                };
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3 ${isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-surface border border-white/10 text-slate-200 rounded-tl-none'}`}>
                      <p className="text-sm leading-relaxed break-words">{renderText(msg.text)}</p>
                      <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-white/70' : 'text-slate-500'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-1" />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-4 bg-surface border-t border-white/5 flex gap-4">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Напишите сообщение..."
                className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
              />
              <button 
                type="submit" 
                disabled={!newMessage.trim()}
                className="bg-primary hover:bg-primary/90 text-white p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <MessageSquare className="w-20 h-20 mb-6 opacity-10" />
            <p className="font-bold uppercase tracking-widest text-xs">Выберите чат или начните новый</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
