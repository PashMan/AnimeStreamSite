import React, { useState } from 'react';
import { Crown, Sparkles, CheckCircle, Send, Shield, Zap, Star, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';

const Premium: React.FC = () => {
  const { user, openAuthModal, updateProfile } = useAuth();
  const [upscaleAnime, setUpscaleAnime] = useState('');
  const [isUpscaleSent, setIsUpscaleSent] = useState(false);
  const [isBuying, setIsBuying] = useState(false);

  const handleBuyPremium = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    setIsBuying(true);
    // Simulate payment process
    setTimeout(async () => {
      await updateProfile({ isPremium: true });
      setIsBuying(false);
    }, 1500);
  };

  const handleUpscaleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.isPremium) return;
    if (!upscaleAnime.trim()) return;
    
    const res = await fetch('/api/premium/upscale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id || user.email, animeName: upscaleAnime })
    });
    
    if (res.ok) {
      setIsUpscaleSent(true);
      setUpscaleAnime('');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-16 space-y-4">
        <div className="inline-flex items-center justify-center p-4 bg-yellow-500/10 rounded-full mb-4">
          <Crown className="w-12 h-12 text-yellow-500" />
        </div>
        <h1 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter">
          AnimeStream <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">Premium</span>
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto font-medium text-lg">
          Откройте новые возможности и поддержите проект. Получите доступ к эксклюзивным функциям и максимальному качеству.
        </p>
      </div>

      {!user?.isPremium ? (
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 mb-20">
          <div className="bg-surface/30 border border-white/5 rounded-[3rem] p-10 shadow-2xl backdrop-blur-sm">
            <h3 className="text-2xl font-black text-white uppercase mb-8">Базовый</h3>
            <ul className="space-y-6 mb-10">
              <li className="flex items-center gap-4 text-slate-300"><CheckCircle className="w-6 h-6 text-primary" /> Просмотр в 1080p</li>
              <li className="flex items-center gap-4 text-slate-300"><CheckCircle className="w-6 h-6 text-primary" /> Совместный просмотр</li>
              <li className="flex items-center gap-4 text-slate-300"><CheckCircle className="w-6 h-6 text-primary" /> Общение на форуме</li>
              <li className="flex items-center gap-4 text-slate-500"><XCircle className="w-6 h-6" /> Заказ апскейла до 4K</li>
              <li className="flex items-center gap-4 text-slate-500"><XCircle className="w-6 h-6" /> Выделение в чате</li>
            </ul>
            <div className="text-3xl font-black text-white mb-6">Бесплатно</div>
            <button disabled className="w-full py-4 bg-white/5 text-slate-400 font-black rounded-2xl uppercase tracking-widest text-xs">Текущий план</button>
          </div>

          <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-[3rem] p-10 shadow-2xl backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
            <div className="absolute top-6 right-6 px-4 py-1 bg-yellow-500 text-black font-black text-[10px] uppercase tracking-widest rounded-full">Хит</div>
            <h3 className="text-2xl font-black text-yellow-500 uppercase mb-8">Premium</h3>
            <ul className="space-y-6 mb-10 relative z-10">
              <li className="flex items-center gap-4 text-white"><CheckCircle className="w-6 h-6 text-yellow-500" /> Всё из базового плана</li>
              <li className="flex items-center gap-4 text-white"><CheckCircle className="w-6 h-6 text-yellow-500" /> Заказ апскейла любого аниме до 4K</li>
              <li className="flex items-center gap-4 text-white"><CheckCircle className="w-6 h-6 text-yellow-500" /> Уникальный значок в профиле</li>
              <li className="flex items-center gap-4 text-white"><CheckCircle className="w-6 h-6 text-yellow-500" /> Выделение сообщений в чате</li>
              <li className="flex items-center gap-4 text-white"><CheckCircle className="w-6 h-6 text-yellow-500" /> Приоритетная поддержка</li>
            </ul>
            <div className="text-3xl font-black text-white mb-6">199 ₽ <span className="text-sm text-slate-400 font-medium">/ мес</span></div>
            <button 
              onClick={handleBuyPremium}
              disabled={isBuying}
              className="w-full py-4 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-black font-black rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-yellow-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isBuying ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Crown className="w-4 h-4" /> Оформить подписку</>}
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto mb-20">
          <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-[3rem] p-10 shadow-2xl backdrop-blur-sm text-center">
            <Crown className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
            <h2 className="text-3xl font-black text-white uppercase mb-4">Вы Premium пользователь!</h2>
            <p className="text-yellow-200/70 mb-8">Спасибо за поддержку проекта. Все эксклюзивные функции активированы.</p>
            
            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div className="bg-black/20 p-6 rounded-2xl border border-white/5">
                <Sparkles className="w-8 h-8 text-yellow-500 mb-4" />
                <h4 className="text-white font-bold mb-2">Апскейл 4K</h4>
                <p className="text-xs text-slate-400">Заказывайте улучшение качества для любимых тайтлов.</p>
              </div>
              <div className="bg-black/20 p-6 rounded-2xl border border-white/5">
                <Star className="w-8 h-8 text-yellow-500 mb-4" />
                <h4 className="text-white font-bold mb-2">Выделение в чате</h4>
                <p className="text-xs text-slate-400">Ваши сообщения теперь заметнее для всех.</p>
              </div>
              <div className="bg-black/20 p-6 rounded-2xl border border-white/5">
                <Shield className="w-8 h-8 text-yellow-500 mb-4" />
                <h4 className="text-white font-bold mb-2">Значок профиля</h4>
                <p className="text-xs text-slate-400">Эксклюзивная корона в вашем личном кабинете.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {user?.isPremium && (
        <section className="max-w-4xl mx-auto bg-gradient-to-br from-primary/20 to-accent/20 rounded-[3rem] border border-primary/20 p-10 shadow-2xl backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-primary/20 transition-all duration-1000"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="space-y-4 max-w-xl">
              <div className="flex items-center gap-3 text-primary">
                <Zap className="w-8 h-8 fill-current" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Premium Privilege</span>
              </div>
              <h3 className="text-3xl md:text-4xl font-display font-black text-white uppercase tracking-tighter leading-none">Заказать апскейл до 4K</h3>
              <p className="text-slate-400 font-medium leading-relaxed">
                Как премиум-пользователь, вы можете выбрать одно аниме, которое мы обработаем с помощью ИИ и добавим в качестве 4K.
              </p>
            </div>
            
            {isUpscaleSent ? (
              <div className="bg-white/5 border border-white/10 p-8 rounded-3xl flex flex-col items-center gap-4 animate-in zoom-in-95 duration-500">
                <Sparkles className="w-12 h-12 text-yellow-400" />
                <p className="font-black uppercase tracking-widest text-xs text-white">Заявка принята!</p>
              </div>
            ) : (
              <form onSubmit={handleUpscaleRequest} className="w-full md:w-auto flex flex-col sm:flex-row gap-4">
                <input 
                  type="text" 
                  value={upscaleAnime}
                  onChange={e => setUpscaleAnime(e.target.value)}
                  placeholder="Название аниме..."
                  className="h-16 px-8 bg-black/40 border border-white/10 rounded-2xl text-white placeholder-slate-600 focus:border-primary outline-none min-w-[300px] transition-all"
                />
                <button type="submit" className="h-16 px-10 bg-primary hover:bg-violet-600 text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-primary/20 uppercase text-[10px] tracking-widest">
                  Отправить <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

// Simple XCircle component since we didn't import it
const XCircle = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="15" y1="9" x2="9" y2="15"></line>
    <line x1="9" y1="9" x2="15" y2="15"></line>
  </svg>
);

export default Premium;
