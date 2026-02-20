
export interface Anime {
  id: string;
  title: string;
  originalName: string;
  image: string;
  cover?: string;
  rating: number;
  year: number;
  type: 'TV Series' | 'Movie' | 'OVA' | 'ONA';
  genres: string[];
  episodes: number;
  episodesAired?: number;
  status: 'Ongoing' | 'Completed' | 'Upcoming';
  description: string;
  studio: string;
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
  name: string;
  email: string;
  avatar: string;
  isPremium: boolean;
  watchedTime: string;
  episodesWatched: number;
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
}

export interface ScheduleItem {
  day: string;
  animes: { id: string; time: string; title: string }[];
}