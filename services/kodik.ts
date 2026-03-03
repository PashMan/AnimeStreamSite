
import { getFromStorage, saveToStorage } from './cache';

export interface KodikTranslation {
  id: number;
  title: string;
  type: string;
}

export interface KodikAnime {
  id: string;
  link: string;
  translation: KodikTranslation;
  episodes_count: number;
  last_episode: number;
  screenshots?: string[];
}

const KODIK_TOKEN = "b3b563060d02ee000ca18740b7842ca0";
// Use the proxy to avoid mixed content and CORS issues
const BASE_URL = "/kodik-proxy"; 
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes cache

const fetchApi = async (url: string) => {
  try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Kodik API Error: ${res.status}`);
      return await res.json();
  } catch (e) {
      // Silently fail
      return null;
  }
}

export const fetchKodikData = async (shikimoriId: string, title?: string): Promise<KodikAnime[]> => {
  const cacheKey = `kodik_${shikimoriId}`;
  const cached = getFromStorage(cacheKey);
  const now = Date.now();
  if (cached && (now - cached.timestamp < CACHE_TTL)) {
      return cached.data;
  }

  try {
     // Use the proxy path
     let data = await fetchApi(`${BASE_URL}/search?token=${KODIK_TOKEN}&shikimori_id=${shikimoriId}&with_episodes=true&with_material_data=true`);

     if ((!data || !data.results?.length) && title) {
        const cleanTitle = title.split('/')[0].trim();
        data = await fetchApi(`${BASE_URL}/search?token=${KODIK_TOKEN}&title=${encodeURIComponent(cleanTitle)}&with_episodes=true&with_material_data=true`);
     }
     
     if (!data?.results) return [];

     const uniqueTranslations = new Map();
     data.results.forEach((item: any) => {
        const trans = uniqueTranslations.get(item.translation.id);
        if (!trans || item.last_episode > trans.last_episode) {
            uniqueTranslations.set(item.translation.id, {
                id: item.id,
                link: item.link.replace("http://", "https://"),
                translation: item.translation,
                episodes_count: item.episodes_count,
                last_episode: item.last_episode,
                screenshots: item.screenshots || []
            });
        }
     });

     const result = Array.from(uniqueTranslations.values()).sort((a: any, b: any) => b.last_episode - a.last_episode);
     saveToStorage(cacheKey, result);
     return result;
  } catch (e) {
     return [];
  }
}
