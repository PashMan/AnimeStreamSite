
import { Anime, ScheduleItem, NewsItem } from '../types';
import { MOCK_ANIME, SCHEDULE, MOCK_NEWS, FALLBACK_IMAGE } from '../constants';

// const BASE_API = '/api/shikimori';
const BASE_API = 'https://shikimori.one/api';
const IMG_BASE_URL = 'https://shikimori.one';
const FETCH_TIMEOUT = 8000; // 8 seconds timeout
const PLACEHOLDER_IMAGE = FALLBACK_IMAGE;
const CACHE_PREFIX = 'as_cache_';

// Concurrency Limiter
class RequestQueue {
  private queue: (() => void)[] = [];
  private activeCount = 0;
  private maxConcurrent: number;
  private msDelay: number;

  constructor(maxConcurrent: number, msDelay: number = 50) {
    this.maxConcurrent = maxConcurrent;
    this.msDelay = msDelay;
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
          setTimeout(() => this.next(), this.msDelay);
        }
      };

      if (this.activeCount < this.maxConcurrent) {
        task();
      } else {
        this.queue.push(task);
      }
    });
  }

  public clear() {
    this.queue = [];
  }

  private next() {
    if (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      task?.();
    }
  }
}

const requestQueue = new RequestQueue(1, 500); // 1 concurrent, 500ms delay to avoid 429 Rate Limit

export const clearRequestQueue = () => {
  requestQueue.clear();
};

// Cache configuration (Persistent LocalStorage)
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes cache

const getFromStorage = (key: string) => {
    try {
        const item = localStorage.getItem(CACHE_PREFIX + key);
        if (item) return JSON.parse(item);
    } catch (e) { return null; }
    return null;
};

const saveToStorage = (key: string, data: any) => {
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch (e) {
        // If quota exceeded, clear old cache
        try {
            localStorage.clear();
            localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch(e2) {}
    }
};

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

const proxyImage = (url: string | undefined | null) => {
  if (!url) return PLACEHOLDER_IMAGE;
  let cleanUrl = url.trim();
  
  // Check for known Shikimori 404/missing images
  if (cleanUrl.includes('missing_original') || cleanUrl.includes('none.png') || cleanUrl.includes('missing')) {
      // Return a local placeholder or a better generic image
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

  // 3. Fix relative links and add target="_blank"
  processed = processed.replace(
    /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
    (match, p1, href, p2) => {
        let fullHref = href;
        if (href.startsWith('/')) {
            fullHref = `https://shikimori.one${href}`;
        }
        if (match.toLowerCase().includes('target=')) {
            return `<a ${p1}href="${fullHref}"${p2}>`;
        }
        return `<a ${p1}href="${fullHref}" target="_blank" rel="noopener noreferrer"${p2}>`;
    }
  );

  return processed;
};

const fetchApi = async (endpoint: string, retries = 2, ttl = CACHE_TTL, bypassQueue = false) => {
  const cacheKey = endpoint;
  const cached = getFromStorage(cacheKey);
  const now = Date.now();

  // 1. Return fresh cache immediately
  if (cached && (now - cached.timestamp < ttl)) {
    return cached.data;
  }

  // 2. Define the network fetch task
  const networkTask = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const response = await fetch(`${BASE_API}${endpoint}`, {
        headers: { 'Cache-Control': 'no-cache' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');

      if (!response.ok) {
        if (response.status === 429) throw new Error('Rate limit exceeded');
        throw new Error(`API Error: ${response.status}`);
      }

      if (!isJson) {
         const text = await response.text();
         console.error(`[API Error] Expected JSON but got ${contentType}:`, text.slice(0, 100));
         throw new Error("API returned HTML instead of JSON. Check proxy configuration.");
      }

      const data = await response.json();
      saveToStorage(cacheKey, data);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      console.warn(`Fetch failed for ${endpoint}:`, error);
      
      // 3. Fallback to stale cache if available
      if (cached) {
          console.log(`Using stale cache for ${endpoint}`);
          return cached.data;
      }
      throw error;
    }
  };

  // 4. Execute with queue or directly
  if (bypassQueue) {
    return networkTask().catch(err => {
        // Final fallback to stale cache even if bypassQueue failed (double safety)
        if (cached) return cached.data;
        return null;
    });
  }
  
  return requestQueue.add(networkTask).catch(err => {
      if (cached) return cached.data;
      return null;
  });
};

export const mapAnime = async (data: any): Promise<Anime> => {
  if (!data) return {} as Anime;

  // Handle mock data structure pass-through
  if (data.id && data.title && data.description && (data.image || data.cover)) {
      return data as Anime;
  }
  
  const russian = data.russian || data.name || 'Без названия';
  
  let image = PLACEHOLDER_IMAGE;
  let image_preview = PLACEHOLDER_IMAGE;
  
  if (data.image) {
      if (typeof data.image === 'string') {
           if (!data.image.includes('missing')) {
               image = proxyImage(data.image);
               image_preview = image;
           }
      } else {
          // High Res
          const candidates = [data.image.original, data.image.preview, data.image.x96];
          for (const img of candidates) {
              if (img && !img.includes('missing') && !img.includes('none.png')) {
                  image = proxyImage(img);
                  break;
              }
          }
          // Low Res
          const candidatesPreview = [data.image.preview, data.image.x96, data.image.original];
          for (const img of candidatesPreview) {
              if (img && !img.includes('missing') && !img.includes('none.png')) {
                  image_preview = proxyImage(img);
                  break;
              }
          }
      }
  }

  return {
    id: data.id?.toString() || '',
    slug: slugify(data.name || data.russian || ''),
    title: russian,
    originalName: data.name || '',
    image,
    image_preview,
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

export const fetchAnimes = async (params: Record<string, any> = {}, bypassQueue = false): Promise<Anime[]> => {
  try {
    const cleanParams: any = { limit: '20', order: 'popularity', censored: 'false' };
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        cleanParams[k] = k === 'genre' && GENRE_MAP[v] ? GENRE_MAP[v] : v;
      }
    });
    const query = new URLSearchParams(cleanParams).toString();
    
    const data = await fetchApi(`/animes?${query}`, 2, CACHE_TTL, bypassQueue);
    
    if (!data) return MOCK_ANIME;
    if (Array.isArray(data)) {
        return Promise.all(data.map(mapAnime));
    }
    return MOCK_ANIME;
  } catch (e) {
    console.error("fetchAnimes error:", e);
    return MOCK_ANIME;
  }
};

export const getAnimeById = async (id: string | number) => {
  const controller = new AbortController();
  // Increase to 8 seconds
  const timeoutId = setTimeout(() => controller.abort(), 8000); 
  
  try {
    const response = await fetch(`${BASE_API}/animes/${id}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error('Failed to fetch anime');
    return await response.json();
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
};

// Helper to search in cached lists
const findInCachedLists = (id: string): Anime | null => {
    try {
        // Search in all local storage keys starting with CACHE_PREFIX
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(CACHE_PREFIX)) {
                const item = getFromStorage(key.replace(CACHE_PREFIX, ''));
                if (item && item.data && Array.isArray(item.data)) {
                    const found = item.data.find((a: any) => a.id?.toString() === id);
                    if (found) return found;
                }
            }
        }
    } catch (e) { }
    return null;
};

export const fetchAnimeDetails = async (id: string): Promise<Anime | null> => {
  try {
    const data = await getAnimeById(id);
    if (!data) {
        // Try to find in cache before giving up
        const cachedRaw = findInCachedLists(id);
        if (cachedRaw) {
            console.log(`[Anime Details] Found in cache fallback: ${id}`);
            return mapAnime(cachedRaw);
        }
        return null;
    }
    
    let anime = await mapAnime(data);

    // Fallback: If image is missing, try to fetch screenshots to find a cover
    if (anime.image === PLACEHOLDER_IMAGE) {
        try {
            // Secondary request: use queue
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
    console.warn(`[Anime Details] Failed to load API. Error:`, e);
    
    // Try to find in cache as a last resort
    const cachedRaw = findInCachedLists(id);
    if (cachedRaw) {
        console.log(`[Anime Details] Recovered from cache after error: ${id}`);
        return mapAnime(cachedRaw);
    }

    // Return null to indicate failure, let UI handle it
    return null;
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

export const fetchAnimeVideos = async (id: string): Promise<{ name: string; url: string; image: string }[]> => {
  try {
    const data = await fetchApi(`/animes/${id}/videos`);
    if (Array.isArray(data)) {
      return data.map((v: any) => ({
        name: v.name || 'Трейлер',
        url: v.url,
        image: v.image_url
      }));
    }
    return [];
  } catch (e) {
    return [];
  }
};

export const fetchRelatedAnimes = async (id: string): Promise<{ relation: string; anime: Anime }[]> => {
  try {
    const data = await fetchApi(`/animes/${id}/related`, 2, 60 * 60 * 1000);
    if (Array.isArray(data)) {
      const items = data
        .filter((item: any) => !!item.anime)
        .slice(0, 10);
      
      return Promise.all(items.map(async (item: any) => ({
          relation: item.relation_russian || item.relation || 'Связанное',
          anime: await mapAnime(item.anime)
      })));
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
    return Promise.all(data.slice(0, 10).map(mapAnime));
  } catch (e) {
    return MOCK_ANIME.slice(0, 4);
  }
};

export const fetchCalendar = async (): Promise<ScheduleItem[]> => {
  try {
    const data = await fetchApi(`/calendar`, 2, CACHE_TTL, false);
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
    const data = await fetchApi(`/topics?forum=news&limit=12&linked_type=Anime`, 2, 30 * 60 * 1000, false);
    if (!data || !Array.isArray(data)) return MOCK_NEWS;

    const newsItems = data.map(topic => {
      const html = topic.html_body || topic.body || '';
      const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
      const ytMatch = html.match(ytRegex);
      
      let videoId = ytMatch ? ytMatch[1] : undefined;
      
      // Optimization: Do NOT fetch linked anime videos for the list view to avoid N+1 requests and 429 errors.
      // We only fetch videos in the details view.

      return {
        id: topic.id.toString(),
        title: topic.topic_title || 'Без названия',
        summary: (topic.body || '').slice(0, 150).replace(/\[.*?\]/g, '') + '...',
        date: new Date(topic.created_at).toLocaleDateString('ru-RU'),
        category: 'Новости',
        image: imgMatch ? imgMatch[1] : undefined,
        video: videoId,
        linkedId: topic.linked_id,
        html_body: processNewsHtml(html) // Apply HTML processing
      };
    });
    
    return newsItems;
  } catch (e) {
    return MOCK_NEWS;
  }
};

export const fetchNewsDetails = async (id: string): Promise<NewsItem | null> => {
  try {
    const topic = await fetchApi(`/topics/${id}`, 2, 30 * 60 * 1000, true);
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
                const videos = await fetchApi(`/animes/${animeId}/videos`, 2, 60 * 60 * 1000);
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
