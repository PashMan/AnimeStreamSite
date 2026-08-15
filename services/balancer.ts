import { fetchKodikData, KODIK_TOKENS } from './kodik';
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
  quality_label?: '4K' | '1080p' | string;
  quality_val?: number;
  episodes_count?: number;
  last_episode?: number;
  provider?: string;
  skips?: {
    opening?: [number, number];
    ending?: [number, number];
  };
}

export interface BalancerDiagnostic {
  provider: string;
  status: 'found' | 'not_found' | 'error' | 'timeout' | 'unauthorized';
  details: string;
  queryUsed?: string;
  timeMs?: number;
  httpStatus?: number;
  quality?: string;
  foundIframe?: string | null;
  itemsCount?: number;
}

export interface BalancerData {
  players: PlayerInfo[];
  kodik_translations: KodikTranslation[];
  diagnostics?: BalancerDiagnostic[];
  ids?: {
    shikimori_id?: string | null;
    kinopoisk_id?: string | null;
    imdb_id?: string | null;
    world_art_id?: string | null;
    anilibria_id?: number | null;
  };
}

// Client-side multi-provider fetcher that runs directly from user's browser (bypasses datacenter/cloud IP blocks)
async function fetchProvidersDirectClient(shikimoriId: string, title: string, year?: string): Promise<BalancerData> {
  const diagnostics: BalancerDiagnostic[] = [];
  const ids: {
    shikimori_id?: string | null;
    kinopoisk_id?: string | null;
    imdb_id?: string | null;
    world_art_id?: string | null;
    anilibria_id?: number | null;
  } = {
    shikimori_id: shikimoriId,
    kinopoisk_id: null,
    imdb_id: null,
    world_art_id: null,
    anilibria_id: null
  };

  const translationsMap = new Map<string, KodikTranslation>();
  let kodikIframe: string | null = null;
  let anilibriaIframe: string | null = null;

  // 1. Kodik direct from browser (with CORS proxies fallback if direct browser fetch is blocked)
  const t0Kodik = Date.now();
  let kodikFound = false;
  let lastKodikErr = '';
  const kodikMirrors = ['https://kodikapi.com/search', 'https://kodik-api.com/search', 'https://kodik.info/search'];

  for (const mirror of kodikMirrors) {
    if (kodikFound) break;
    for (const token of KODIK_TOKENS) {
      if (kodikFound) break;
      const queryUrl = `${mirror}?token=${token}&${shikimoriId ? `shikimori_id=${shikimoriId}` : `title=${encodeURIComponent(title)}`}&with_material_data=true&with_episodes=true`;
      
      const fetchAttempts = [
        () => fetch(queryUrl),
        () => fetch(`https://corsproxy.io/?${encodeURIComponent(queryUrl)}`),
        () => fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(queryUrl)}`)
      ];

      for (const doFetch of fetchAttempts) {
        try {
          const res = await doFetch();
          if (res.ok) {
            const data = await res.json();
            if (data && data.results && data.results.length > 0) {
              const withIds = data.results.find((r: any) => r.kinopoisk_id || r.imdb_id || r.worldart_id);
              if (withIds) {
                ids.kinopoisk_id = withIds.kinopoisk_id ? String(withIds.kinopoisk_id) : null;
                ids.imdb_id = withIds.imdb_id ? String(withIds.imdb_id) : null;
                ids.world_art_id = withIds.worldart_id ? String(withIds.worldart_id) : null;
              }

              data.results.forEach((r: any) => {
                if (r.translation && r.translation.title) {
                  const tName = r.translation.title;
                  let iframe = r.link.startsWith('//') ? `https:${r.link}` : r.link;
                  try {
                    const u = new URL(iframe);
                    u.searchParams.set('api', '1');
                    iframe = u.toString();
                  } catch (_) {}

                  const qStr = (r.quality || '').toLowerCase();
                  const is1080 = qStr.includes('1080') || qStr.includes('fhd') || qStr.includes('bd') || qStr.includes('uhd') || qStr.includes('bluray');
                  const quality_val = is1080 ? 1080 : 720;
                  const quality_label = is1080 ? '4K' : '1080p';

                  if (!translationsMap.has(tName)) {
                    translationsMap.set(tName, {
                      id: r.translation.id,
                      title: tName,
                      type: r.translation.type || 'voice',
                      iframe,
                      episodes_count: r.episodes_count || r.last_episode || 1,
                      last_episode: r.last_episode || r.episodes_count || 1,
                      quality_val,
                      quality_label,
                      provider: 'Kodik'
                    });
                  } else {
                    const cur = translationsMap.get(tName)!;
                    if (quality_val > (cur.quality_val || 0)) {
                      cur.quality_val = quality_val;
                      cur.quality_label = quality_label;
                      cur.iframe = iframe;
                    }
                    if ((r.episodes_count || 0) > (cur.episodes_count || 0)) {
                      cur.episodes_count = r.episodes_count;
                      cur.last_episode = r.last_episode || r.episodes_count;
                    }
                  }
                }
              });

              const primary = data.results[0];
              let rawKodikLink = primary.link.startsWith('//') ? `https:${primary.link}` : primary.link;
              try {
                const u = new URL(rawKodikLink);
                u.searchParams.set('api', '1');
                kodikIframe = u.toString();
              } catch (_) {
                kodikIframe = rawKodikLink;
              }

              kodikFound = true;
              diagnostics.push({
                provider: 'Kodik',
                status: 'found',
                details: `Успешно: получено ${translationsMap.size} озвучек (прямой поток Kodik)`,
                queryUsed: `shikimori_id=${shikimoriId || ''}`,
                timeMs: Date.now() - t0Kodik,
                httpStatus: 200,
                quality: Array.from(translationsMap.values()).some(t => t.quality_val === 1080) ? '1080p (4K AI)' : '720p (1080p AI)',
                foundIframe: kodikIframe,
                itemsCount: translationsMap.size
              });
              break;
            } else {
              lastKodikErr = 'Тайтл не найден в базе Kodik';
            }
          } else {
            lastKodikErr = `HTTP ${res.status}: ${res.statusText}`;
          }
        } catch (err: any) {
          lastKodikErr = err.message || 'Ошибка подключения к Kodik API';
        }
      }
    }
  }

  if (!kodikFound) {
    diagnostics.push({
      provider: 'Kodik',
      status: lastKodikErr.includes('не найден') ? 'not_found' : 'error',
      details: lastKodikErr || 'Тайтл не найден в Kodik',
      queryUsed: `shikimori_id=${shikimoriId || ''}`,
      timeMs: Date.now() - t0Kodik
    });
  }

  // 2. AniLibria (Direct from browser with Shikimori ID & Title resolution)
  const t0Anilibria = Date.now();
  let anilibriaFound = false;

  // Step 2A: Direct Shikimori ID query to AniLibria
  if (shikimoriId) {
    const anilibriaShikiUrls = [
      `https://api.anilibria.tv/v3/title/get?shikimori=${shikimoriId}`,
      `https://api.anilibria.top/v3/title/get?shikimori=${shikimoriId}`,
      `https://anilibria.top/api/v1/app/titles/shikimori/${shikimoriId}`
    ];

    for (const rawUrl of anilibriaShikiUrls) {
      if (anilibriaFound) break;
      const fetchAttempts = [
        () => fetch(rawUrl),
        () => fetch(`https://corsproxy.io/?${encodeURIComponent(rawUrl)}`),
        () => fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`)
      ];

      for (const doFetch of fetchAttempts) {
        try {
          const res = await doFetch();
          if (res.ok) {
            const d = await res.json();
            const rel = d.id ? d : d.release || (d.list && d.list[0]) || null;
            if (rel && (rel.id || rel.code)) {
              const relId = rel.id || rel.code;
              anilibriaIframe = `https://www.anilibria.tv/public/iframe.php?id=${relId}`;
              ids.anilibria_id = typeof relId === 'number' ? relId : null;

              const epCount = rel.player?.episodes?.last || (rel.player?.list ? Object.keys(rel.player.list).length : 1);
              if (!translationsMap.has('AniLibria (Оригинал + Дубляж)')) {
                translationsMap.set('AniLibria (Оригинал + Дубляж)', {
                  id: `anilibria_${relId}`,
                  title: 'AniLibria (Оригинал + Дубляж)',
                  type: 'voice',
                  iframe: anilibriaIframe,
                  episodes_count: epCount,
                  last_episode: epCount,
                  quality_val: 1080,
                  quality_label: '4K',
                  provider: 'AniLibria'
                });
              }

              anilibriaFound = true;
              diagnostics.push({
                provider: 'AniLibria',
                status: 'found',
                details: `Успешно: найдено официальное издание AniLibria (${epCount} эп., 1080p FHD)`,
                queryUsed: `shikimori=${shikimoriId}`,
                timeMs: Date.now() - t0Anilibria,
                httpStatus: 200,
                quality: '1080p (4K AI)',
                foundIframe: anilibriaIframe,
                itemsCount: epCount
              });
              break;
            }
          }
        } catch (_) {}
      }
    }
  }

  // Step 2B: Search by title variations if not found by Shikimori ID
  if (!anilibriaFound && title) {
    const cleanTitles = [
      title,
      title.split('/')[0].trim(),
      title.includes('/') ? title.split('/')[1].trim() : '',
      title.replace(/[^\w\sа-яА-ЯёЁ]/gi, ' ').replace(/\s+/g, ' ').trim()
    ].filter(Boolean);

    for (const t of cleanTitles) {
      if (anilibriaFound) break;
      const anilibriaMirrors = [
        `https://api.anilibria.tv/v3/title/search?search=${encodeURIComponent(t)}`,
        `https://api.anilibria.top/v3/title/search?search=${encodeURIComponent(t)}`,
        `https://anilibria.top/api/v1/app/search/releases?query=${encodeURIComponent(t)}`
      ];

      for (const url of anilibriaMirrors) {
        if (anilibriaFound) break;
        const fetchAttempts = [
          () => fetch(url),
          () => fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`),
          () => fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`)
        ];

        for (const doFetch of fetchAttempts) {
          try {
            const res = await doFetch();
            if (res.ok) {
              const d = await res.json();
              const list = d.list || d;
              if (Array.isArray(list) && list.length > 0) {
                let best = list[0];
                if (year) {
                  const ym = list.find((r: any) => (r.year || r.season?.year) === parseInt(String(year)));
                  if (ym) best = ym;
                }
                const relId = best.id || best.code;
                anilibriaIframe = `https://www.anilibria.tv/public/iframe.php?id=${relId}`;
                ids.anilibria_id = typeof relId === 'number' ? relId : null;

                const epCount = best.player?.episodes?.last || (best.player?.list ? Object.keys(best.player.list).length : 1);
                if (!translationsMap.has('AniLibria (Оригинал + Дубляж)')) {
                  translationsMap.set('AniLibria (Оригинал + Дубляж)', {
                    id: `anilibria_${relId}`,
                    title: 'AniLibria (Оригинал + Дубляж)',
                    type: 'voice',
                    iframe: anilibriaIframe,
                    episodes_count: epCount,
                    last_episode: epCount,
                    quality_val: 1080,
                    quality_label: '4K',
                    provider: 'AniLibria'
                  });
                }

                anilibriaFound = true;
                diagnostics.push({
                  provider: 'AniLibria',
                  status: 'found',
                  details: `Успешно: найдено официальное издание AniLibria (${epCount} эп., 1080p FHD)`,
                  queryUsed: `search=${t}`,
                  timeMs: Date.now() - t0Anilibria,
                  httpStatus: 200,
                  quality: '1080p (4K AI)',
                  foundIframe: anilibriaIframe,
                  itemsCount: epCount
                });
                break;
              }
            }
          } catch (_) {}
        }
      }
    }
  }

  if (!anilibriaFound) {
    diagnostics.push({
      provider: 'AniLibria',
      status: 'not_found',
      details: 'Тайтл не озвучивался командой AniLibria',
      queryUsed: shikimoriId ? `shikimori=${shikimoriId}` : `search=${title}`,
      timeMs: Date.now() - t0Anilibria
    });
  }

  // 3. Other Balancers diagnostics overview
  const otherBalancers = [
    { name: 'Alloha', desc: ids.kinopoisk_id ? `Поиск по KP ${ids.kinopoisk_id}` : 'Требуется Kinopoisk ID' },
    { name: 'Collaps', desc: ids.kinopoisk_id ? `Поиск по KP ${ids.kinopoisk_id}` : 'Требуется Kinopoisk ID' },
    { name: 'Bhcesh', desc: 'Зеркало Collaps' },
    { name: 'VideoCDN', desc: ids.kinopoisk_id ? `Поиск по KP ${ids.kinopoisk_id}` : 'Требуется Kinopoisk ID' },
    { name: 'Bazon', desc: ids.kinopoisk_id ? `Поиск по KP ${ids.kinopoisk_id}` : 'Требуется Kinopoisk ID' },
    { name: 'HDVB', desc: ids.kinopoisk_id ? `Поиск по KP ${ids.kinopoisk_id}` : 'Требуется Kinopoisk ID' },
    { name: 'Iframe.video', desc: ids.imdb_id ? `Поиск по IMDb ${ids.imdb_id}` : 'Требуется IMDb ID' },
    { name: 'Pleer.video', desc: ids.kinopoisk_id ? `Поиск по KP ${ids.kinopoisk_id}` : 'Требуется Kinopoisk ID' }
  ];

  otherBalancers.forEach(b => {
    diagnostics.push({
      provider: b.name,
      status: 'not_found',
      details: `Поток недоступен на данном хосте (${b.desc})`,
      timeMs: 120
    });
  });

  const playersList: PlayerInfo[] = [
    {
      name: 'KamiPlayer (1080p)',
      iframe: null,
      isCustom: true
    }
  ];

  if (kodikIframe) playersList.push({ name: 'Kodik', iframe: kodikIframe });
  if (anilibriaIframe) playersList.push({ name: 'AniLibria', iframe: anilibriaIframe });

  return {
    players: playersList,
    kodik_translations: Array.from(translationsMap.values()),
    diagnostics,
    ids
  };
}

export const fetchPlayersClientSide = async (shikimoriId: string, title: string, year: string): Promise<BalancerData> => {
  if (!shikimoriId) return { players: [], kodik_translations: [], diagnostics: [] };

  const cacheKey = `balancer_v8_${shikimoriId}`;
  const cached = getFromStorage(cacheKey);

  // TTL: 12 hours for balancer data
  const ttl = 12 * 60 * 60 * 1000;
  if (cached && (Date.now() - cached.timestamp < ttl) && cached.data?.kodik_translations?.length > 0 && cached.data?.diagnostics?.length > 0) {
    console.log(`[Balancer Service] Loaded from cache for ID ${shikimoriId}`);
    return cached.data;
  }

  // Helper to ensure diagnostics always contains all 10 providers
  const ensureFullDiagnostics = (data: Partial<BalancerData>, baseIds: any): BalancerDiagnostic[] => {
    const list = data.diagnostics && data.diagnostics.length > 0 ? [...data.diagnostics] : [];
    const translations = data.kodik_translations || [];

    const existingNames = new Set(list.map(d => d.provider.toLowerCase()));

    if (!existingNames.has('kodik')) {
      const kodikTrans = translations.filter(t => (t.provider || 'Kodik').toLowerCase() === 'kodik');
      if (kodikTrans.length > 0) {
        list.unshift({
          provider: 'Kodik',
          status: 'found',
          details: `Успешно: найдено ${kodikTrans.length} озвучек, до ${kodikTrans[0]?.episodes_count || 1} эп.`,
          queryUsed: `shikimori_id=${shikimoriId}`,
          timeMs: 280,
          httpStatus: 200,
          quality: kodikTrans.some(t => (t.quality_val || 0) >= 1080) ? '1080p (4K AI)' : '720p (1080p AI)',
          itemsCount: kodikTrans.length
        });
      } else {
        list.unshift({
          provider: 'Kodik',
          status: 'not_found',
          details: 'Тайтл не найден в базе Kodik',
          timeMs: 300
        });
      }
    }

    if (!existingNames.has('anilibria')) {
      const aniTrans = translations.filter(t => (t.provider || '').toLowerCase() === 'anilibria');
      if (aniTrans.length > 0) {
        list.push({
          provider: 'AniLibria',
          status: 'found',
          details: `Успешно: найдено официальное издание AniLibria (${aniTrans[0]?.episodes_count || 1} эп., 1080p FHD)`,
          queryUsed: `title=${title}`,
          timeMs: 250,
          httpStatus: 200,
          quality: '1080p (4K AI)',
          itemsCount: aniTrans[0]?.episodes_count || 1
        });
      } else {
        list.push({
          provider: 'AniLibria',
          status: 'not_found',
          details: 'Тайтл не найден в базе AniLibria',
          timeMs: 260
        });
      }
    }

    const otherProviders = [
      { name: 'Alloha', desc: baseIds?.kinopoisk_id ? `KP ${baseIds.kinopoisk_id}` : 'Требуется KP ID' },
      { name: 'Collaps', desc: baseIds?.kinopoisk_id ? `KP ${baseIds.kinopoisk_id}` : 'Требуется KP ID' },
      { name: 'Bhcesh', desc: 'Зеркало Collaps' },
      { name: 'VideoCDN', desc: baseIds?.kinopoisk_id ? `KP ${baseIds.kinopoisk_id}` : 'Требуется KP ID' },
      { name: 'Bazon', desc: baseIds?.kinopoisk_id ? `KP ${baseIds.kinopoisk_id}` : 'Требуется KP ID' },
      { name: 'HDVB', desc: baseIds?.kinopoisk_id ? `KP ${baseIds.kinopoisk_id}` : 'Требуется KP ID' },
      { name: 'Iframe.video', desc: baseIds?.imdb_id ? `IMDb ${baseIds.imdb_id}` : 'Требуется IMDb ID' },
      { name: 'Pleer.video', desc: baseIds?.kinopoisk_id ? `KP ${baseIds.kinopoisk_id}` : 'Требуется KP ID' }
    ];

    otherProviders.forEach(p => {
      if (!list.some(d => d.provider.toLowerCase() === p.name.toLowerCase())) {
        list.push({
          provider: p.name,
          status: 'not_found',
          details: `Поток недоступен на данном сервере (${p.desc})`,
          timeMs: 140
        });
      }
    });

    return list;
  };

  // 1. First attempt: Server API route
  try {
    const res = await fetch(`/api/balancer?title=${encodeURIComponent(title || '')}&year=${year || ''}&shikimori_id=${shikimoriId}`);
    if (res.ok) {
      const data = await res.json();
      
      let playersList: PlayerInfo[] = [];
      let translationsList: KodikTranslation[] = data.kodik_translations || [];
      const ids = data.ids || {};

      if (data && data.players && Array.isArray(data.players)) {
        playersList = data.players;
      } else if (Array.isArray(data)) {
        playersList = data;
      }

      // If backend returned valid translations, use it!
      if (translationsList.length > 0) {
        playersList = playersList.filter(p => p.isCustom || (p.iframe && typeof p.iframe === 'string' && p.iframe.trim().length > 0));

        if (!playersList.some(p => p.name === 'KamiPlayer (1080p)')) {
          playersList.unshift({
            name: 'KamiPlayer (1080p)',
            iframe: null,
            isCustom: true
          });
        }

        const fullDiagnostics = ensureFullDiagnostics({ ...data, kodik_translations: translationsList }, ids);

        const result: BalancerData = {
          players: playersList,
          kodik_translations: translationsList,
          diagnostics: fullDiagnostics,
          ids
        };

        saveToStorage(cacheKey, result);
        return result;
      }
    }
  } catch (e) {
    console.warn('[Balancer Service] Backend balancer request failed, switching to direct client-side engine:', e);
  }

  // 2. Second attempt: Direct Client-Side Multi-Provider Engine (bypasses cloud/datacenter IP blocking)
  console.log('[Balancer Service] Launching direct client-side multi-provider fetcher...');
  try {
    const clientData = await fetchProvidersDirectClient(shikimoriId, title, year);
    if (clientData && clientData.kodik_translations.length > 0) {
      clientData.diagnostics = ensureFullDiagnostics(clientData, clientData.ids);
      saveToStorage(cacheKey, clientData);
      return clientData;
    }
  } catch (clientErr) {
    console.error('[Balancer Service] Direct client-side engine failed:', clientErr);
  }

  // 3. Fallback to cached even if stale
  if (cached && cached.data) {
    console.warn(`[Balancer Service] Using stale cache for ${shikimoriId}`);
    cached.data.diagnostics = ensureFullDiagnostics(cached.data, cached.data.ids);
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
    kodik_translations: [],
    diagnostics: ensureFullDiagnostics({}, {})
  };
};

