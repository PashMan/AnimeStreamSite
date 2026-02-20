
import { Anime, ScheduleItem, NewsItem } from '../types';
import { MOCK_ANIME, SCHEDULE, MOCK_NEWS } from '../constants';

const BASE_API = 'https://shikimori.one/api';
const IMG_BASE_URL = 'https://shikimori.one';

// Cache configuration
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache
const requestCache = new Map<string, { data: any; timestamp: number }>();

export const GENRE_MAP: Record<string, number> = {
  'Экшен': 1, 'Приключения': 2, 'Машины': 3, 'Комедия': 4, 'Безумие': 5,
  'Демоны': 6, 'Мистика': 7, 'Драма': 8, 'Этти': 9, 'Фэнтези': 10,
  'Игры': 11, 'Романтика': 12, 'Исторический': 13, 'Ужасы': 14, 'Детское': 15,
  'Магия': 16, 'Боевые искусства': 17, 'Меха': 18, 'Музыка': 19, 'Пародия': 20,
  'Самураи': 21, 'Шоджо': 25, 'Шоунен': 27, 'Школа': 23, 'Фантастика': 24,
  'Космос': 29, 'Спорт': 30, 'Супер сила': 31, 'Вампиры': 32, 'Гарем': 35,
  'Повседневность': 36, 'Сверхъестественное': 37, 'Военное': 38, 'Полиция': 39,
  'Психологическое': 40, 'Триллер': 41, 'Сейнен': 42, 'Джосей': 43
};

const proxyImage = (url: string | undefined | null) => {
  if (!url) return 'https://via.placeholder.com/300x450?text=No+Image';
  let cleanUrl = url.trim();
  // Handle relative paths from Shikimori
  if (cleanUrl.startsWith('/')) {
    cleanUrl = `${IMG_BASE_URL}${cleanUrl}`;
  } else if (!cleanUrl.startsWith('http')) {
    cleanUrl = `${IMG_BASE_URL}/${cleanUrl}`;
  }
  
  // Use wsrv.nl for faster WebP delivery
  return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&output=webp&q=85`;
};

const processNewsHtml = (html: string | undefined): string => {
  if (!html) return '';
  
  // 1. Inject no-referrer to images to bypass hotlink protection (403 Forbidden)
  let processed = html.replace(
    /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi, 
    (match, p1, src, p2) => {
        if (match.toLowerCase().includes('referrerpolicy')) return match;
        return `<img ${p1}src="${src}" referrerpolicy="no-referrer"${p2}>`;
    }
  );

  // 2. Convert Shikimori video blocks to YouTube embeds
  processed = processed.replace(
    /<div class=["']video-block["'][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>.*?<\/a>[\s\S]*?<\/div>/gi,
    (match, url) => {
        const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
        const ytMatch = url.match(ytRegex);
        
        if (ytMatch && ytMatch[1]) {
            const videoId = ytMatch[1];
            return `<div class="aspect-video w-full rounded-2xl overflow-hidden my-4 shadow-lg border border-white/10"><iframe src="https://www.youtube.com/embed/${videoId}" class="w-full h-full" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
        }
        return match;
    }
  );

  return processed;
};

const fetchApi = async (endpoint: string) => {
  // 1. Check Cache
  const cached = requestCache.get(endpoint);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Use direct URL
  const url = `${BASE_API}${endpoint}`;

  try {
    const res = await fetch(url);
    
    if (!res.ok) {
        console.warn(`[Shikimori API] Request failed: ${url} (${res.status})`);
        throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    
    if (data) {
      requestCache.set(endpoint, { data, timestamp: Date.now() });
      return data;
    }
  } catch (e) {
    // console.error(`[Shikimori API] Error:`, e);
    // Return cached data if available even if expired
    if (cached) return cached.data;
    return null;
  }
  return null;
};

export const mapAnime = (data: any): Anime => {
  if (!data) return {} as Anime;

  // Handle mock data structure pass-through
  if (data.id && data.title && data.description && (data.image || data.cover)) {
      return data as Anime;
  }
  
  const russian = data.russian || data.name || 'Без названия';
  
  let image = 'https://via.placeholder.com/300x450?text=No+Image';
  if (data.image) {
      if (typeof data.image === 'string') {
          image = proxyImage(data.image);
      } else {
          const imgPath = data.image.original || data.image.preview || data.image.x96;
          if (imgPath) image = proxyImage(imgPath);
      }
  }

  return {
    id: data.id?.toString() || '',
    title: russian,
    originalName: data.name || '',
    image,
    cover: image,
    rating: data.score ? parseFloat(data.score) : 0,
    year: data.aired_on ? new Date(data.aired_on).getFullYear() : (data.released_on ? new Date(data.released_on).getFullYear() : 0),
    type: data.kind === 'movie' ? 'Movie' : (data.kind === 'ova' ? 'OVA' : (data.kind === 'ona' ? 'ONA' : 'TV Series')),
    genres: data.genres ? data.genres.map((g: any) => g.russian || g.name) : [],
    episodes: data.episodes || 0,
    episodesAired: data.episodes_aired || 0,
    status: data.status === 'anons' ? 'Upcoming' : (data.status === 'ongoing' ? 'Ongoing' : 'Completed'),
    description: (data.description || 'Описание отсутствует').replace(/\[.*?\]/g, '').trim(),
    studio: data.studios?.[0]?.name || 'Неизвестно'
  };
};

export const fetchAnimes = async (params: Record<string, any> = {}): Promise<Anime[]> => {
  try {
    const cleanParams: any = { limit: '20', order: 'popularity', censored: 'false' };
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        cleanParams[k] = k === 'genre' && GENRE_MAP[v] ? GENRE_MAP[v] : v;
      }
    });
    const query = new URLSearchParams(cleanParams).toString();
    const data = await fetchApi(`/animes?${query}`);
    
    if (!data) return MOCK_ANIME;
    return Array.isArray(data) ? data.map(mapAnime) : MOCK_ANIME;
  } catch (e) {
    return MOCK_ANIME;
  }
};

export const fetchAnimeDetails = async (id: string): Promise<Anime | null> => {
  try {
    const data = await fetchApi(`/animes/${id}`);
    if (!data) {
        const mock = MOCK_ANIME.find(a => a.id === id);
        return mock || MOCK_ANIME[0];
    }
    return mapAnime(data);
  } catch (e) {
    return MOCK_ANIME.find(a => a.id === id) || MOCK_ANIME[0];
  }
};

export const fetchAnimeScreenshots = async (id: string): Promise<string[]> => {
  try {
    const data = await fetchApi(`/animes/${id}/screenshots`);
    return Array.isArray(data) ? data.map((s: any) => proxyImage(s.original)) : [];
  } catch (e) {
    return [];
  }
};

export const fetchRelatedAnimes = async (id: string): Promise<{ relation: string; anime: Anime }[]> => {
  try {
    const data = await fetchApi(`/animes/${id}/related`);
    if (Array.isArray(data)) {
      return data
        .filter((item: any) => !!item.anime)
        .slice(0, 10)
        .map((item: any) => ({
          relation: item.relation_russian || item.relation || 'Связанное',
          anime: mapAnime(item.anime)
        }));
    }
    return [];
  } catch (e) {
    return [];
  }
};

export const fetchSimilarAnimes = async (id: string): Promise<Anime[]> => {
  try {
    const data = await fetchApi(`/animes/${id}/similar`);
    if (!data || !Array.isArray(data)) return MOCK_ANIME.slice(0, 4);
    return data.slice(0, 10).map(mapAnime);
  } catch (e) {
    return MOCK_ANIME.slice(0, 4);
  }
};

export const fetchCalendar = async (): Promise<ScheduleItem[]> => {
  try {
    const data = await fetchApi(`/calendar`);
    if (!data || !Array.isArray(data)) return SCHEDULE;

    const daysMap: Record<string, any[]> = { 'Пн': [], 'Вт': [], 'Ср': [], 'Чт': [], 'Пт': [], 'Сб': [], 'Вс': [] };
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    
    data.forEach(i => { 
    if (!i.next_episode_at || !i.anime) return;
    const d = new Date(i.next_episode_at);
    const name = dayNames[d.getDay()];
    if (daysMap[name]) {
        daysMap[name].push({ 
            id: i.anime.id.toString(), 
            time: d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), 
            title: i.anime.russian || i.anime.name 
        });
    }
    });
    return Object.entries(daysMap)
    .filter(([_, a]) => a.length > 0)
    .map(([day, animes]) => ({ day, animes }));
  } catch (e) {
    return SCHEDULE;
  }
};

export const fetchNews = async (): Promise<NewsItem[]> => {
  try {
    const data = await fetchApi(`/topics?forum=news&limit=12&linked_type=Anime`);
    if (!data || !Array.isArray(data)) return MOCK_NEWS;

    return data.map(topic => ({
      id: topic.id.toString(),
      title: topic.topic_title || 'Без названия',
      summary: (topic.body || '').slice(0, 150).replace(/\[.*?\]/g, '') + '...',
      date: new Date(topic.created_at).toLocaleDateString('ru-RU'),
      category: 'Новости',
      html_body: processNewsHtml(topic.html_body || topic.body) // Apply HTML processing
    }));
  } catch (e) {
    return MOCK_NEWS;
  }
};

export const fetchNewsDetails = async (id: string): Promise<NewsItem | null> => {
  try {
    const topic = await fetchApi(`/topics/${id}`);
    if (!topic) return MOCK_NEWS.find(n => n.id === id) || MOCK_NEWS[0];

    return {
      id: topic.id.toString(),
      title: topic.topic_title,
      summary: (topic.body || '').slice(0, 200).replace(/\[.*?\]/g, ''),
      date: new Date(topic.created_at).toLocaleDateString('ru-RU'),
      category: 'Новости',
      html_body: processNewsHtml(topic.html_body || topic.body) // Apply HTML processing
    };
  } catch (e) {
    return MOCK_NEWS.find(n => n.id === id) || MOCK_NEWS[0];
  }
};
