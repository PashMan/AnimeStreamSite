
import { Anime, User, Comment, ChatMessage, PrivateMessage } from '../types';

class RemoteDatabaseService {
  private getLocal(key: string) { return JSON.parse(localStorage.getItem(key) || '[]'); }
  private setLocal(key: string, data: any) { localStorage.setItem(key, JSON.stringify(data)); }

  async login(credentials: { email: string; password: string }): Promise<User | null> {
    const users = this.getLocal('as_users');
    const found = users.find((u: any) => u.email === credentials.email && u.password === credentials.password);
    if (!found) return null;
    const { password, ...user } = found;
    return user;
  }

  async register(data: { name: string; email: string; password: string }): Promise<User | null> {
    const users = this.getLocal('as_users');
    if (users.find((u: any) => u.email === data.email)) return null;
    const newUser: User = {
      name: data.name,
      email: data.email,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.name}`,
      isPremium: false,
      watchedTime: "0ч 0м",
      episodesWatched: 0
    };
    users.push({ ...newUser, password: data.password });
    this.setLocal('as_users', users);
    return newUser;
  }

  // Favorites
  async getFavorites(email: string): Promise<string[]> {
    const favs = this.getLocal(`favs_${email}`);
    return Array.isArray(favs) ? favs : [];
  }

  async toggleFavorite(email: string, animeId: string): Promise<boolean> {
    let favs = await this.getFavorites(email);
    const idx = favs.indexOf(animeId);
    if (idx > -1) favs.splice(idx, 1);
    else favs.push(animeId);
    this.setLocal(`favs_${email}`, favs);
    return idx === -1;
  }

  // Watched List
  async getWatched(email: string): Promise<string[]> {
    const watched = this.getLocal(`watched_${email}`);
    return Array.isArray(watched) ? watched : [];
  }

  async toggleWatched(email: string, animeId: string): Promise<boolean> {
    let watched = await this.getWatched(email);
    const idx = watched.indexOf(animeId);
    if (idx > -1) watched.splice(idx, 1);
    else watched.push(animeId);
    this.setLocal(`watched_${email}`, watched);
    return idx === -1;
  }

  // History
  async addToHistory(email: string, anime: Anime, ep: number) {
    let history = this.getLocal(`hist_${email}`);
    history = history.filter((h: any) => h.animeId !== anime.id);
    history.unshift({ animeId: anime.id, title: anime.title, image: anime.image, episode: ep, date: new Date().toISOString() });
    this.setLocal(`hist_${email}`, history.slice(0, 30));
  }

  async getHistory(email: string): Promise<any[]> {
    return this.getLocal(`hist_${email}`);
  }

  // Global Chat
  async getGlobalMessages(): Promise<ChatMessage[]> {
    return this.getLocal('global_chat').slice(-100);
  }

  async sendGlobalMessage(user: User, text: string): Promise<ChatMessage> {
    const messages = this.getLocal('global_chat');
    const msg: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      user: { name: user.name, avatar: user.avatar, email: user.email },
      text,
      timestamp: Date.now()
    };
    messages.push(msg);
    this.setLocal('global_chat', messages.slice(-200));
    return msg;
  }

  // Private Messages
  async getPrivateMessages(user1: string, user2: string): Promise<PrivateMessage[]> {
    const all = this.getLocal('private_messages') as PrivateMessage[];
    return all.filter(m => (m.from === user1 && m.to === user2) || (m.from === user2 && m.to === user1))
              .sort((a, b) => a.timestamp - b.timestamp);
  }

  async sendPrivateMessage(from: string, to: string, text: string): Promise<PrivateMessage> {
    const all = this.getLocal('private_messages');
    const msg: PrivateMessage = {
      id: Math.random().toString(36).substr(2, 9),
      from, to, text,
      timestamp: Date.now(),
      isRead: false
    };
    all.push(msg);
    this.setLocal('private_messages', all);
    return msg;
  }

  async getConversations(email: string): Promise<{email: string, name: string, avatar: string, lastText: string}[]> {
    const all = this.getLocal('private_messages') as PrivateMessage[];
    const users = this.getLocal('as_users');
    const threadEmails = new Set<string>();
    
    all.forEach(m => {
      if (m.from === email) threadEmails.add(m.to);
      if (m.to === email) threadEmails.add(m.from);
    });

    return Array.from(threadEmails).map(tEmail => {
      const u = users.find((x: any) => x.email === tEmail);
      const lastMsg = all.filter(m => (m.from === email && m.to === tEmail) || (m.from === tEmail && m.to === email))
                        .sort((a, b) => b.timestamp - a.timestamp)[0];
      return {
        email: tEmail,
        name: u?.name || 'Unknown',
        avatar: u?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${tEmail}`,
        lastText: lastMsg?.text || ''
      };
    });
  }

  // Comments
  async getUserComments(targetId: string): Promise<Comment[]> {
    return this.getLocal(`comments_${targetId}`);
  }

  async addComment(targetId: string, user: User, text: string): Promise<Comment> {
    const comments = this.getLocal(`comments_${targetId}`);
    const newComment: Comment = {
      id: Date.now().toString(),
      user: { name: user.name, avatar: user.avatar },
      text,
      date: new Date().toLocaleDateString('ru-RU')
    };
    comments.unshift(newComment);
    this.setLocal(`comments_${targetId}`, comments);
    return newComment;
  }
}

export const db = new RemoteDatabaseService();