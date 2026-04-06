


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
  kinopoisk_id?: string;
}

export const KODIK_TOKEN = "a0457eb45312af80bbb9f3fb33de3e93";

export const checkKodikAvailability = async (shikimoriIds: string[]): Promise<Set<string>> => {
  if (!shikimoriIds.length) return new Set();
  
  const availableIds = new Set<string>();
  
  const promises = shikimoriIds.map(async (id) => {
    try {
      const url = `https://kodik-api.com/search?token=${KODIK_TOKEN}&shikimori_id=${id}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data?.results && data.results.length > 0) {
        availableIds.add(id.toString());
      }
    } catch (e) {
      console.error(`Error fetching Kodik for ID ${id}:`, e);
    }
  });

  await Promise.all(promises);
  
  return availableIds;
};

export const fetchKodikData = async (shikimoriId: string, title?: string): Promise<KodikAnime[]> => {
  try {
     let url = `https://kodik-api.com/search?token=${KODIK_TOKEN}&shikimori_id=${shikimoriId}&with_episodes=true&with_material_data=true`;
     let res = await fetch(url);
     let data = await res.json();

     if ((!data || !data.results?.length) && title) {
        const cleanTitle = title.split('/')[0].trim();
        url = `https://kodik-api.com/search?token=${KODIK_TOKEN}&title=${encodeURIComponent(cleanTitle)}&with_episodes=true&with_material_data=true`;
        res = await fetch(url);
        data = await res.json();
     }
     
     if (!data?.results) return [];

     const uniqueTranslations = new Map();
     data.results.forEach((item: any) => {
        const trans = uniqueTranslations.get(item.translation.id);
        if (!trans || item.last_episode > trans.last_episode) {
            uniqueTranslations.set(item.translation.id, {
                id: item.id,
                link: item.link.replace(/^https?:\/\/[^\/]+/, "https://kodik.info").replace(/^\/\/[^\/]+/, "https://kodik.info"),
                translation: item.translation,
                episodes_count: item.episodes_count,
                last_episode: item.last_episode,
                screenshots: item.screenshots || [],
                kinopoisk_id: item.kinopoisk_id
            });
        }
     });

     const result = Array.from(uniqueTranslations.values()).sort((a: any, b: any) => b.last_episode - a.last_episode);
     return result;
  } catch (e) {
     console.error("Error in fetchKodikData:", e);
     return [];
  }
}
