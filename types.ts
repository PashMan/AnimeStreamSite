
export interface Anime {
  id: string;
  title: string;
  originalName: string;
  image: string;
  cover?: string;
  rating: number;
  score?: number;
  year: number;
  type: 'TV Series' | 'Movie' | 'OVA' | 'ONA' | 'Special' | 'Music';
  genres: string[];
  episodes: number;
  episodesAired?: number;
  status: 'Ongoing' | 'Completed' | 'Upcoming' | 'released' | 'anons';
  description: string;
  studio: string;
  duration?: string;
}

// Added missing Episode interface to resolve import error in constants.ts
export interface Episode {
  id: string;
  number: number;
  title: string;
  duration: string;
  thumbnail: string;
  isFiller: boolean;
}

export interface User {
  id?: string;
  name: string;
  email: string;
  avatar: string;
  isPremium: boolean;
  premiumUntil?: string;
  bio?: string;
  watchedTime: string;
  episodesWatched: number;
  friends?: string[]; // array of user emails or IDs
  watchedAnimeIds?: string[];
}

export interface ForumTopic {
  id: string;
  title: string;
  content: string;
  author: {
    name: string;
    avatar: string;
    email: string;
  };
  createdAt: string;
  category: string;
  animeId?: string;
  views: number;
  repliesCount: number;
}

export interface ForumPost {
  id: string;
  topicId: string;
  content: string;
  author: {
    name: string;
    avatar: string;
    email: string;
  };
  createdAt: string;
}

export interface Comment {
  id: string;
  user: {
    name: string;
    avatar: string;
  };
  text: string;
  date: string;
}

export interface ChatMessage {
  id: string;
  user: {
    name: string;
    avatar: string;
    email: string;
  };
  text: string;
  timestamp: number;
}

export interface PrivateMessage {
  id: string;
  from: string; // email
  to: string; // email
  text: string;
  timestamp: number;
  isRead: boolean;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  date: string;
  category: string;
  html_body?: string;
  image?: string;
  /* Added video property for YouTube links/embeds */
  video?: string;
  linkedId?: number;
}

export interface ScheduleItem {
  day: string;
  animes: { id: string; time: string; title: string }[];
}