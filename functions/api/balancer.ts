export async function onRequest(context: any) {
  const { request } = context;
  const url = new URL(request.url);
  const title = url.searchParams.get('title');
  const year = url.searchParams.get('year');
  const shikimori_id = url.searchParams.get('shikimori_id');

  if (!title && !shikimori_id) {
    return new Response(JSON.stringify({ error: 'Title or Shikimori ID is required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  const fetchWithTimeout = async (targetUrl: string, options: any = {}, timeoutMs = 3500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(targetUrl, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          ...(options.headers || {})
        }
      });
      clearTimeout(timer);
      return response;
    } catch (error) {
      clearTimeout(timer);
      throw error;
    }
  };

  let kinopoisk_id: string | null = null;
  let imdb_id: string | null = null;
  let world_art_id: string | null = null;
  let kodik_translations: any[] = [];
  let kodik_iframe: string | null = null;

  const ids = {
    shikimori_id,
    kinopoisk_id: null as string | null,
    imdb_id: null as string | null,
    world_art_id: null as string | null,
    anilibria_id: null as number | null
  };

  // 1. Kodik (Primary source & ID resolver)
  try {
    const kodikTokens = [
      'b7cc4293ed475c4ad1fd599d114f4435',
      '17cc4ee691bc251131a9041e6e89e78e',
      '45c53578f11ecfb74e31267b634cc6a8',
      '93699ec16dae9882a1705e4dfb12c7bb',
      '1d643a758d41de5ccb2f66be4e3f421d'
    ];

    for (const token of kodikTokens) {
      try {
        const kodikUrl = `https://kodik-api.com/search?token=${token}&${shikimori_id ? `shikimori_id=${shikimori_id}` : `title=${encodeURIComponent(String(title))}`}&with_material_data=true`;
        const kodikRes = await fetchWithTimeout(kodikUrl, {}, 3500);
        if (kodikRes.ok) {
          const kodikData = await kodikRes.json() as any;
          if (kodikData.results && kodikData.results.length > 0) {
            const resultWithIds = kodikData.results.find((r: any) => r.kinopoisk_id || r.imdb_id || r.worldart_id);
            if (resultWithIds) {
              kinopoisk_id = resultWithIds.kinopoisk_id ? String(resultWithIds.kinopoisk_id) : null;
              imdb_id = resultWithIds.imdb_id ? String(resultWithIds.imdb_id) : null;
              world_art_id = resultWithIds.worldart_id ? String(resultWithIds.worldart_id) : null;
              ids.kinopoisk_id = kinopoisk_id;
              ids.imdb_id = imdb_id;
              ids.world_art_id = world_art_id;
            }

            const translationsMap = new Map<string, any>();
            kodikData.results.forEach((res: any) => {
              if (res.translation && res.translation.title) {
                const tName = res.translation.title;
                const iframe = res.link.startsWith('//') ? `https:${res.link}` : res.link;
                const qualStr = (res.quality || '').toLowerCase();
                const is1080 = qualStr.includes('1080') || qualStr.includes('fhd') || qualStr.includes('bd') || qualStr.includes('uhd') || qualStr.includes('bluray');
                const quality_val = is1080 ? 1080 : 720;
                const quality_label = is1080 ? '4K' : '720p';

                let iframeWithApi = iframe;
                try {
                  const u = new URL(iframe);
                  u.searchParams.set('api', '1');
                  iframeWithApi = u.toString();
                } catch (_) {}

                if (!translationsMap.has(tName)) {
                  translationsMap.set(tName, {
                    id: res.translation.id,
                    title: tName,
                    type: res.translation.type || 'voice',
                    iframe: iframeWithApi,
                    episodes_count: res.episodes_count || res.last_episode || 1,
                    last_episode: res.last_episode || res.episodes_count || 1,
                    quality_val,
                    quality_label,
                    provider: 'Kodik'
                  });
                } else {
                  const existing = translationsMap.get(tName);
                  if (quality_val > (existing.quality_val || 0)) {
                    existing.quality_val = quality_val;
                    existing.quality_label = quality_label;
                    existing.iframe = iframeWithApi;
                  }
                  if ((res.episodes_count || 0) > (existing.episodes_count || 0)) {
                    existing.episodes_count = res.episodes_count;
                    existing.last_episode = res.last_episode || res.episodes_count;
                  }
                }
              }
            });
            kodik_translations = Array.from(translationsMap.values());

            const res = kodikData.results[0];
            let link = res.link.startsWith('//') ? `https:${res.link}` : res.link;
            try {
              const u = new URL(link);
              u.searchParams.set('api', '1');
              kodik_iframe = u.toString();
            } catch (_) {
              kodik_iframe = link;
            }
            break;
          }
        }
      } catch (err) {
        // Try next token
      }
    }
  } catch (e) {}

  let alloha_iframe: string | null = null;
  let collaps_iframe: string | null = null;
  let bhcesh_iframe: string | null = null;
  let videocdn_iframe: string | null = null;
  let bazon_iframe: string | null = null;
  let hdvb_iframe: string | null = null;
  let iframe_video_iframe: string | null = null;
  let pleer_iframe: string | null = null;
  let anilibria_iframe: string | null = null;

  const jobs: Promise<void>[] = [];

  // 2. Alloha
  jobs.push((async () => {
    try {
      const allohaTokens = [
        'd317441359e505c343c2063edc97e7',
        '04941a9a3ca3ac16e2b4327347bbc1',
        '96b62ea8e72e7452b652e461ab8b89'
      ];
      const allohaQueries: string[] = [];
      if (kinopoisk_id) {
        for (const t of allohaTokens) {
          allohaQueries.push(`https://api.alloha.tv/?token=${t}&kp=${kinopoisk_id}`);
          allohaQueries.push(`https://api.apbugall.org/?token=${t}&kp=${kinopoisk_id}`);
        }
      }
      if (imdb_id) {
        for (const t of allohaTokens) {
          allohaQueries.push(`https://api.alloha.tv/?token=${t}&imdb=${imdb_id}`);
          allohaQueries.push(`https://api.apbugall.org/?token=${t}&imdb=${imdb_id}`);
        }
      }

      for (const queryUrl of allohaQueries) {
        try {
          const res = await fetchWithTimeout(queryUrl, {}, 3000);
          if (res.ok) {
            const d = await res.json() as any;
            if (d && d.status === 'success' && d.data && d.data.iframe) {
              alloha_iframe = d.data.iframe;
              break;
            } else if (d && d.data && d.data.iframe) {
              alloha_iframe = d.data.iframe;
              break;
            } else if (d && d.iframe) {
              alloha_iframe = d.iframe;
              break;
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
  })());

  // 3. Collaps
  if (kinopoisk_id) {
    jobs.push((async () => {
      try {
        const cUrl = `https://apicollaps.cc/list?token=eedefb541aeba871dcfc756e6b31c02e&kinopoisk_id=${kinopoisk_id}`;
        const res = await fetchWithTimeout(cUrl, {}, 3000);
        if (res.ok) {
          const d = await res.json() as any;
          if (d.results && d.results.length > 0 && d.results[0].iframe_url) {
            collaps_iframe = d.results[0].iframe_url;
          }
        }
      } catch (_) {}
    })());
  }

  // 4. Bhcesh
  if (kinopoisk_id) {
    jobs.push((async () => {
      try {
        const bUrl = `https://api.bhcesh.me/list?token=eedefb541aeba871dcfc756e6b31c02e&kinopoisk_id=${kinopoisk_id}`;
        const res = await fetchWithTimeout(bUrl, {}, 2500);
        if (res.ok) {
          const d = await res.json() as any;
          if (d.results && d.results.length > 0 && d.results[0].iframe_url) {
            bhcesh_iframe = d.results[0].iframe_url;
          }
        }
      } catch (_) {}
    })());
  }

  // 5. Bazon
  if (kinopoisk_id) {
    jobs.push((async () => {
      try {
        const bUrl = `https://bazon.cc/api/search?token=2848f79ca09d4bbbf419bcdb464b4d11&kp=${kinopoisk_id}`;
        const res = await fetchWithTimeout(bUrl, {}, 2500);
        if (res.ok) {
          const d = await res.json() as any;
          if (d.results && d.results.length > 0) {
            bazon_iframe = d.results[0].link || d.results[0].iframe_url;
          }
        }
      } catch (_) {}
    })());
  }

  // 6. VideoCDN
  if (kinopoisk_id) {
    jobs.push((async () => {
      try {
        const vUrl = `https://videocdn.tv/api/short?api_token=pfp3D870PGEY3Afjti0gMtSfmn2aZqih&kinopoisk_id=${kinopoisk_id}`;
        const res = await fetchWithTimeout(vUrl, {}, 2000);
        if (res.ok) {
          const d = await res.json() as any;
          if (d.data && d.data.length > 0) {
            videocdn_iframe = d.data[0].iframe_src || d.data[0].iframe;
          }
        }
      } catch (_) {}
    })());
  }

  // 7. HDVB
  if (kinopoisk_id) {
    jobs.push((async () => {
      try {
        const hUrl = `https://apivb.info/api/videos.json?token=5e2fe4c70bafd9a7414c4f170ee1b192&id_kp=${kinopoisk_id}`;
        const res = await fetchWithTimeout(hUrl, {}, 2000);
        if (res.ok) {
          const d = await res.json() as any;
          if (Array.isArray(d) && d.length > 0) {
            hdvb_iframe = d[0].iframe_url || d[0].iframe;
          }
        }
      } catch (_) {}
    })());
  }

  // 8. Iframe.video
  if (kinopoisk_id) {
    jobs.push((async () => {
      try {
        const iUrl = `https://iframe.video/api/v2/search?kp=${kinopoisk_id}`;
        const res = await fetchWithTimeout(iUrl, {}, 2000);
        if (res.ok) {
          const d = await res.json() as any;
          if (d.results && d.results.length > 0) {
            iframe_video_iframe = d.results[0].path || d.results[0].iframe;
          } else if (d.results && d.results.path) {
            iframe_video_iframe = d.results.path;
          }
        }
      } catch (_) {}
    })());
  }

  // 9. Pleer.video
  if (kinopoisk_id) {
    jobs.push((async () => {
      try {
        const pUrl = `https://pleer.video/${kinopoisk_id}.json`;
        const res = await fetchWithTimeout(pUrl, {}, 2000);
        if (res.ok) {
          const d = await res.json() as any;
          if (d.embeds && d.embeds.length > 0) {
            pleer_iframe = d.embeds[0].iframe;
          }
        }
      } catch (_) {}
    })());
  }

  // 10. Anilibria
  jobs.push((async () => {
    try {
      const aUrl = `https://anilibria.top/api/v1/app/search/releases?query=${encodeURIComponent(String(title))}`;
      const anilibriaRes = await fetchWithTimeout(aUrl, {}, 3000);
      if (anilibriaRes.ok) {
        const anilibriaData = await anilibriaRes.json() as any;
        if (anilibriaData && anilibriaData.length > 0) {
          let bestMatch = anilibriaData[0];
          if (year) {
            const yearMatch = anilibriaData.find((r: any) => r.year === parseInt(String(year)));
            if (yearMatch) bestMatch = yearMatch;
          }
          anilibria_iframe = `https://www.anilibria.tv/public/iframe.php?id=${bestMatch.id}`;
          ids.anilibria_id = bestMatch.id;
        }
      }
    } catch (_) {}
  })());

  await Promise.allSettled(jobs);

  const players: any[] = [];
  if (kodik_iframe) {
    players.push({ name: 'Kodik', iframe: kodik_iframe });
  } else {
    players.push({ name: 'Kodik', iframe: null });
  }

  if (alloha_iframe) players.push({ name: 'Alloha', iframe: alloha_iframe });
  if (collaps_iframe) players.push({ name: 'Collaps', iframe: collaps_iframe });
  if (bhcesh_iframe) players.push({ name: 'Bhcesh', iframe: bhcesh_iframe });
  if (videocdn_iframe) players.push({ name: 'VideoCDN', iframe: videocdn_iframe });
  if (bazon_iframe) players.push({ name: 'Bazon', iframe: bazon_iframe });
  if (hdvb_iframe) players.push({ name: 'HDVB', iframe: hdvb_iframe });
  if (iframe_video_iframe) players.push({ name: 'Iframe', iframe: iframe_video_iframe });
  if (pleer_iframe) players.push({ name: 'Pleer', iframe: pleer_iframe });
  if (anilibria_iframe) players.push({ name: 'Anilibria', iframe: anilibria_iframe });

  return new Response(JSON.stringify({ players, ids, kodik_translations }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Cache-Control': 'public, max-age=300, s-maxage=300'
    }
  });
}
