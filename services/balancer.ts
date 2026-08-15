import { fetchKodikData } from './kodik';
import { getFromStorage, saveToStorage } from './cache';

export interface PlayerInfo {
  name: string;
  iframe: string | null;
  isCustom?: boolean;
}

export interface KodikTranslation {
  id: number | string;
  title: string;
  type: string;
  iframe: string;
  quality_label?: '4K' | '720p' | string;
  quality_val?: number;
  episodes_count?: number;
  last_episode?: number;
  provider?: string;
  skips?: {
    opening?: [number, number];
    ending?: [number, number];
  };
}

export interface BalancerData {
  players: PlayerInfo[];
  kodik_translations: KodikTranslation[];
}

export const fetchPlayersClientSide = async (shikimoriId: string, title: string, year: string): Promise<BalancerData> => {
  if (!shikimoriId) return { players: [], kodik_translations: [] };

  const cacheKey = `balancer_v4_${shikimoriId}`;
  const cached = getFromStorage(cacheKey);

  // TTL: 24 hours for balancer data
  const ttl = 24 * 60 * 60 * 1000;
  if (cached && (Date.now() - cached.timestamp < ttl)) {
    console.log(`[Balancer Service] Loaded from cache for ID ${shikimoriId}`);
    return cached.data;
  }

  try {
    const res = await fetch(`/api/balancer?title=${encodeURIComponent(title || '')}&year=${year || ''}&shikimori_id=${shikimoriId}`);
    if (res.ok) {
      const data = await res.json();
      
      let playersList: PlayerInfo[] = [];
      let translationsList: KodikTranslation[] = data.kodik_translations || [];

      if (data && data.players && Array.isArray(data.players)) {
        playersList = data.players;
      } else if (Array.isArray(data)) {
        playersList = data;
      }

      // Filter only players that have a valid iframe or isCustom
      playersList = playersList.filter(p => p.isCustom || (p.iframe && typeof p.iframe === 'string' && p.iframe.trim().length > 0));

      // Always ensure KamiPlayer (1080p) is present as the primary custom player at the front
      if (!playersList.some(p => p.name === 'KamiPlayer (1080p)')) {
        playersList.unshift({
          name: 'KamiPlayer (1080p)',
          iframe: null,
          isCustom: true
        });
      }

      const result: BalancerData = {
        players: playersList,
        kodik_translations: translationsList
      };

      saveToStorage(cacheKey, result);
      return result;
    }
  } catch (e) {
    console.warn('[Balancer Service] Backend balancer request failed, attempting direct Kodik lookup:', e);
  }

  // Client-side fallback if backend balancer returned nothing or errored
  try {
    const kodikDirectData = await fetchKodikData(shikimoriId, title);
    if (kodikDirectData && kodikDirectData.length > 0) {
      const fallbackTranslations: KodikTranslation[] = kodikDirectData.map(item => ({
        id: item.translation?.id || 0,
        title: item.translation?.title || 'Озвучка',
        type: item.translation?.type || 'voice',
        iframe: item.link,
        episodes_count: item.episodes_count || 1,
        last_episode: item.last_episode || 1,
        quality_label: '1080p',
        quality_val: 1080,
        provider: 'Kodik'
      }));

      const fallbackResult: BalancerData = {
        players: [
          {
            name: 'KamiPlayer (1080p)',
            iframe: null,
            isCustom: true
          },
          {
            name: 'Kodik',
            iframe: kodikDirectData[0]?.link || null
          }
        ],
        kodik_translations: fallbackTranslations
      };

      saveToStorage(cacheKey, fallbackResult);
      return fallbackResult;
    }
  } catch (directErr) {
    console.error('[Balancer Service] Direct Kodik fallback failed:', directErr);
  }

  if (cached) {
    console.warn(`[Balancer Service] Using stale cache for ${shikimoriId}`);
    return cached.data;
  }

  return { 
    players: [
      {
        name: 'KamiPlayer (1080p)',
        iframe: null,
        isCustom: true
      }
    ], 
    kodik_translations: [] 
  };
};
