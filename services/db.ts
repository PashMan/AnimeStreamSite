import { createClient } from '@supabase/supabase-js';
import { Anime, User, Comment, ChatMessage, PrivateMessage, ForumTopic, ForumPost } from '../types';

// Use environment variables or fallback to a dummy URL to prevent crashes
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://ulumbarwutnsodmzxpst.supabase.co';
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'placeholder';

let supabaseClient: any = null;
console.log('Initializing Supabase with URL:', supabaseUrl);
console.log('Supabase Key present:', supabaseKey !== 'placeholder' && !!supabaseKey);

try {
  if (supabaseUrl && supabaseKey && supabaseKey !== 'placeholder') {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client created successfully');
  } else {
    console.warn('Supabase client NOT created: URL or Key is missing/placeholder');
  }
} catch (e) {
  console.error('Supabase initialization failed:', e);
}

class DatabaseService {
  private isSupabaseAvailable(): boolean {
    const available = supabaseClient !== null;
    if (!available) {
      console.warn('Database operation attempted but Supabase is not available');
    }
    return available;
  }

  // Auth
  async login(credentials: { email: string; password: string }): Promise<User | null> {
    if (!this.isSupabaseAvailable()) return null;
    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('email', credentials.email)
        .single();
      if (error) {
        console.error('Login error:', error.message);
        return null;
      }
      if (!data) return null;
      return this.mapProfileToUser(data);
    } catch (e) {
      console.error('Login exception:', e);
      return null;
    }
  }

  async register(data: { name: string; email: string; password: string }): Promise<User | null> {
    if (!this.isSupabaseAvailable()) return null;
    try {
      const { data: profile, error } = await supabaseClient
        .from('profiles')
        .insert([{
          name: data.name,
          email: data.email,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.name}`,
          is_premium: false,
          watched_time: "0ч 0м",
          episodes_watched: 0,
          bio: "",
          friends: [],
          watched_anime_ids: []
        }])
        .select()
        .single();
      
      if (error) {
        console.error('Registration error:', error.message);
        return null;
      }
      return this.mapProfileToUser(profile);
    } catch (e) {
      console.error('Registration exception:', e);
      return null;
    }
  }

  private mapProfileToUser(p: any): User {
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      avatar: p.avatar,
      isPremium: p.is_premium,
      premiumUntil: p.premium_until,
      bio: p.bio,
      watchedTime: p.watched_time,
      episodesWatched: p.episodes_watched,
      friends: p.friends || [],
      watchedAnimeIds: p.watched_anime_ids || []
    };
  }

  async updateProfile(email: string, updates: Partial<User>): Promise<User | null> {
    if (!this.isSupabaseAvailable()) return null;
    try {
      const mapped: any = {};
      if (updates.name) mapped.name = updates.name;
      if (updates.avatar) mapped.avatar = updates.avatar;
      if (updates.bio !== undefined) mapped.bio = updates.bio;
      if (updates.isPremium !== undefined) mapped.is_premium = updates.isPremium;
      if (updates.watchedAnimeIds) mapped.watched_anime_ids = updates.watchedAnimeIds;

      const { data, error } = await supabaseClient
        .from('profiles')
        .update(mapped)
        .eq('email', email)
        .select()
        .single();
      
      if (error || !data) return null;
      return this.mapProfileToUser(data);
    } catch (e) {
      return null;
    }
  }

  // Favorites
  async getFavorites(email: string): Promise<string[]> {
    if (!this.isSupabaseAvailable()) return [];
    try {
      const { data } = await supabaseClient.from('favorites').select('anime_id').eq('user_email', email);
      return data?.map((d: any) => d.anime_id) || [];
    } catch (e) {
      return [];
    }
  }

  async toggleFavorite(email: string, animeId: string): Promise<boolean> {
    if (!this.isSupabaseAvailable()) return false;
    const favs = await this.getFavorites(email);
    const exists = favs.includes(animeId);

    try {
      if (exists) {
        await supabaseClient.from('favorites').delete().eq('user_email', email).eq('anime_id', animeId);
      } else {
        await supabaseClient.from('favorites').insert([{ user_email: email, anime_id: animeId }]);
      }
      return !exists;
    } catch (e) {
      return exists;
    }
  }

  // Watched
  async getWatched(email: string): Promise<string[]> {
    if (!this.isSupabaseAvailable()) return [];
    try {
      const { data } = await supabaseClient.from('profiles').select('watched_anime_ids').eq('email', email).single();
      return data?.watched_anime_ids || [];
    } catch (e) {
      return [];
    }
  }

  async toggleWatched(email: string, animeId: string): Promise<boolean> {
    if (!this.isSupabaseAvailable()) return false;
    const watched = await this.getWatched(email);
    const exists = watched.includes(animeId);
    let newWatched = [...watched];
    if (exists) newWatched = newWatched.filter(id => id !== animeId);
    else newWatched.push(animeId);

    const updated = await this.updateProfile(email, { watchedAnimeIds: newWatched });
    return updated ? !exists : exists;
  }

  // Forum
  async getForumTopics(animeId?: string): Promise<ForumTopic[]> {
    if (!this.isSupabaseAvailable()) return [];
    try {
      let q = supabaseClient.from('forum_topics').select('*').order('created_at', { ascending: false });
      if (animeId) q = q.eq('anime_id', animeId);
      const { data } = await q;
      return data?.map((d: any) => ({
        id: d.id,
        title: d.title,
        author: d.author_email,
        createdAt: d.created_at,
        animeId: d.anime_id,
        content: d.content
      })) || [];
    } catch (e) {
      return [];
    }
  }

  async createForumTopic(topic: Omit<ForumTopic, 'id' | 'createdAt'>): Promise<ForumTopic | null> {
    if (!this.isSupabaseAvailable()) return null;
    try {
      const { data, error } = await supabaseClient.from('forum_topics').insert([{
        title: topic.title,
        author_email: topic.author,
        content: topic.content,
        anime_id: topic.animeId
      }]).select().single();
      
      if (error || !data) return null;
      return {
        id: data.id,
        title: data.title,
        author: data.author_email,
        createdAt: data.created_at,
        animeId: data.anime_id,
        content: data.content
      };
    } catch (e) {
      return null;
    }
  }

  // Global Chat
  async getGlobalMessages(): Promise<ChatMessage[]> {
    if (!this.isSupabaseAvailable()) return [];
    try {
      const { data } = await supabaseClient
        .from('global_messages')
        .select('*, profiles(name, avatar)')
        .order('created_at', { ascending: true })
        .limit(100);
      
      return data?.map((d: any) => ({
        id: d.id,
        user: { name: d.profiles.name, avatar: d.profiles.avatar, email: d.user_email },
        text: d.text,
        timestamp: new Date(d.created_at).getTime()
      })) || [];
    } catch (e) {
      return [];
    }
  }

  async sendGlobalMessage(user: User, text: string): Promise<ChatMessage> {
    if (!this.isSupabaseAvailable()) throw new Error('Database not available');
    try {
      const { data, error } = await supabaseClient
        .from('global_messages')
        .insert([{ user_email: user.email, text }])
        .select('*, profiles(name, avatar)')
        .single();
      
      if (error || !data) throw error;
      return {
        id: data.id,
        user: { name: data.profiles.name, avatar: data.profiles.avatar, email: data.user_email },
        text: data.text,
        timestamp: new Date(data.created_at).getTime()
      };
    } catch (e) {
      throw e;
    }
  }

  // Comments
  async getUserComments(targetId: string): Promise<Comment[]> {
    if (!this.isSupabaseAvailable()) return [];
    try {
      const { data } = await supabaseClient
        .from('comments')
        .select('*')
        .eq('target_id', targetId)
        .order('created_at', { ascending: false });
      
      return data?.map((d: any) => ({
        id: d.id,
        user: { name: d.user_name, avatar: d.user_avatar },
        text: d.text,
        date: new Date(d.created_at).toLocaleDateString('ru-RU')
      })) || [];
    } catch (e) {
      return [];
    }
  }

  async addComment(targetId: string, user: User, text: string): Promise<Comment> {
    if (!this.isSupabaseAvailable()) throw new Error('Database not available');
    try {
      const { data, error } = await supabaseClient
        .from('comments')
        .insert([{
          target_id: targetId,
          user_name: user.name,
          user_avatar: user.avatar,
          text
        }])
        .select()
        .single();
      
      if (error || !data) throw error;
      return {
        id: data.id,
        user: { name: data.user_name, avatar: data.user_avatar },
        text: data.text,
        date: new Date(data.created_at).toLocaleDateString('ru-RU')
      };
    } catch (e) {
      throw e;
    }
  }

  async requestUpscale(userId: string, animeName: string) {
    if (!this.isSupabaseAvailable()) return;
    try {
      await supabaseClient.from('premium_requests').insert([{ user_id: userId, anime_name: animeName, type: 'upscale' }]);
    } catch (e) {}
  }

  // History (Keep local as it's per-device usually, or move to DB if requested)
  async addToHistory(email: string, anime: Anime, ep: number) {
    const data = localStorage.getItem(`as_history_${email}`);
    let history = data ? JSON.parse(data) : [];
    history = history.filter((h: any) => h.animeId !== anime.id);
    history.unshift({ animeId: anime.id, title: anime.title, image: anime.image, episode: ep, date: new Date().toISOString() });
    localStorage.setItem(`as_history_${email}`, JSON.stringify(history.slice(0, 30)));
  }

  async getHistory(email: string): Promise<any[]> {
    const data = localStorage.getItem(`as_history_${email}`);
    return data ? JSON.parse(data) : [];
  }

  // Private Messages
  async getPrivateMessages(user1: string, user2: string): Promise<PrivateMessage[]> {
    if (!this.isSupabaseAvailable()) return [];
    try {
      const { data } = await supabaseClient
        .from('private_messages')
        .select('*')
        .or(`and(from_email.eq.${user1},to_email.eq.${user2}),and(from_email.eq.${user2},to_email.eq.${user1})`)
        .order('created_at', { ascending: true });
      
      return data?.map((d: any) => ({
        id: d.id,
        from: d.from_email,
        to: d.to_email,
        text: d.text,
        timestamp: new Date(d.created_at).getTime(),
        isRead: d.is_read
      })) || [];
    } catch (e) {
      return [];
    }
  }

  async sendPrivateMessage(from: string, to: string, text: string): Promise<PrivateMessage> {
    if (!this.isSupabaseAvailable()) throw new Error('Database not available');
    try {
      const { data, error } = await supabaseClient
        .from('private_messages')
        .insert([{ from_email: from, to_email: to, text, is_read: false }])
        .select()
        .single();
      
      if (error || !data) throw error;
      return {
        id: data.id,
        from: data.from_email,
        to: data.to_email,
        text: data.text,
        timestamp: new Date(data.created_at).getTime(),
        isRead: data.is_read
      };
    } catch (e) {
      throw e;
    }
  }

  async getConversations(email: string): Promise<{email: string, name: string, avatar: string, lastText: string}[]> {
    if (!this.isSupabaseAvailable()) return [];
    try {
      const { data: messages } = await supabaseClient
        .from('private_messages')
        .select('*')
        .or(`from_email.eq.${email},to_email.eq.${email}`)
        .order('created_at', { ascending: false });

      if (!messages) return [];

      const threadEmails = new Set<string>();
      messages.forEach((m: any) => {
        if (m.from_email === email) threadEmails.add(m.to_email);
        else threadEmails.add(m.from_email);
      });

      const results = await Promise.all(Array.from(threadEmails).map(async tEmail => {
        const { data: u } = await supabaseClient.from('profiles').select('name, avatar').eq('email', tEmail).single();
        const lastMsg = messages.find((m: any) => (m.from_email === email && m.to_email === tEmail) || (m.from_email === tEmail && m.to_email === email));
        return {
          email: tEmail,
          name: u?.name || 'Unknown',
          avatar: u?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${tEmail}`,
          lastText: lastMsg?.text || ''
        };
      }));

      return results;
    } catch (e) {
      return [];
    }
  }
}

export const db = new DatabaseService();
export const supabase = supabaseClient;
