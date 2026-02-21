import { Anime, User, Comment, ChatMessage, PrivateMessage, ForumTopic, ForumPost } from '../types';

class LocalDatabaseService {
  private async request(url: string, method: string = 'GET', body?: any) {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      if (!res.ok) return null;
      return res.json();
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  // Auth
  async login(credentials: { email: string; password: string }): Promise<User | null> {
    return this.request('/api/auth/login', 'POST', credentials);
  }

  async register(data: { name: string; email: string; password: string }): Promise<User | null> {
    return this.request('/api/auth/register', 'POST', data);
  }

  async updateProfile(email: string, updates: Partial<User>): Promise<User | null> {
    return this.request('/api/auth/update', 'POST', { email, updates });
  }

  // Friends (Mock for now)
  async addFriend(myEmail: string, friendEmail: string) {
    // Implement friend logic on server if needed
  }

  // Favorites & Watched
  async getFavorites(email: string): Promise<string[]> {
    return (await this.request(`/api/user/${email}/favorites`)) || [];
  }

  async toggleFavorite(email: string, animeId: string): Promise<boolean> {
    const res = await this.request(`/api/user/${email}/favorites`, 'POST', { animeId });
    return res && res.includes(animeId);
  }

  async getWatched(email: string): Promise<string[]> {
    return (await this.request(`/api/user/${email}/watched`)) || [];
  }

  async toggleWatched(email: string, animeId: string): Promise<boolean> {
    const res = await this.request(`/api/user/${email}/watched`, 'POST', { animeId });
    return res && res.includes(animeId);
  }

  // History
  async addToHistory(email: string, anime: Anime, ep: number) {
    await this.request(`/api/user/${email}/history`, 'POST', { anime, episode: ep });
  }

  async getHistory(email: string): Promise<any[]> {
    return (await this.request(`/api/user/${email}/history`)) || [];
  }

  // Forum
  async getForumTopics(animeId?: string): Promise<ForumTopic[]> {
    let url = '/api/forum/topics';
    if (animeId) url += `?animeId=${animeId}`;
    return (await this.request(url)) || [];
  }

  async createForumTopic(topic: Omit<ForumTopic, 'id' | 'createdAt'>): Promise<ForumTopic | null> {
    return this.request('/api/forum/topics', 'POST', topic);
  }

  // Global Chat
  async getGlobalMessages(): Promise<ChatMessage[]> {
    return (await this.request('/api/chat/global')) || [];
  }

  async sendGlobalMessage(user: User, text: string): Promise<ChatMessage> {
    return this.request('/api/chat/global', 'POST', { 
      user: { name: user.name, avatar: user.avatar, email: user.email }, 
      text 
    });
  }

  // Private Messages (Mock for now)
  async getPrivateMessages(user1: string, user2: string): Promise<PrivateMessage[]> {
    return [];
  }

  async sendPrivateMessage(from: string, to: string, text: string): Promise<PrivateMessage> {
    return { id: 'mock', from, to, text, timestamp: Date.now(), isRead: false };
  }

  async getConversations(email: string): Promise<{email: string, name: string, avatar: string, lastText: string}[]> {
    return [];
  }

  // Comments (Mock for now)
  async getUserComments(targetId: string): Promise<Comment[]> {
    return [];
  }

  async addComment(targetId: string, user: User, text: string): Promise<Comment> {
    return { id: 'mock', user: { name: user.name, avatar: user.avatar }, text, date: new Date().toISOString() };
  }
}

export const db = new LocalDatabaseService();
