import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('/*', cors());

// ... API routes ...

export default {
  fetch: app.fetch,
};

  // Simple in-memory log buffer for debugging
  const debugLogs: any[] = [];
  const addLog = (message: string, data?: any) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      data: data || null
    };
    debugLogs.unshift(logEntry);
    if (debugLogs.length > 100) debugLogs.pop(); // Keep last 100 logs
    console.log(`[DEBUG] ${message}`, data ? JSON.stringify(data) : '');
  };

// API Route to retrieve debug logs
app.get('/api/debug-logs', (c) => {
  console.log('[API] GET /api/debug-logs');
  return c.json(debugLogs);
});

// API Route to test logging
app.get('/api/test-log', (c) => {
  console.log('[API] GET /api/test-log', c.req.query);
  addLog('Manual Test Log', { query: c.req.query, userAgent: c.req.header('user-agent') });
  return c.json({ status: 'ok', message: 'Test log added' });
});

// API Route for Anilibria v3 (Proxy to bypass CORS)
app.get('/api/anilibria/title', async (c) => {
  const shikimori = c.req.query('shikimori');
  console.log(`[API] Anilibria Proxy: shikimori=${shikimori}`);
  if (!shikimori) {
    return c.json({ error: 'Shikimori ID is required' }, 400);
  }
  try {
    const response = await fetch(`https://api.anilibria.tv/v3/title/get?shikimori=${shikimori}`);
    if (!response.ok) {
      console.error(`[API] Anilibria API error: ${response.status}`);
      return c.json({ error: 'Anilibria API error' }, response.status as any);
    }
    const data = await response.json();
    return c.json(data);
  } catch (error: any) {
    console.error('[API] Anilibria Proxy Error:', error.message);
    return c.json({ error: 'Failed to fetch from Anilibria' }, 500);
  }
});




  const fetchCollaps = async (title: any, year: any, kinopoisk_id: any, imdb_id: any, shikimori_id: any, world_art_id: any) => {
    const tryFetch = async (query: string) => {
      try {
        const url = `https://api.apibd.net/v1/search?token=b4b2c1b2c1b2c1b2c1b2c1b2c1b2c1b2${query}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.results && data.results.length > 0) return data.results;
      } catch (e) {
        console.error(`[COLLAPS] Fetch failed for query: ${query}`, e);
      }
      return null;
    };

    let results = null;
    if (imdb_id) results = await tryFetch(`&imdb_id=${imdb_id}`);
    if (!results && kinopoisk_id) results = await tryFetch(`&kinopoisk_id=${kinopoisk_id}`);
    if (!results && shikimori_id) {
      results = await tryFetch(`&shikimori_id=${shikimori_id}`);
      if (!results) results = await tryFetch(`&shikimori=${shikimori_id}`);
    }
    if (!results && world_art_id) {
      results = await tryFetch(`&world_art_id=${world_art_id}`);
      if (!results) results = await tryFetch(`&worldart_id=${world_art_id}`);
    }
    if (!results && title) results = await tryFetch(`&name=${encodeURIComponent(String(title))}${year ? `&year=${year}` : ''}`);

    if (results && results.length > 0) {
      let bestMatch = results[0];
      if (title) {
        const searchTitle = String(title).toLowerCase();
        console.log(`[COLLAPS] Filtering results for title: ${searchTitle}`);
        
        const exactMatch = results.find((r: any) => 
          (r.name || r.title || '').toLowerCase() === searchTitle ||
          (r.name || r.title || '').toLowerCase().includes(searchTitle)
        );
        
        if (exactMatch) {
          console.log(`[COLLAPS] Found exact match: ${exactMatch.name || exactMatch.title}`);
          bestMatch = exactMatch;
        } else {
          const season1 = results.find((r: any) => 
            (r.name || r.title || '').toLowerCase().includes('1 сезон') || 
            (r.name || r.title || '').toLowerCase().includes('season 1')
          );
          if (season1) {
            console.log(`[COLLAPS] Found Season 1 match: ${season1.name || season1.title}`);
            bestMatch = season1;
          }
        }
      }
      return [bestMatch];
    }
    console.warn(`[COLLAPS] No results found for query`);
    return [];
  };

// API Route for Balancer (Multiple players)
app.get('/api/balancer', async (c) => {
  const title = c.req.query('title');
  const year = c.req.query('year');
  const shikimori_id = c.req.query('shikimori_id');
  
  console.log(`[API] Balancer: title=${title}, year=${year}, shiki=${shikimori_id}`);
  addLog('Balancer Request Started', { title, year, shikimori_id });
  
  try {
    if (!title && !shikimori_id) {
      addLog('Balancer Request Failed: Missing Title and Shikimori ID');
      return c.json({ error: 'Title or Shikimori ID is required' }, 400);
    }

    const players: any[] = [
      { name: 'Kodik', iframe: null },
      { name: 'Anilibria', iframe: null }
    ];
    let kinopoisk_id: string | null = null;
    let imdb_id: string | null = null;
    let world_art_id: string | null = null;

    const ids = {
      shikimori_id,
      kinopoisk_id,
      imdb_id,
      world_art_id,
      anilibria_id: null as number | null
    };

    // 1. Kodik (Primary source & ID resolver)
    try {
      const kodikUrl = `https://kodik-api.com/search?token=17cc4ee691bc251131a9041e6e89e78e&${shikimori_id ? `shikimori_id=${shikimori_id}` : `title=${encodeURIComponent(String(title))}`}&with_material_data=true`;
      const kodikRes = await fetch(kodikUrl);
      const kodikData = await kodikRes.json() as any;
      
      if (kodikData.results && kodikData.results.length > 0) {
        const resultWithIds = kodikData.results.find((r: any) => r.kinopoisk_id || r.imdb_id || r.worldart_id);
        if (resultWithIds) {
          kinopoisk_id = resultWithIds.kinopoisk_id || null;
          imdb_id = resultWithIds.imdb_id || null;
          world_art_id = resultWithIds.worldart_id || null;
          ids.kinopoisk_id = kinopoisk_id;
          ids.imdb_id = imdb_id;
          ids.world_art_id = world_art_id;
        }

        // User wants to avoid "million buttons". Just take the first one.
        const res = kodikData.results[0];
        const kodikPlayer = players.find(p => p.name === 'Kodik');
        if (kodikPlayer) {
          let link = res.link.startsWith('//') ? `https:${res.link}` : res.link;
          // Add api=1 to enable postMessage communication
          const url = new URL(link);
          url.searchParams.set('api', '1');
          kodikPlayer.iframe = url.toString();
        }
      }
    } catch (e: any) {
      addLog('Kodik fetch failed', { error: e.message });
    }

    // 3. Anilibria
    try {
      const anilibriaRes = await fetch(`https://anilibria.top/api/v1/app/search/releases?query=${encodeURIComponent(String(title))}`);
      if (anilibriaRes.ok) {
        const anilibriaData = await anilibriaRes.json() as any;
        if (anilibriaData && anilibriaData.length > 0) {
          let bestMatch = anilibriaData[0];
          if (year) {
            const yearMatch = anilibriaData.find((r: any) => r.year === parseInt(String(year)));
            if (yearMatch) bestMatch = yearMatch;
          }
          const anilibriaPlayer = players.find(p => p.name === 'Anilibria');
          if (anilibriaPlayer) {
            anilibriaPlayer.iframe = `https://www.anilibria.tv/public/iframe.php?id=${bestMatch.id}`;
            ids.anilibria_id = bestMatch.id;
          }
        }
      }
    } catch (e: any) {
      addLog('Anilibria fetch failed', { error: e.message });
    }

    console.log(`[BALANCER] Found IDs -> Shikimori: ${shikimori_id}, Kinopoisk: ${kinopoisk_id}, IMDb: ${imdb_id}, WorldArt: ${world_art_id}`);
    return c.json({ players, ids });
  } catch (error: any) {
    addLog('Balancer API Exception', { message: error.message });
    return c.json({ error: 'Failed to fetch balancer data' }, 500);
  }
});

app.get('/api/test-jikan/:id', async (c) => {
  try {
    const animeId = c.req.param('id');
    const jikanResponse = await fetch(`https://api.jikan.moe/v4/anime/${animeId}`);
    const data = await jikanResponse.json();
    return c.json({
      status: jikanResponse.status,
      ok: jikanResponse.ok,
      data
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// In-memory cache for Jikan image URLs to avoid rate limits
const jikanImageCache = new Map<string, string>();

// API Route for Image Proxy (matches Cloudflare Worker behavior)
app.get('/api/image/*', async (c) => {
  const imagePath = c.req.path.replace('/api/image/', '');
  const targetUrl = `https://shikimori.one/${imagePath}${c.req.url.includes('?') ? c.req.url.substring(c.req.url.indexOf('?')) : ''}`;
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': 'https://shikimori.one/',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
  };

  try {
    let response = await fetch(targetUrl, { headers });
    
    // Fallback to Jikan API if Shikimori returns error (404, 403, etc.)
    if (!response.ok) {
      const animeIdMatch = imagePath.match(/\/(\d+)\.jpg$/);
      if (animeIdMatch) {
        const animeId = animeIdMatch[1];
        console.log(`[DEBUG] Image error (${response.status}) on Shikimori for ID: ${animeId}, trying Jikan fallback`);
        
        try {
          let imageUrl = jikanImageCache.get(animeId);
          
          if (!imageUrl) {
            // Jikan API has rate limits (3 requests per second)
            const jikanRes = await fetch(`https://api.jikan.moe/v4/anime/${animeId}`);
            if (jikanRes.ok) {
              const jikanData = await jikanRes.json() as any;
              imageUrl = jikanData.data?.images?.jpg?.large_image_url || jikanData.data?.images?.jpg?.image_url;
              if (imageUrl) {
                jikanImageCache.set(animeId, imageUrl);
              } else {
                console.warn(`[DEBUG] Jikan found anime ${animeId} but no image URL`);
              }
            } else {
              console.error(`[DEBUG] Jikan API error for ${animeId}: ${jikanRes.status}`);
            }
          }

          if (imageUrl) {
            const fallbackRes = await fetch(imageUrl);
            if (fallbackRes.ok) {
              console.log(`[DEBUG] Jikan fallback SUCCESS for ID: ${animeId}`);
              return new Response(fallbackRes.body, {
                status: 200,
                headers: {
                  'Content-Type': fallbackRes.headers.get('content-type') || 'image/jpeg',
                  'Cache-Control': 'public, max-age=2592000',
                  'X-Image-Source': 'Jikan-Fallback'
                }
              });
            } else {
              console.error(`[DEBUG] Jikan image fetch failed for ${imageUrl}: ${fallbackRes.status}`);
            }
          }
        } catch (e) {
          console.error('[DEBUG] Jikan fallback failed', e);
        }
      }
    }
    
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=2592000',
        'X-Image-Source': 'Shikimori'
      }
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// SPA Fallback
app.get('*', serveStatic({ root: './dist' }));

export default {
  fetch: app.fetch,
};
