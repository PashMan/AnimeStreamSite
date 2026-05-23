import { fetchKodikData } from './kodik';

export interface PlayerInfo {
  name: string;
  iframe: string | null;
  isCustom?: boolean;
}

export const fetchPlayersClientSide = async (shikimoriId: string, title: string, year: string): Promise<PlayerInfo[]> => {
  try {
    const res = await fetch(`/api/balancer?title=${encodeURIComponent(title)}&year=${year}&shikimori_id=${shikimoriId}`);
    if (res.ok) {
      const data = await res.json();
      
      let playersList: PlayerInfo[] = [];

      // Handle the new response format: { players: [], ids: {} }
      if (data && data.players && Array.isArray(data.players)) {
        if (data.ids) {
          console.log('[BALANCER] Anime IDs used for search:', data.ids);
        }
        playersList = data.players;
      } else if (Array.isArray(data)) {
        // Fallback for old format
        playersList = data;
      }

      // Filter out Anilibria
      playersList = playersList.filter(p => p.name !== 'Anilibria');

      // Add custom player for native high quality 4K encodes OR any anime containing Kodik stream
      const hasKodik = playersList.some(p => p.name === 'Kodik' && p.iframe);
      const isNative4K = shikimoriId === '32281' || shikimoriId === '50594' || shikimoriId === '62568' || shikimoriId === '38826' || shikimoriId === '16782';

      if (isNative4K || hasKodik) {
        if (!playersList.some(p => p.name === 'KamiPlayer (4K)')) {
          playersList.unshift({
            name: 'KamiPlayer (4K)',
            iframe: null,
            isCustom: true
          });
        }
      }

      return playersList;
    }
  } catch (e) {
    console.error('Balancer fetch failed', e);
  }
  return [];
};
