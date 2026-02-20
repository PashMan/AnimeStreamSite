
import React, { useState } from 'react';
import { X, Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Layout';

const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      if (mode === 'login') {
        const success = await login({ email: formData.email, password: formData.password });
        if (!success) setError('Неверный email или пароль');
      } else {
        if (!formData.name) {
          setError('Введите имя');
          setIsLoading(false);
          return;
        }
        const success = await register({ name: formData.name, email: formData.email, password: formData.password });
        if (!success) setError('Этот email уже зарегистрирован');
      }
    } catch (err) {
      setError('Произошла ошибка. Попробуйте позже.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={closeAuthModal} />
      <div className="relative w-full max-w-md glass border border-white/10 rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
        <button onClick={closeAuthModal} className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-8">
           <div className="inline-flex justify-center mb-4">
              <Logo />
           </div>
           <h2 className="text-xl font-bold text-white mb-2">{mode === 'login' ? 'С возвращением' : 'Регистрация'}</h2>
           <p className="text-sm text-slate-400">{mode === 'login' ? 'Войдите, чтобы продолжить просмотр.' : 'Присоединяйтесь к нам!'}</p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-xs text-center">{error}</div>}

        <div className="flex p-1 bg-surface rounded-xl mb-6">
           <button type="button" onClick={() => setMode('login')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'login' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Вход</button>
           <button type="button" onClick={() => setMode('register')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'register' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Регистрация</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
           {mode === 'register' && (
             <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Имя пользователя</label>
                <div className="relative">
                   <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                   <input required name="name" value={formData.name} onChange={handleChange} type="text" placeholder="Имя" className="w-full bg-surface/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-primary outline-none transition-all" />
                </div>
             </div>
           )}

           <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Email</label>
              <div className="relative">
                 <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                 <input required name="email" value={formData.email} onChange={handleChange} type="email" placeholder="email@mail.com" className="w-full bg-surface/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-primary outline-none transition-all" />
              </div>
           </div>
           
           <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Пароль</label>
              <div className="relative">
                 <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                 <input required name="password" value={formData.password} onChange={handleChange} type="password" placeholder="••••••••" className="w-full bg-surface/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-primary outline-none transition-all" />
              </div>
           </div>

           <button type="submit" disabled={isLoading} className="block w-full py-4 bg-primary hover:bg-violet-600 text-white font-black uppercase tracking-widest text-xs rounded-xl text-center shadow-lg shadow-primary/25 transition-all mt-4 disabled:opacity-70 disabled:cursor-not-allowed active:scale-95">
              {isLoading ? 'Загрузка...' : (mode === 'login' ? 'Войти' : 'Создать аккаунт')}
           </button>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;