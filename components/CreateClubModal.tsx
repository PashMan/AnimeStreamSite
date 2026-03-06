import React, { useState } from 'react';
import { X, Plus, Loader2, Camera } from 'lucide-react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';

interface CreateClubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateClubModal: React.FC<CreateClubModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !name.trim()) return;

    setIsSubmitting(true);
    try {
      const success = await db.createClub({
        name: name.trim(),
        description: description.trim(),
        avatarUrl: avatarUrl.trim(),
        creatorId: user.id
      });
      if (success) {
        onSuccess();
        onClose();
        // Reset form
        setName('');
        setDescription('');
        setAvatarUrl('');
      }
    } catch (error) {
      console.error('Error creating club:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-surface border border-white/10 rounded-[2.5rem] w-full max-w-md overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Создать клуб</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="flex flex-col items-center gap-4 mb-4">
            <div className="relative group">
              <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-slate-600" />
                )}
              </div>
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-3xl cursor-pointer">
                <Plus className="w-6 h-6 text-white" />
              </div>
            </div>
            <input 
              type="text" 
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="URL аватарки клуба"
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:border-primary outline-none transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Название клуба</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Любители ретро-аниме"
              className="w-full bg-black/20 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-colors"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Описание</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="О чем этот клуб?"
              rows={3}
              className="w-full bg-black/20 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-colors resize-none"
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting || !name.trim()}
            className="w-full py-4 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-violet-600 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : 'Создать клуб'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateClubModal;
