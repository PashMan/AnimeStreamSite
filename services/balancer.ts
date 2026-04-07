import { fetchKodikData } from './kodik';

export interface PlayerInfo {
  name: string;
  iframe: string;
}

export const fetchPlayersClientSide = async (shikimoriId: string, title: string, year: string): Promise<PlayerInfo[]> => {
  try {
    const res = await fetch(`/api/balancer?title=${encodeURIComponent(title)}&year=${year}&shikimori_id=${shikimoriId}`);
    if (res.ok) {
      const data = await res.json();
      
      // Handle the new response format: { players: [], ids: {} }
      if (data && data.players && Array.isArray(data.players)) {
        if (data.ids) {
          console.log('[BALANCER] Anime IDs used for search:', data.ids);
        }
        return data.players;
      }
      
      // Fallback for old format
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (e) {
    console.error('Balancer fetch failed', e);
  }
  return [];
};
