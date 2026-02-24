
import { Anime, ScheduleItem, NewsItem } from '../types';
import { MOCK_ANIME, SCHEDULE, MOCK_NEWS } from '../constants';

const BASE_API = '/api/shikimori';
const IMG_BASE_URL = 'https://shikimori.one';
const FETCH_TIMEOUT = 15000; // 15 seconds timeout

// Concurrency Limiter
class RequestQueue {
  private queue: (() => void)[] = [];
  private activeCount = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task = async () => {
        this.activeCount++;
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.activeCount--;
          this.next();
        }
      };

      if (this.activeCount < this.maxConcurrent) {
        task();
      } else {
        this.queue.push(task);
      }
    });
  }

  private next() {
    if (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      task?.();
    }
  }
}

const requestQueue = new RequestQueue(3);

// Cache configuration (Client-side secondary cache)
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes default cache
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

const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-');  // Replace multiple - with single -
};

const PLACEHOLDER_IMAGE = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 450' width='300' height='450'%3E%3Crect width='300' height='450' fill='%231a1a1a'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='24' font-weight='bold' fill='%23333'%3ENO IMAGE%3C/text%3E%3C/svg%3E`;

const proxyImage = (url: string | undefined | null) => {
  if (!url) return PLACEHOLDER_IMAGE;
  let cleanUrl = url.trim();
  
  // Check for known Shikimori 404/missing images
  if (cleanUrl.includes('missing_original') || cleanUrl.includes('none.png') || cleanUrl.includes('missing')) {
      return PLACEHOLDER_IMAGE; 
  }

  // Handle relative paths from Shikimori
  if (cleanUrl.startsWith('/')) {
    cleanUrl = `${IMG_BASE_URL}${cleanUrl}`;
  } else if (!cleanUrl.startsWith('http')) {
    cleanUrl = `${IMG_BASE_URL}/${cleanUrl}`;
  }
  
  return cleanUrl;
};

// ... (existing code)

const fetchApi = async (endpoint: string, retries = 2, ttl = CACHE_TTL) => {
  // 1. Check Client Cache
  const cached = requestCache.get(endpoint);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }

  // ... (rest of fetchApi)
  
        if (data) {
          requestCache.set(endpoint, { data, timestamp: Date.now() });
          return data;
        }
  // ...
};

export const mapAnime = (data: any): Anime => {
  if (!data) return {} as Anime;

  // Handle mock data structure pass-through
  if (data.id && data.title && data.description && (data.image || data.cover)) {
      return data as Anime;
  }
  
  const russian = data.russian || data.name || 'Без названия';
  
  let image = PLACEHOLDER_IMAGE;
  
  if (data.image) {
      if (typeof data.image === 'string') {
           // If string, check if it's valid
           if (!data.image.includes('missing')) image = proxyImage(data.image);
      } else {
          // Try to find a valid image in order of preference
          const candidates = [data.image.original, data.image.preview, data.image.x96];
          for (const img of candidates) {
              if (img && !img.includes('missing') && !img.includes('none.png')) {
                  image = proxyImage(img);
                  break;
              }
          }
      }
  }

  return {
    // ... (rest of mapAnime)
  };
};

export const fetchAnimes = async (params: Record<string, any> = {}): Promise<Anime[]> => {
  try {
    // ...
    const query = new URLSearchParams(cleanParams).toString();
    // Cache catalog for 10 minutes
    const data = await fetchApi(`/animes?${query}`, 2, 10 * 60 * 1000);
    
    if (!data) return MOCK_ANIME;
    return Array.isArray(data) ? data.map(mapAnime) : MOCK_ANIME;
  } catch (e) {
    return MOCK_ANIME;
  }
};

export const fetchAnimeDetails = async (id: string): Promise<Anime | null> => {
  try {
    // Cache details for 30 minutes
    const data = await fetchApi(`/animes/${id}`, 2, 30 * 60 * 1000);
    if (!data) {
        const mock = MOCK_ANIME.find(a => a.id === id);
        return mock || MOCK_ANIME[0];
    }
    
    let anime = mapAnime(data);

    // Fallback: If image is missing, try to fetch screenshots to find a cover
    if (anime.image === PLACEHOLDER_IMAGE) {
        try {
            const screenshots = await fetchApi(`/animes/${id}/screenshots`, 1, 60 * 60 * 1000);
            if (Array.isArray(screenshots) && screenshots.length > 0) {
                 const validScreen = screenshots.find((s: any) => s.original && !s.original.includes('missing'));
                 if (validScreen) {
                     anime.image = proxyImage(validScreen.original);
                     anime.cover = anime.image;
                 }
            }
        } catch (e) {
            console.warn('Failed to fetch fallback screenshots', e);
        }
    }

    return anime;
  } catch (e) {
    return MOCK_ANIME.find(a => a.id === id) || MOCK_ANIME[0];
  }
};

export const fetchAnimeScreenshots = async (id: string): Promise<string[]> => {
  try {
    const data = await fetchApi(`/animes/${id}/screenshots`, 1, 60 * 60 * 1000);
    return Array.isArray(data) ? data.map((s: any) => proxyImage(s.original)) : [];
  } catch (e) {
    return [];
  }
};

export const fetchRelatedAnimes = async (id: string): Promise<{ relation: string; anime: Anime }[]> => {
  try {
    const data = await fetchApi(`/animes/${id}/related`, 2, 60 * 60 * 1000);
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
    const data = await fetchApi(`/animes/${id}/similar`, 2, 60 * 60 * 1000);
    if (!data || !Array.isArray(data)) return MOCK_ANIME.slice(0, 4);
    return data.slice(0, 10).map(mapAnime);
  } catch (e) {
    return MOCK_ANIME.slice(0, 4);
  }
};

export const fetchCalendar = async (): Promise<ScheduleItem[]> => {
  try {
    const data = await fetchApi(`/calendar`, 2, 60 * 60 * 1000);
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
    
    const orderedDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    return orderedDays.map(day => ({ day, animes: daysMap[day] }));
  } catch (e) {
    return SCHEDULE;
  }
};

export const fetchNews = async (): Promise<NewsItem[]> => {
  try {
    // Cache news for 30 minutes to improve performance
    const data = await fetchApi(`/topics?forum=news&limit=12&linked_type=Anime`, 2, 30 * 60 * 1000);
    // ...
  } catch (e) {
    return MOCK_NEWS;
  }
};

export const fetchNewsDetails = async (id: string): Promise<NewsItem | null> => {
  try {
    const topic = await fetchApi(`/topics/${id}`);
    if (!topic) return MOCK_NEWS.find(n => n.id === id) || MOCK_NEWS[0];

    const html = topic.html_body || topic.body || '';
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
    const ytMatch = html.match(ytRegex);

    let videoId = ytMatch ? ytMatch[1] : undefined;

    if (!videoId && (topic.linked?.type === 'Anime' || topic.linked_type === 'Anime')) {
        const animeId = topic.linked?.id || topic.linked_id;
        if (animeId) {
            try {
                const videos = await fetchApi(`/animes/${animeId}/videos`);
                if (Array.isArray(videos)) {
                    const trailer = videos.find((v: any) => v.url && (v.url.includes('youtube.com') || v.url.includes('youtu.be')));
                    if (trailer) {
                        const vMatch = trailer.url.match(ytRegex);
                        if (vMatch) videoId = vMatch[1];
                    }
                }
            } catch (e) {}
        }
    }

    return {
      id: topic.id.toString(),
      title: topic.topic_title,
      summary: (topic.body || '').slice(0, 200).replace(/\[.*?\]/g, ''),
      date: new Date(topic.created_at).toLocaleDateString('ru-RU'),
      category: 'Новости',
      image: imgMatch ? imgMatch[1] : undefined,
      video: videoId,
      linkedId: topic.linked_id,
      html_body: processNewsHtml(html) // Apply HTML processing
    };
  } catch (e) {
    return MOCK_NEWS.find(n => n.id === id) || MOCK_NEWS[0];
  }
};
