


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

export const KODIK_TOKENS = [
  "b7cc4293ed475c4ad1fd599d114f4435",
  "17cc4ee691bc251131a9041e6e89e78e",
  "45c53578f11ecfb74e31267b634cc6a8",
  "93699ec16dae9882a1705e4dfb12c7bb",
  "1d643a758d41de5ccb2f66be4e3f421d"
];
export const KODIK_TOKEN = KODIK_TOKENS[0];

export const checkKodikAvailability = async (shikimoriIds: string[]): Promise<Set<string>> => {
  if (!shikimoriIds.length) return new Set();
  
  const availableIds = new Set<string>();
  
  const promises = shikimoriIds.map(async (id) => {
    try {
      const url = `https://kodikapi.com/search?token=${KODIK_TOKEN}&shikimori_id=${id}`;
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
  const mirrors = ["https://kodikapi.com/search", "https://kodik-api.com/search", "https://kodik.info/search"];
  
  for (const mirror of mirrors) {
    for (const token of KODIK_TOKENS) {
      try {
        let url = `${mirror}?token=${token}&shikimori_id=${shikimoriId}&with_episodes=true&with_material_data=true`;
        let res = await fetch(url);
        if (!res.ok) continue;
        let data = await res.json();

        if ((!data || !data.results?.length) && title) {
          const cleanTitle = title.split('/')[0].trim();
          url = `${mirror}?token=${token}&title=${encodeURIComponent(cleanTitle)}&with_episodes=true&with_material_data=true`;
          res = await fetch(url);
          if (res.ok) {
            data = await res.json();
          }
        }
        
        if (data?.results && data.results.length > 0) {
          const uniqueTranslations = new Map();
          data.results.forEach((item: any) => {
            const tId = item.translation?.id || item.translation?.title;
            const trans = uniqueTranslations.get(tId);
            if (!trans || (item.last_episode || 0) > (trans.last_episode || 0)) {
              let link = item.link || '';
              if (link.startsWith('//')) link = `https:${link}`;
              uniqueTranslations.set(tId, {
                id: item.id,
                link: link,
                translation: item.translation || { id: 0, title: 'Озвучка', type: 'voice' },
                episodes_count: item.episodes_count || item.last_episode || 1,
                last_episode: item.last_episode || item.episodes_count || 1,
                screenshots: item.screenshots || [],
                kinopoisk_id: item.kinopoisk_id,
                quality: item.quality || '720p'
              });
            }
          });

          const result = Array.from(uniqueTranslations.values()).sort((a: any, b: any) => (b.last_episode || 0) - (a.last_episode || 0));
          if (result.length > 0) return result;
        }
      } catch (e) {
        // Try next token / mirror
      }
    }
  }
  return [];
};

export interface KodikRecentUpdate {
  id: string;
  title: string;
  originalName: string;
  image: string;
  episode: number;
  translation: string;
  updatedAt: string;
  slug: string;
  rating: number;
}

const localSlugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

export const fetchRecentUpdates = async (limit = 40): Promise<KodikRecentUpdate[]> => {
  try {
    const res = await fetch(`/api/media/list?limit=${limit}`);
    if (!res.ok) return [];
    
    const data = await res.json();
    if (!data?.results || !Array.isArray(data.results)) return [];
    
    // Group by shikimori_id to keep latest update
    const grouped = new Map<string, any>();
    
    data.results.forEach((item: any) => {
      const shikiId = item.shikimori_id || item.kinopoisk_id || item.id;
      if (!shikiId) return;
      
      const existing = grouped.get(shikiId.toString());
      const itemDate = new Date(item.updated_at || item.created_at);
      
      if (!existing || itemDate > new Date(existing.updated_at || existing.created_at)) {
        grouped.set(shikiId.toString(), item);
      }
    });
    
    const uniqueResults = Array.from(grouped.values());
    
    const mapped: KodikRecentUpdate[] = uniqueResults.map(item => {
      const shikiId = item.shikimori_id || item.kinopoisk_id || item.id;
      const mat = item.material_data || {};
      
      const title = mat.title || item.title || 'Без названия';
      const cleanTitle = title.split('/')[0].trim();
      
      let image = mat.poster_url || mat.poster || '';
      if (image && image.includes('shikimori.one')) {
        const path = image.split('shikimori.one')[1];
        image = `/api/image${path}`;
      } else if (image && !image.startsWith('http') && !image.startsWith('/')) {
        image = `/api/image/system/animes/original/${shikiId}.jpg`;
      } else if (!image) {
        image = `/api/image/system/animes/original/${shikiId}.jpg`;
      }
      
      return {
        id: shikiId.toString(),
        title: cleanTitle,
        originalName: mat.title_en || mat.title || item.title || '',
        image: image,
        episode: item.last_episode || item.episodes_count || 1,
        translation: item.translation?.title || 'Субтитры | Озвучка',
        updatedAt: item.updated_at || item.created_at || '',
        slug: localSlugify(mat.title_en || mat.title || cleanTitle),
        rating: mat.shikimori_rating || mat.kp_rating || 0
      };
    });
    
    return mapped;
  } catch (e) {
    console.error("Error in fetchRecentUpdates:", e);
    return [];
  }
};
