import { createClient } from '@supabase/supabase-js';
import { Anime, User, Comment, ChatMessage, PrivateMessage, ForumTopic, ForumPost } from '../types';

// Use environment variables or fallback to the key you provided
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://ulumbarwutnsodmzxpst.supabase.co';
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsdW1iYXJ3dXRuc29kbXp4cHN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MDA5ODIsImV4cCI6MjA4NzI3Njk4Mn0.4HTww4JB9dcc9FcyONURPsdcu4CAdKzScsshAj3lJxs';

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
      // 1. Try Supabase Auth Login
      const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (authError) {
        console.error('Supabase Auth Login Error:', authError.message);
        return null;
      }

      if (!authData.user) return null;

      // 2. Fetch Profile
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('email', credentials.email)
        .single();
      
      if (error) {
        console.error('Profile fetch error:', error.message);
        // If profile doesn't exist but auth does, maybe create it? 
        // For now, return null or handle gracefully.
        return null;
      }
      
      return this.mapProfileToUser(data);
    } catch (e) {
      console.error('Login exception:', e);
      return null;
    }
  }

  // Auth Helpers
  async getSession() {
      return await supabaseClient.auth.getSession();
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
      return supabaseClient.auth.onAuthStateChange((event: string, session: any) => {
          callback(event, session);
      });
  }

  async getProfile(email: string): Promise<User | null> {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();
      
      if (error || !data) return null;
      return this.mapProfileToUser(data);
  }

  async getProfileById(id: string): Promise<User | null> {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error || !data) return null;
      return this.mapProfileToUser(data);
  }

  async getProfileByName(name: string): Promise<User | null> {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .ilike('name', name)
        .single();
      
      if (error || !data) return null;
      return this.mapProfileToUser(data);
  }

  private translateError(message: string): string {
    if (message.includes('User already registered')) return 'Пользователь с таким email уже зарегистрирован';
    if (message.includes('database error saving new user')) return 'Этот email уже занят или произошла ошибка базы данных';
    if (message.includes('Invalid login credentials')) return 'Неверный email или пароль';
    if (message.includes('Email not confirmed')) return 'Email не подтвержден';
    return message;
  }

  async register(data: { name: string; email: string; password: string }): Promise<{ user: User | null, message?: string }> {
    if (!this.isSupabaseAvailable()) return { user: null, message: 'База данных недоступна' };
    try {
      // Check if email already exists in profiles
      const existingProfile = await this.getProfile(data.email);
      if (existingProfile) {
        return { user: null, message: 'Пользователь с таким email уже зарегистрирован' };
      }

      // 1. Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.name}`
          }
        }
      });

      if (authError) {
        console.error('Supabase Auth Register Error:', authError.message);
        return { user: null, message: this.translateError(authError.message) };
      }

      if (authData.user && !authData.session) {
        // Email confirmation required
        return { user: null, message: 'Confirmation email sent' };
      }

      if (!authData.user) return { user: null, message: 'Registration failed' };

      // Wait a moment for trigger to create profile if session exists immediately
      await new Promise(resolve => setTimeout(resolve, 1000));

      const profile = await this.getProfile(data.email);
      return { user: profile };

    } catch (e) {
      console.error('Registration exception:', e);
      return { user: null, message: 'Exception occurred' };
    }
  }

  async logout() {
      if (this.isSupabaseAvailable()) {
          await supabaseClient.auth.signOut();
      }
  }

  async resetPassword(email: string): Promise<{ success: boolean; message?: string }> {
    if (!this.isSupabaseAvailable()) return { success: false, message: 'Database unavailable' };
    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) {
        return { success: false, message: error.message };
      }
      return { success: true, message: 'Check your email for the password reset link' };
    } catch (e) {
      console.error('Reset password exception:', e);
      return { success: false, message: 'Exception occurred' };
    }
  }

  private mapProfileToUser(p: any): User {
    let name = p.name;
    // If name looks like a UUID or is missing, use email prefix
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!name || uuidRegex.test(name)) {
      if (p.email && p.email.includes('@')) {
        name = p.email.split('@')[0];
      } else {
        name = 'Пользователь';
      }
    }

    return {
      id: p.id,
      name: name,
      email: p.email,
      avatar: p.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.email || p.id}`,
      isPremium: p.is_premium,
      premiumUntil: p.premium_until,
      bio: p.bio,
      watchedTime: p.watched_time,
      episodesWatched: p.episodes_watched,
      friends: p.friends || [],
      watchedAnimeIds: p.watched_anime_ids || [],
      profileBg: p.profile_bg,
      profileBanner: p.profile_banner,
      profileLayout: p.profile_layout as any,
      themeColor: p.theme_color,
      avatarShape: p.avatar_shape as any,
      cardOpacity: p.card_opacity,
      cardBlur: p.card_blur,
      lastSeen: p.last_seen
    };
  }

  async updateLastSeen(email: string) {
    if (!this.isSupabaseAvailable()) return;
    try {
      await supabaseClient
        .from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('email', email);
    } catch (e) {
      // Ignore errors for background updates
    }
  }

  async updateProfile(email: string, updates: Partial<User>): Promise<User | null> {
    if (!this.isSupabaseAvailable()) return null;
    try {
      const mapped: any = {};
      if (updates.name) {
        // Check uniqueness
        const { data: existing } = await supabaseClient
          .from('profiles')
          .select('id')
          .eq('name', updates.name)
          .neq('email', email) // Exclude self
          .single();
        
        if (existing) {
          throw new Error('Username already taken');
        }
        mapped.name = updates.name;
      }
      if (updates.avatar) mapped.avatar = updates.avatar;
      if (updates.bio !== undefined) mapped.bio = updates.bio;
      if (updates.isPremium !== undefined) mapped.is_premium = updates.isPremium;
      if (updates.watchedAnimeIds) mapped.watched_anime_ids = updates.watchedAnimeIds;
      if (updates.profileBg !== undefined) mapped.profile_bg = updates.profileBg;
      if (updates.profileBanner !== undefined) mapped.profile_banner = updates.profileBanner;
      if (updates.profileLayout !== undefined) mapped.profile_layout = updates.profileLayout;
      if (updates.themeColor !== undefined) mapped.theme_color = updates.themeColor;
      if (updates.avatarShape !== undefined) mapped.avatar_shape = updates.avatarShape;
      if (updates.cardOpacity !== undefined) mapped.card_opacity = updates.cardOpacity;
      if (updates.cardBlur !== undefined) mapped.card_blur = updates.cardBlur;
      if (updates.friends !== undefined) mapped.friends = updates.friends;

      // Try full update first
      let result = await supabaseClient
        .from('profiles')
        .update(mapped)
        .eq('email', email)
        .select()
        .single();
      
      // If error (likely missing column), try fallback to basic fields
      if (result.error) {
        console.warn('Full profile update failed, trying fallback:', result.error.message);
        
        const basicMapped: any = {};
        if (updates.name) basicMapped.name = updates.name;
        if (updates.avatar) basicMapped.avatar = updates.avatar;
        if (updates.bio !== undefined) basicMapped.bio = updates.bio;
        if (updates.friends !== undefined) basicMapped.friends = updates.friends;
        if (updates.watchedAnimeIds) basicMapped.watched_anime_ids = updates.watchedAnimeIds;

        result = await supabaseClient
          .from('profiles')
          .update(basicMapped)
          .eq('email', email)
          .select()
          .single();
      }
      
      const { data, error } = result;
      
      if (error) {
        console.error('Profile update error:', error);
        return null;
      }
      
      if (!data) return null;
      return this.mapProfileToUser(data);
    } catch (e) {
      if (e instanceof Error && e.message === 'Username already taken') {
          throw e;
      }
      return null;
    }
  }

  async uploadAvatar(file: File, userId: string): Promise<string | null> {
    if (!this.isSupabaseAvailable()) return null;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        console.warn('Storage upload failed (likely RLS), falling back to Base64:', uploadError.message);
        // Fallback to Base64
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });
      }

      const { data } = supabaseClient.storage
        .from('avatars')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (e) {
      console.error('Upload exception:', e);
      // Try Base64 fallback on exception too
      return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
      });
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
  async getForumTopics(animeId?: string, category?: string): Promise<ForumTopic[]> {
    if (!this.isSupabaseAvailable()) return [];
    try {
      let q = supabaseClient
        .from('forum_topics')
        .select('id, title, content, created_at, category, anime_id, views, replies_count, author_email, profiles(id, name, avatar, email)')
        .order('created_at', { ascending: false })
        .limit(20); // Reduced limit for performance
      
      if (animeId) q = q.eq('anime_id', animeId);
      if (category) q = q.eq('category', category);
      
      const { data } = await q;
      return data?.map((d: any) => ({
        id: d.id,
        title: d.title,
        content: d.content.length > 200 ? d.content.substring(0, 200) + '...' : d.content, // Truncate content for list view
        author: {
            id: d.profiles?.id,
            name: d.profiles?.name || 'Unknown',
            avatar: d.profiles?.avatar || '',
            email: d.profiles?.email || d.author_email
        },
        createdAt: d.created_at,
        category: d.category || 'General',
        animeId: d.anime_id,
        views: d.views || 0,
        repliesCount: d.replies_count || 0
      })) || [];
    } catch (e) {
      return [];
    }
  }

  async getForumTopic(id: string): Promise<ForumTopic | null> {
    if (!this.isSupabaseAvailable()) return null;
    try {
      const { data } = await supabaseClient
        .from('forum_topics')
        .select('*, profiles(name, avatar, email)')
        .eq('id', id)
        .maybeSingle();
        
      if (!data) return null;
      
      return {
        id: data.id,
        title: data.title,
        content: data.content,
        author: {
            name: data.profiles?.name || 'Unknown',
            avatar: data.profiles?.avatar || '',
            email: data.profiles?.email || data.author_email
        },
        createdAt: data.created_at,
        category: data.category || 'General',
        animeId: data.anime_id,
        views: (data.views || 0) + 1,
        repliesCount: data.replies_count || 0
      };
    } catch (e) {
      return null;
    }
  }

  async createForumTopic(topic: { id?: string, title: string, content: string, author: string, animeId?: string, category: string }): Promise<ForumTopic | null> {
    if (!this.isSupabaseAvailable()) return null;
    try {
      const payload: any = {
        title: topic.title,
        author_email: topic.author,
        content: topic.content,
        anime_id: topic.animeId,
        category: topic.category
      };
      if (topic.id) payload.id = topic.id;

      const { data, error } = await supabaseClient.from('forum_topics').insert([payload]).select('*, profiles(name, avatar, email)').single();
      
      if (error || !data) return null;
      return {
        id: data.id,
        title: data.title,
        content: data.content,
        author: {
            name: data.profiles?.name || 'Unknown',
            avatar: data.profiles?.avatar || '',
            email: data.profiles?.email || data.author_email
        },
        createdAt: data.created_at,
        category: data.category,
        animeId: data.anime_id,
        views: 0,
        repliesCount: 0
      };
    } catch (e) {
      return null;
    }
  }

  async getForumPosts(topicId: string): Promise<ForumPost[]> {
    if (!this.isSupabaseAvailable()) return [];
    try {
      const { data } = await supabaseClient
        .from('forum_posts')
        .select('*, profiles(id, name, avatar, email)')
        .eq('topic_id', topicId)
        .order('created_at', { ascending: true });
        
      return data?.map((d: any) => ({
        id: d.id,
        topicId: d.topic_id,
        parentId: d.parent_id,
        content: d.content,
        author: {
            id: d.profiles?.id,
            name: d.profiles?.name || 'Unknown',
            avatar: d.profiles?.avatar || '',
            email: d.profiles?.email || d.author_email
        },
        createdAt: d.created_at
      })) || [];
    } catch (e) {
      return [];
    }
  }

  async createForumPost(post: { topicId: string, content: string, author: string, parentId?: string }): Promise<ForumPost | null> {
    if (!this.isSupabaseAvailable()) return null;
    try {
      const payload: any = {
        topic_id: post.topicId,
        content: post.content,
        author_email: post.author
      };
      
      // Only add parent_id if it's provided
      if (post.parentId) {
        payload.parent_id = post.parentId;
      }

      // First, insert the post
      let { data, error } = await supabaseClient.from('forum_posts').insert([payload]).select().single();
      
      if (error) {
        // If error is about missing parent_id column, try without it
        if (error.message?.includes('parent_id') || error.code === 'PGRST204') {
          console.warn('parent_id column missing, falling back to top-level post');
          delete payload.parent_id;
          const retry = await supabaseClient.from('forum_posts').insert([payload]).select().single();
          data = retry.data;
          error = retry.error;
        }
      }
      
      if (error || !data) {
        console.error('Forum post insert error:', error);
        return null;
      }
      
      // Increment replies count asynchronously
      supabaseClient.rpc('increment_topic_replies', { topic_id: post.topicId }).then(() => {});

      // Fetch profile separately to be safe
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('name, avatar, email')
        .eq('email', post.author)
        .single();

      return {
        id: data.id,
        topicId: data.topic_id,
        parentId: data.parent_id,
        content: data.content,
        author: {
            name: profile?.name || 'Unknown',
            avatar: profile?.avatar || '',
            email: profile?.email || data.author_email
        },
        createdAt: data.created_at
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

  // Social & Friends
  // Fetches the most recently registered users
  async getRecentUsers(limit: number = 5): Promise<User[]> {
    if (!this.isSupabaseAvailable()) return [];
    try {
      const { data } = await supabaseClient
        .from('profiles')
        .select('id, name, email, avatar, bio, is_premium, episodes_watched, watched_time, created_at')
        .limit(limit); // Removed order to avoid full table scan on large tables
      
      return data?.map((p: any) => this.mapProfileToUser(p)) || [];
    } catch (e) {
      return [];
    }
  }

  async searchUsers(query: string): Promise<User[]> {
    if (!this.isSupabaseAvailable()) return [];
    try {
      const { data } = await supabaseClient
        .from('profiles')
        .select('id, name, email, avatar, bio, is_premium, episodes_watched, watched_time')
        .ilike('name', `%${query}%`)
        .limit(10);
      
      return data?.map((p: any) => this.mapProfileToUser(p)) || [];
    } catch (e) {
      return [];
    }
  }

  async getFriendsList(friendIdentifiers: string[]): Promise<User[]> {
    if (!this.isSupabaseAvailable() || !friendIdentifiers || friendIdentifiers.length === 0) return [];
    try {
      // Filter out any empty strings
      const ids = friendIdentifiers.filter(Boolean);
      if (ids.length === 0) return [];

      // Separate UUIDs and emails to avoid Postgres type mismatch errors
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const uuids = ids.filter(id => uuidRegex.test(id));
      const emails = ids.filter(id => id.includes('@'));

      const promises = [];

      if (uuids.length > 0) {
        promises.push(
          supabaseClient
            .from('profiles')
            .select('id, name, email, avatar, bio, is_premium, episodes_watched, watched_time')
            .in('id', uuids)
        );
      }

      if (emails.length > 0) {
        promises.push(
          supabaseClient
            .from('profiles')
            .select('id, name, email, avatar, bio, is_premium, episodes_watched, watched_time')
            .in('email', emails)
        );
      }

      if (promises.length === 0) return [];

      const results = await Promise.all(promises);
      
      const allData = results.flatMap(res => {
        if (res.error) {
          console.error('getFriendsList Supabase error:', res.error);
          return [];
        }
        return res.data || [];
      });

      // Remove duplicates just in case
      const uniqueData = Array.from(new Map(allData.map(item => [item.id, item])).values());
      
      return uniqueData.map((p: any) => this.mapProfileToUser(p));
    } catch (e) {
      console.error('getFriendsList error:', e);
      return [];
    }
  }

  async addFriend(userEmail: string, friendEmail: string): Promise<boolean> {
    if (!this.isSupabaseAvailable()) return false;
    try {
      // 1. Get current user's friends
      const user = await this.getProfile(userEmail);
      if (!user) return false;
      
      const currentFriends = user.friends || [];
      if (currentFriends.includes(friendEmail)) return true; // Already friends
      
      const newFriends = [...currentFriends, friendEmail];
      
      // 2. Update user's profile
      await this.updateProfile(userEmail, { friends: newFriends });
      
      // 3. Update friend's profile (mutual friendship)
      const friend = await this.getProfile(friendEmail);
      if (friend) {
          const friendFriends = friend.friends || [];
          if (!friendFriends.includes(userEmail)) {
              await this.updateProfile(friendEmail, { friends: [...friendFriends, userEmail] });
          }
      }
      
      return true;
    } catch (e) {
      return false;
    }
  }

  async removeFriend(userEmail: string, friendEmail: string): Promise<boolean> {
    if (!this.isSupabaseAvailable()) return false;
    try {
      const user = await this.getProfile(userEmail);
      if (!user) return false;
      
      const newFriends = (user.friends || []).filter(f => f !== friendEmail);
      await this.updateProfile(userEmail, { friends: newFriends });
      
      // Remove from friend's list too
      const friend = await this.getProfile(friendEmail);
      if (friend) {
          const friendFriends = (friend.friends || []).filter(f => f !== userEmail);
          await this.updateProfile(friendEmail, { friends: friendFriends });
      }
      
      return true;
    } catch (e) {
      return false;
    }
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
  async hasUnreadMessages(email: string): Promise<boolean> {
    if (!this.isSupabaseAvailable()) return false;
    try {
      const { count, error } = await supabaseClient
        .from('private_messages')
        .select('*', { count: 'exact', head: true })
        .eq('to_email', email)
        .eq('is_read', false);
      
      if (error) return false;
      return (count || 0) > 0;
    } catch (e) {
      return false;
    }
  }

  async markMessagesAsRead(userEmail: string, senderEmail: string): Promise<void> {
    if (!this.isSupabaseAvailable()) return;
    try {
      await supabaseClient
        .from('private_messages')
        .update({ is_read: true })
        .eq('to_email', userEmail)
        .eq('from_email', senderEmail)
        .eq('is_read', false);
    } catch (e) {
      console.error('Error marking messages as read:', e);
    }
  }

  async getPrivateMessages(user1: string, user2: string): Promise<PrivateMessage[]> {
    if (!this.isSupabaseAvailable()) return [];
    try {
      const { data } = await supabaseClient
        .from('private_messages')
        .select('*')
        .or(`and(from_email.eq.${user1},to_email.eq.${user2}),and(from_email.eq.${user2},to_email.eq.${user1})`)
        .order('created_at', { ascending: false })
        .limit(100); // Limit to last 100 messages for performance
      
      if (data && data.length > 0) {
          // Sort by created_at ascending for chat view
          data.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

          // Mark as read if user1 is the recipient
          const unreadIds = data.filter((m: any) => m.to_email === user1 && !m.is_read).map((m: any) => m.id);
          if (unreadIds.length > 0) {
              await supabaseClient.from('private_messages').update({ is_read: true }).in('id', unreadIds);
          }

          return data.map((d: any) => ({
            id: d.id,
            from: d.from_email,
            to: d.to_email,
            text: d.text,
            timestamp: new Date(d.created_at).getTime(),
            isRead: d.is_read
          }));
      }

      return [];
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

  async getConversations(email: string): Promise<{id: string, email: string, name: string, avatar: string, lastText: string, hasUnread: boolean}[]> {
    if (!this.isSupabaseAvailable()) return [];
    try {
      // Fetch only the last 100 messages to identify recent conversations
      const { data: messages } = await supabaseClient
        .from('private_messages')
        .select('*')
        .or(`from_email.eq.${email},to_email.eq.${email}`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!messages || messages.length === 0) return [];

      const threadEmails = new Set<string>();
      messages.forEach((m: any) => {
        if (m.from_email === email) threadEmails.add(m.to_email);
        else threadEmails.add(m.from_email);
      });

      const threadEmailsArray = Array.from(threadEmails);
      if (threadEmailsArray.length === 0) return [];

      // Fetch all profiles at once
      const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, email, name, avatar')
        .in('email', threadEmailsArray);

      const profileMap = new Map<string, any>(profiles?.map((p: any) => [p.email, p]) || []);

      const results = threadEmailsArray.map(tEmail => {
        const u = profileMap.get(tEmail);
        const lastMsg = messages.find((m: any) => (m.from_email === email && m.to_email === tEmail) || (m.from_email === tEmail && m.to_email === email));
        const hasUnread = messages.some((m: any) => m.from_email === tEmail && m.to_email === email && !m.is_read);
        
        let cleanText = lastMsg?.text || '';
        // Strip markdown
        cleanText = cleanText.replace(/(\*\*|__)(.*?)\1/g, '$2'); // Bold
        cleanText = cleanText.replace(/(\*|_)(.*?)\1/g, '$2'); // Italic
        cleanText = cleanText.replace(/~~(.*?)~~/g, '$1'); // Strikethrough
        cleanText = cleanText.replace(/`([^`]+)`/g, '$1'); // Code
        cleanText = cleanText.replace(/^> (.*$)/gm, '$1'); // Blockquote
        cleanText = cleanText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1'); // Link
        cleanText = cleanText.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '[Image]'); // Image

        return {
          id: (u as any)?.id || '',
          email: tEmail,
          name: (u as any)?.name || 'Unknown',
          avatar: (u as any)?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${tEmail}`,
          lastText: cleanText,
          hasUnread
        };
      });

      return results;
    } catch (e) {
      return [];
    }
  }
}

export const db = new DatabaseService();
export const supabase = supabaseClient;
