
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
  try {
     // Use the proxy path
     let data = await fetchApi(`${BASE_URL}/search?token=${KODIK_TOKEN}&shikimori_id=${shikimoriId}&with_episodes=true&with_material_data=true`);

     if ((!data || !data.results?.length) && title) {
        const cleanTitle = title.split('/')[0].trim();
        // Try searching by original title first
        data = await fetchApi(`${BASE_URL}/search?token=${KODIK_TOKEN}&title_orig=${encodeURIComponent(cleanTitle)}&with_episodes=true&with_material_data=true`);
        
        // If still no results, try general title search
        if (!data || !data.results?.length) {
            data = await fetchApi(`${BASE_URL}/search?token=${KODIK_TOKEN}&title=${encodeURIComponent(cleanTitle)}&with_episodes=true&with_material_data=true`);
        }
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

     return Array.from(uniqueTranslations.values()).sort((a: any, b: any) => b.last_episode - a.last_episode);
  } catch (e) {
     return [];
  }
}

export const fetchKodikAnimeInfo = async (shikimoriId: string, title?: string): Promise<{ image?: string, episodesAired?: number, episodesTotal?: number } | null> => {
    try {
        let data = await fetchApi(`${BASE_URL}/search?token=${KODIK_TOKEN}&shikimori_id=${shikimoriId}&with_material_data=true&with_episodes=true`);
        
        if ((!data || !data.results || data.results.length === 0) && title) {
             const cleanTitle = title.split('/')[0].trim();
             // Try searching by original title first
             data = await fetchApi(`${BASE_URL}/search?token=${KODIK_TOKEN}&title_orig=${encodeURIComponent(cleanTitle)}&with_material_data=true&with_episodes=true`);
             
             // If still no results, try general title search
             if (!data || !data.results || data.results.length === 0) {
                 data = await fetchApi(`${BASE_URL}/search?token=${KODIK_TOKEN}&title=${encodeURIComponent(cleanTitle)}&with_material_data=true&with_episodes=true`);
             }
        }

        if (data && data.results && data.results.length > 0) {
            // Find the result with the most episodes
            const bestResult = data.results.reduce((prev: any, current: any) => {
                return (current.last_episode > prev.last_episode) ? current : prev;
            });

            const image = bestResult.material_data?.poster_url ? bestResult.material_data.poster_url.replace('http://', 'https://') : (bestResult.screenshots && bestResult.screenshots.length > 0 ? bestResult.screenshots[0].replace('http://', 'https://') : undefined);

            return {
                image: image,
                episodesAired: bestResult.last_episode,
                episodesTotal: bestResult.episodes_count
            };
        }
        return null;
    } catch (e) {
        return null;
    }
};

export const fetchKodikImage = async (shikimoriId: string, title?: string): Promise<string | null> => {
    const info = await fetchKodikAnimeInfo(shikimoriId, title);
    return info?.image || null;
};
