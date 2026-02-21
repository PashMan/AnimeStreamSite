import { createClient } from '@supabase/supabase-js';
import { Anime, User, Comment, ChatMessage, PrivateMessage, ForumTopic, ForumPost } from '../types';

const supabaseUrl = 'https://tx3sdmc9np539dimkirn.supabase.co';
const supabaseKey = 'sb_publishable_TX3SDmc9nP539dImkiRNvw_KL2qlYKn';
export const supabase = createClient(supabaseUrl, supabaseKey);

class SupabaseDatabaseService {
  // Auth
  async login(credentials: { email: string; password: string }): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', credentials.email)
        .single();
      
      if (error || !data) return null;
      // In this demo, we assume password matches if user exists for simplicity 
      // or you'd check a password field if you added one.
      return this.mapProfileToUser(data);
    } catch (e) {
      return null;
    }
  }

  async register(data: { name: string; email: string; password: string }): Promise<User | null> {
    try {
      // Check if exists
      const { data: existing } = await supabase.from('profiles').select('email').eq('email', data.email).single();
      if (existing) return null;

      const newUser = {
        name: data.name,
        email: data.email,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.name}`,
        is_premium: false,
        watched_time: "0ч 0м",
        episodes_watched: 0,
        bio: "",
        friends: [],
        watched_anime_ids: []
      };

      const { data: profile, error } = await supabase
        .from('profiles')
        .insert([newUser])
        .select()
        .single();

      if (error) return null;
      return this.mapProfileToUser(profile);
    } catch (e) {
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
    const mappedUpdates: any = {};
    if (updates.name) mappedUpdates.name = updates.name;
    if (updates.avatar) mappedUpdates.avatar = updates.avatar;
    if (updates.bio !== undefined) mappedUpdates.bio = updates.bio;
    if (updates.isPremium !== undefined) mappedUpdates.is_premium = updates.isPremium;

    const { data, error } = await supabase
      .from('profiles')
      .update(mappedUpdates)
      .eq('email', email)
      .select()
      .single();

    if (error) return null;
    return this.mapProfileToUser(data);
  }

  // Favorites & Watched
  async getFavorites(email: string): Promise<string[]> {
    const { data } = await supabase.from('favorites').select('anime_id').eq('user_email', email);
    return data?.map(d => d.anime_id) || [];
  }

  async toggleFavorite(email: string, animeId: string): Promise<boolean> {
    const favs = await this.getFavorites(email);
    const exists = favs.includes(animeId);
    if (exists) {
      await supabase.from('favorites').delete().eq('user_email', email).eq('anime_id', animeId);
    } else {
      await supabase.from('favorites').insert([{ user_email: email, anime_id: animeId }]);
    }
    return !exists;
  }

  async getWatched(email: string): Promise<string[]> {
    const { data } = await supabase.from('profiles').select('watched_anime_ids').eq('email', email).single();
    return data?.watched_anime_ids || [];
  }

  async toggleWatched(email: string, animeId: string): Promise<boolean> {
    const watched = await this.getWatched(email);
    const idx = watched.indexOf(animeId);
    let newWatched = [...watched];
    if (idx > -1) newWatched.splice(idx, 1);
    else newWatched.push(animeId);
    
    await supabase.from('profiles').update({ watched_anime_ids: newWatched }).eq('email', email);
    return idx === -1;
  }

  // History
  async addToHistory(email: string, anime: Anime, ep: number) {
    const { data: profile } = await supabase.from('profiles').select('history').eq('email', email).single();
    let history = profile?.history || [];
    history = history.filter((h: any) => h.animeId !== anime.id);
    history.unshift({ animeId: anime.id, title: anime.title, image: anime.image, episode: ep, date: new Date().toISOString() });
    await supabase.from('profiles').update({ history: history.slice(0, 30) }).eq('email', email);
  }

  async getHistory(email: string): Promise<any[]> {
    const { data } = await supabase.from('profiles').select('history').eq('email', email).single();
    return data?.history || [];
  }

  // Forum
  async getForumTopics(animeId?: string): Promise<ForumTopic[]> {
    let query = supabase.from('forum_topics').select('*').order('created_at', { ascending: false });
    if (animeId) query = query.eq('anime_id', animeId);
    const { data } = await query;
    return data?.map(d => ({
      id: d.id,
      title: d.title,
      author: d.author_email,
      createdAt: d.created_at,
      animeId: d.anime_id,
      content: d.content
    })) || [];
  }

  async createForumTopic(topic: Omit<ForumTopic, 'id' | 'createdAt'>): Promise<ForumTopic | null> {
    const { data, error } = await supabase
      .from('forum_topics')
      .insert([{
        title: topic.title,
        author_email: topic.author,
        content: topic.content,
        anime_id: topic.animeId
      }])
      .select()
      .single();
    
    if (error) return null;
    return {
      id: data.id,
      title: data.title,
      author: data.author_email,
      createdAt: data.created_at,
      animeId: data.anime_id,
      content: data.content
    };
  }

  // Global Chat
  async getGlobalMessages(): Promise<ChatMessage[]> {
    const { data } = await supabase.from('global_messages').select('*, profiles(name, avatar)').order('created_at', { ascending: true }).limit(100);
    return data?.map(d => ({
      id: d.id,
      user: { name: d.profiles.name, avatar: d.profiles.avatar, email: d.user_email },
      text: d.text,
      timestamp: new Date(d.created_at).getTime()
    })) || [];
  }

  async sendGlobalMessage(user: User, text: string): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from('global_messages')
      .insert([{ user_email: user.email, text }])
      .select('*, profiles(name, avatar)')
      .single();
    
    if (error) throw error;
    return {
      id: data.id,
      user: { name: data.profiles.name, avatar: data.profiles.avatar, email: data.user_email },
      text: data.text,
      timestamp: new Date(data.created_at).getTime()
    };
  }

  // Private Messages
  async getPrivateMessages(user1: string, user2: string): Promise<PrivateMessage[]> {
    const { data } = await supabase
      .from('private_messages')
      .select('*')
      .or(`and(from_email.eq.${user1},to_email.eq.${user2}),and(from_email.eq.${user2},to_email.eq.${user1})`)
      .order('created_at', { ascending: true });
    
    return data?.map(d => ({
      id: d.id,
      from: d.from_email,
      to: d.to_email,
      text: d.text,
      timestamp: new Date(d.created_at).getTime(),
      isRead: d.is_read
    })) || [];
  }

  async sendPrivateMessage(from: string, to: string, text: string): Promise<PrivateMessage> {
    const { data, error } = await supabase
      .from('private_messages')
      .insert([{ from_email: from, to_email: to, text, is_read: false }])
      .select()
      .single();
    
    if (error) throw error;
    return {
      id: data.id,
      from: data.from_email,
      to: data.to_email,
      text: data.text,
      timestamp: new Date(data.created_at).getTime(),
      isRead: data.is_read
    };
  }

  async getConversations(email: string): Promise<{email: string, name: string, avatar: string, lastText: string}[]> {
    const { data: messages } = await supabase
      .from('private_messages')
      .select('*')
      .or(`from_email.eq.${email},to_email.eq.${email}`)
      .order('created_at', { ascending: false });

    if (!messages) return [];

    const threadEmails = new Set<string>();
    messages.forEach(m => {
      if (m.from_email === email) threadEmails.add(m.to_email);
      else threadEmails.add(m.from_email);
    });

    const results = await Promise.all(Array.from(threadEmails).map(async tEmail => {
      const { data: u } = await supabase.from('profiles').select('name, avatar').eq('email', tEmail).single();
      const lastMsg = messages.find(m => (m.from_email === email && m.to_email === tEmail) || (m.from_email === tEmail && m.to_email === email));
      return {
        email: tEmail,
        name: u?.name || 'Unknown',
        avatar: u?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${tEmail}`,
        lastText: lastMsg?.text || ''
      };
    }));

    return results;
  }

  // Comments
  async getUserComments(targetId: string): Promise<Comment[]> {
    const { data } = await supabase.from('comments').select('*').eq('target_id', targetId).order('created_at', { ascending: false });
    return data?.map(d => ({
      id: d.id,
      user: { name: d.user_name, avatar: d.user_avatar },
      text: d.text,
      date: new Date(d.created_at).toLocaleDateString('ru-RU')
    })) || [];
  }

  async addComment(targetId: string, user: User, text: string): Promise<Comment> {
    const { data, error } = await supabase
      .from('comments')
      .insert([{
        target_id: targetId,
        user_name: user.name,
        user_avatar: user.avatar,
        text
      }])
      .select()
      .single();
    
    if (error) throw error;
    return {
      id: data.id,
      user: { name: data.user_name, avatar: data.user_avatar },
      text: data.text,
      date: new Date(data.created_at).toLocaleDateString('ru-RU')
    };
  }

  // Premium Upscale Request
  async requestUpscale(userId: string, animeName: string) {
    await supabase.from('premium_requests').insert([{ user_id: userId, anime_name: animeName, type: 'upscale' }]);
  }
}

export const db = new SupabaseDatabaseService();
