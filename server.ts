import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('/*', cors());

app.use('/*', async (c, next) => {
  const method = c.req.method;
  const url = c.req.url;
  console.log(`[HONO REQUEST] ${method} ${url}`);
  try {
    await next();
    console.log(`[HONO RESPONSE] ${method} ${url} - Status: ${c.res.status}`);
  } catch (err: any) {
    console.error(`[HONO ERROR] ${method} ${url} - Error:`, err);
    return c.json({ error: 'Internal Server Error', message: err.message }, 500);
  }
});

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

// API Route for AI Anime Recommendation (Supports DeepSeek and Gemini API)
app.post('/api/ai/recommend', async (c) => {
  try {
    const { messages } = await c.req.json();
    
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    
    if (!deepseekKey && !geminiKey) {
      return c.json({ error: 'AI API keys not configured. Please define DEEPSEEK_API_KEY or GEMINI_API_KEY in Settings/Secrets.' }, 400);
    }
    
    const systemPrompt = "Вы — дружелюбный искусственный интеллект-ассистент KamiAnime, эксперт по аниме. " +
      "Ваша цель — рекомендовать пользователю подходящие под его запрос тайтлы, отвечать на вопросы об аниме и помогать с выбором. " +
      "Пишите кратко, живо, структурировано. Используйте разметку markdown. Рекомендации должны содержать русские и оригинальные названия. " +
      "Отвечайте ВСЕГДА на русском языке. " +
      "ОБЯЗАТЕЛЬНОЕ ТРЕБОВАНИЕ: Для каждого рекомендуемого аниме вы должны добавить ссылку в чат в формате markdown: `[Русское название](/anime/ID)`, где ID — это реальный Shikimori ID этого аниме. " +
      "Пожалуйста, вспомните правильный Shikimori ID для рекомендуемого тайтла из вашей базы знаний (например: Атака титанов ID: 16498, Тетрадь смерти ID: 1535, Клинок рассекающий демонов ID: 38000, Ван-Пис ID: 21, Наруто ID: 20, Магическая битва ID: 40748, Токийский гуль ID: 22319, Евангелион ID: 30, Твоё имя ID: 32281, Унесённые призраками ID: 199, Код Гиас ID: 1575, Сага о Винланде ID: 37521, Хантер х Хантер 2011 ID: 11061, Госпожа Кагуя ID: 37999, Человек-бензопила ID: 44511, Твое апрельское вранье ID: 23273, Созданный в Бездне ID: 34599, Бездомный бог ID: 20507, Моб Психо 100 ID: 32182). " +
      "Никогда не указывайте внешние ссылки типа shikimori.one или другие домены, используйте только относительный путь `/anime/ID`.";
    
    if (deepseekKey) {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('DeepSeek API error:', errorText);
        throw new Error(`DeepSeek API returned error ${response.status}`);
      }
      
      const data = await response.json() as any;
      const text = data.choices?.[0]?.message?.content || 'Извините, произошла ошибка.';
      return c.json({ text });
    } else {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
      
      const formattedContents = messages.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: formattedContents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7
        }
      });
      
      return c.json({ text: response.text || 'Извините, произошла ошибка.' });
    }
  } catch (err: any) {
    console.error('AI Recommend API Error:', err);
    return c.json({ error: err.message || 'Ошибка сервера при получении рекомендаций.' }, 500);
  }
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
    
    // First fallback: desu.shikimori.one (often where images actually live now)
    if (!response.ok) {
      const desuUrl = `https://desu.shikimori.one/${imagePath}${c.req.url.includes('?') ? c.req.url.substring(c.req.url.indexOf('?')) : ''}`;
      response = await fetch(desuUrl, { headers });
    }

    // Second Fallback to Jikan API if Shikimori returns error (404, 403, etc.)
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

// Kodik direct stream decryptor and proxy
function convertChar(char: string, num: number): string {
  const alph = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const upper = char.toUpperCase();
  if (alph.includes(upper)) {
    const idx = (alph.indexOf(upper) + num) % alph.length;
    const ch = alph[idx];
    return char === char.toLowerCase() ? ch.toLowerCase() : ch;
  }
  return char;
}

function decodeKodikUrl(encoded: string, rotNum?: number): string {
  if (rotNum !== undefined) {
    const crypted = encoded.split('').map(c => convertChar(c, rotNum)).join('');
    const padding = (4 - (crypted.length % 4)) % 4;
    try {
      const decoded = atob(crypted + '='.repeat(padding));
      if (decoded.includes('mp4:hls:manifest')) return decoded;
    } catch {}
  }
  for (let rot = 0; rot < 26; rot++) {
    const crypted = encoded.split('').map(c => convertChar(c, rot)).join('');
    const padding = (4 - (crypted.length % 4)) % 4;
    try {
      const decoded = atob(crypted + '='.repeat(padding));
      if (decoded.includes('mp4:hls:manifest')) {
         return decoded;
      }
    } catch {}
  }
  throw new Error('Decryption of Kodik stream URL failed');
}

function getProxyOrigin(c: any): string {
  const proto = c.req.header('x-forwarded-proto') || 'http';
  const host = c.req.header('x-forwarded-host') || c.req.header('host') || 'localhost:3000';
  if (host.startsWith('http://') || host.startsWith('https://')) {
    return host;
  }
  return `${proto}://${host}`;
}

app.options('/api/proxy-4k', (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    }
  });
});

app.get('/api/proxy-4k', async (c) => {
  let targetUrl = c.req.query('url');
  const rawUrl = c.req.url;
  const urlIndex = rawUrl.indexOf('url=');
  if (urlIndex !== -1) {
    const extracted = rawUrl.substring(urlIndex + 4);
    try {
      targetUrl = decodeURIComponent(extracted);
    } catch (err) {
      targetUrl = c.req.query('url');
    }
  }

  if (!targetUrl) return c.text('Missing url parameter', 400);

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Referer': 'https://shikimori.one/'
      }
    });
    if (!res.ok) {
      return c.text(`Proxy failed with status ${res.status}`, res.status as any);
    }

    const contentType = res.headers.get('content-type') || '';
    
    if (contentType.includes('mpegurl') || contentType.includes('m3u8') || targetUrl.includes('.m3u8')) {
      const text = await res.text();
      
      // Validation: Ensure the playlist starts with #EXTM3U (not HTML error or blank page)
      if (!text || !text.trim().startsWith('#EXTM3U')) {
        console.error(`[PROXY-4K] Invalid M3U8 payload from target: ${targetUrl}. Res length: ${text?.length || 0}. Starts with:`, text ? text.slice(0, 500) : "empty");
        return new Response('Error: Proxy loaded an invalid M3U8 manifest. The source might be blocking or offline.', {
          status: 502,
          headers: {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*'
          }
        });
      }

      const parentUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      
      // Clean CRLF and split cleanly to avoid breaking tags
      const lines = text.replace(/\r/g, '').split('\n');
      const rewrittenLines = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        
        let absUrl = trimmed;
        if (!trimmed.startsWith('http')) {
          absUrl = trimmed.startsWith('/')
            ? new URL(trimmed, targetUrl).toString()
            : parentUrl + trimmed;
        }
        return `${getProxyOrigin(c)}/api/proxy-4k?url=${encodeURIComponent(absUrl)}`;
      });
      
      return new Response(rewrittenLines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'application/x-mpegURL',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'no-cache'
        }
      });
    }

    const arrayBuffer = await res.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'video/mp2t',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'public, max-age=86400'
      }
    });

  } catch (err: any) {
    return c.text(`Proxy Exception: ${err.message}`, 500);
  }
});

// Backward compatibility redirects for older/cached browsers calling /api/kodik/*
app.options('/api/kodik/:path+', (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    }
  });
});

app.get('/api/kodik/:path+', (c) => {
  const path = c.req.param('path');
  const qIndex = c.req.url.indexOf('?');
  const q = qIndex !== -1 ? c.req.url.substring(qIndex) : '';
  return c.redirect(`/api/media/${path}${q}`, 302);
});

app.options('/api/media/playlist', (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    }
  });
});

// Helper to extract nested json object matching key with balanced curly brackets
function extractBalancedObject(str: string): string {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let escape = false;
  let endIdx = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (escape) {
      escape = false;
      continue;
    }
    
    if (char === '\\') {
      escape = true;
      continue;
    }
    
    if ((char === '"' || char === "'") && !escape) {
      if (inString && stringChar === char) {
        inString = false;
      } else if (!inString) {
        inString = true;
        stringChar = char;
      }
    }
    
    if (!inString) {
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }
  }
  
  if (endIdx > 0) {
    return str.substring(0, endIdx);
  }
  return str;
}

async function getKodikSkipButtons(iframeUrl: string, html: string): Promise<any> {
  const match = html.match(/(?:skip_buttons|skipButtons)\s*[:=]\s*(\{[\s\S]*?\})/i);
  if (match) {
    try {
      const jsonStr = extractBalancedObject(match[1]);
      const data = JSON.parse(jsonStr);
      
      if (data && data.ajax && data.id) {
        const baseUrl = new URL(iframeUrl);
        const skipUrl = `${baseUrl.protocol}//${baseUrl.host}/skip_buttons`;
        
        const response = await fetch(skipUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': iframeUrl
          },
          body: new URLSearchParams({ id: String(data.id) }).toString()
        });
        
        if (response.ok) {
          const skipData = await response.json() as any;
          return skipData;
        } else {
          // GET fallback
          const getResponse = await fetch(`${skipUrl}?id=${data.id}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': iframeUrl
            }
          });
          if (getResponse.ok) {
            const skipData = await getResponse.json() as any;
            return skipData;
          }
        }
      } else if (data) {
        return data;
      }
    } catch {}
  }

  // Fallback match skip_buttons = { ... }
  const altMatch = html.match(/(?:skip_buttons|skipButtons)\s*=\s*(\{[\s\S]*?\})/i);
  if (altMatch) {
    try {
      const jsonStr = extractBalancedObject(altMatch[1]);
      return JSON.parse(jsonStr);
    } catch {}
  }
  return null;
}

app.options('/api/media/skip-timings', (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    }
  });
});

app.get('/api/media/skip-timings', async (c) => {
  const urlParam = c.req.query('url');
  if (!urlParam) {
    return c.json({ error: 'url parameter is required' }, 400);
  }
  try {
    let iframeUrl = urlParam.startsWith('//') ? `https:${urlParam}` : urlParam;
    iframeUrl = iframeUrl.replace(/(kodik\.info|kodik\.cc|kodik\.biz|kodik\.net|kodik\.tv|kodik\.club|kodik\.site|kodik\.space)/g, 'kodikplayer.com');
    const iframeRes = await fetch(iframeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Referer': 'https://shikimori.one/'
      }
    });
    if (!iframeRes.ok) {
      return c.json({ 
        error: 'Failed to load player page',
        normalized: {
          start: null,
          end: null,
          outro_start: null,
          outro_end: null
        }
      }, 200);
    }
    const html = await iframeRes.text();
    const skipButtons = await getKodikSkipButtons(iframeUrl, html);
    
    // Normalize response for frontend
    let normalized = {
      start: null as number | null,
      end: null as number | null,
      outro_start: null as number | null,
      outro_end: null as number | null
    };

    if (skipButtons) {
      if (typeof skipButtons.start === 'number' && typeof skipButtons.end === 'number') {
        normalized.start = skipButtons.start;
        normalized.end = skipButtons.end;
      }
      if (skipButtons.intro) {
        if (typeof skipButtons.intro.start === 'number') normalized.start = skipButtons.intro.start;
        else if (typeof skipButtons.intro.from === 'number') normalized.start = skipButtons.intro.from;
        
        if (typeof skipButtons.intro.end === 'number') normalized.end = skipButtons.intro.end;
        else if (typeof skipButtons.intro.to === 'number') normalized.end = skipButtons.intro.to;
      }
      if (skipButtons.outro) {
        if (typeof skipButtons.outro.start === 'number') normalized.outro_start = skipButtons.outro.start;
        else if (typeof skipButtons.outro.from === 'number') normalized.outro_start = skipButtons.outro.from;
        
        if (typeof skipButtons.outro.end === 'number') normalized.outro_end = skipButtons.outro.end;
        else if (typeof skipButtons.outro.to === 'number') normalized.outro_end = skipButtons.outro.to;
      }
    }

    return c.json({
      skip_buttons: skipButtons,
      normalized
    });
  } catch (err: any) {
    return c.json({ 
      error: err.message,
      normalized: {
        start: null,
        end: null,
        outro_start: null,
        outro_end: null
      }
    }, 200);
  }
});

app.options('/api/media/segment', (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    }
  });
});

app.get('/api/media/playlist', async (c) => {
  const urlParam = c.req.query('url');
  if (!urlParam) {
    return c.json({ error: 'url parameter is required' }, 400);
  }

  try {
    let iframeUrl = urlParam.startsWith('//') ? `https:${urlParam}` : urlParam;
    iframeUrl = iframeUrl.replace(/(kodik\.info|kodik\.cc|kodik\.biz|kodik\.net|kodik\.tv|kodik\.club|kodik\.site|kodik\.space)/g, 'kodikplayer.com');
    console.log(`[KODIK PROXY] Extracting playlist from: ${iframeUrl}`);

    // 1. Fetch iframe page
    const iframeRes = await fetch(iframeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Referer': 'https://shikimori.one/'
      }
    });
    const html = await iframeRes.text();

    // 2. Extract parameters
    const urlParamsMatch = html.match(/urlParams\s*=\s*'([^']+)'/) || html.match(/urlParams\s*=\s*({[^;]+})/);
    const hashMatch = html.match(/\.hash\s*=\s*'([^']+)'/);
    const idMatch = html.match(/\.id\s*=\s*'([^']+)'/);
    const typeMatch = html.match(/\.type\s*=\s*'([^']+)'/);

    if (!urlParamsMatch || !hashMatch || !idMatch || !typeMatch) {
      console.error('[KODIK PROXY] Failed to parse iframe params');
      return c.json({ error: 'Failed to parse iframe parameters. Stream might be offline.' }, 500);
    }

    const urlParams = JSON.parse(urlParamsMatch[1]);
    const videoHash = hashMatch[1];
    const videoId = idMatch[1];
    const videoType = typeMatch[1];

    // Find script url (preferring serial/player minified js in assets)
    let scriptUrl = '';
    const scriptTagRegex = /<script\b[^>]*?\bsrc\s*=\s*["']([^"']+\.js[^"']*)["']/gi;
    let match;
    const candidateScripts: string[] = [];
    while ((match = scriptTagRegex.exec(html)) !== null) {
      candidateScripts.push(match[1]);
    }

    const assetScript = candidateScripts.find(s => s.includes('/assets/'));
    if (assetScript) {
      scriptUrl = assetScript;
    } else if (candidateScripts.length > 0) {
      scriptUrl = candidateScripts[0];
    }

    if (!scriptUrl) {
      const inlineJsMatch = html.match(/["'](\/assets\/js\/app\.[^"']+\.js)["']/);
      if (inlineJsMatch) {
        scriptUrl = inlineJsMatch[1];
      }
    }

    if (!scriptUrl) {
      scriptUrl = '/assets/js/app.serial.js'; // fallback
    }

    const baseUrlObj = new URL(iframeUrl);
    const scriptAbsoluteUrl = scriptUrl.startsWith('http') ? scriptUrl : `${baseUrlObj.protocol}//${baseUrlObj.host}${scriptUrl}`;

    // 3. Request script to get Gbox Ajax link
    const scriptRes = await fetch(scriptAbsoluteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': iframeUrl
      }
    });
    const scriptHtml = await scriptRes.text();

    const ajaxMatch = scriptHtml.match(/\$.ajax\([\s\S]*?url:\s*atob\("([^"]+)"\)/) || 
                      scriptHtml.match(/atob\("([^"'\(\)]+)"\)/);
    if (!ajaxMatch) {
      console.error('[KODIK PROXY] Gbox ajax match failed');
      return c.json({ error: 'Could not extract player API script' }, 500);
    }

    const gboxPath = atob(ajaxMatch[1]);
    const gboxUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${gboxPath}`;

    // 4. Request video links from gbox
    const payload = new URLSearchParams({
      hash: videoHash,
      id: videoId,
      type: videoType,
      d: urlParams.d || 'kodik.info',
      d_sign: urlParams.d_sign || '',
      pd: urlParams.pd || '',
      pd_sign: urlParams.pd_sign || '',
      ref: decodeURIComponent(urlParams.ref || ''),
      ref_sign: urlParams.ref_sign || '',
      bad_user: 'true',
      cdn_is_working: 'true'
    });

    const gboxRes = await fetch(gboxUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': iframeUrl
      },
      body: payload.toString()
    });

    const gboxData = await gboxRes.json() as any;
    if (!gboxData || !gboxData.links) {
      console.error('[KODIK PROXY] Gbox returned no links', gboxData);
      return new Response('Error: Failed to retrieve stream links from Kodik', {
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 5. Build dynamic Master Playlist or yield single-quality playlist based on query parameters
    const targetQuality = c.req.query('quality');
    const qualities = Object.keys(gboxData.links).map(Number).sort((a,b) => b - a); // descending quality: 720, 480, 360

    if (!targetQuality && qualities.length > 1) {
      console.log(`[KODIK PROXY] Building Master Playlist for available qualities: ${qualities.join(', ')}`);
      const masterLines = ['#EXTM3U', '#EXT-X-VERSION:3'];
      
      qualities.forEach(q => {
        let width = 1280, height = 720, bandwidth = 2200000;
        if (q === 480) {
          width = 854; height = 480; bandwidth = 1100000;
        } else if (q === 360) {
          width = 640; height = 360; bandwidth = 600000;
        } else if (q === 1080) {
          width = 1920; height = 1080; bandwidth = 4500000;
        }
        
        masterLines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${height},NAME="${q}p"`);
        masterLines.push(`/api/media/playlist?url=${encodeURIComponent(iframeUrl)}&quality=${q}`);
      });

      return new Response(masterLines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'application/x-mpegURL',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      });
    }

    const selectedQual = targetQuality || String(qualities[0] || 720);
    const listSources = gboxData.links[selectedQual] || gboxData.links[String(qualities[0] || 720)];
    if (!listSources || listSources.length === 0) {
      return new Response('Error: No video stream matches found for target quality', {
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const rawSrc = listSources[0].src;
    // Decrypt the URL if it doesn't already contain manifest
    const decryptedUrl = rawSrc.includes('mp4:hls:manifest') ? rawSrc : decodeKodikUrl(rawSrc);
    const playlistUrl = decryptedUrl.startsWith('//') ? `https:${decryptedUrl}` : decryptedUrl;

    console.log(`[KODIK PROXY] Fetched decrypted stream. Base HLS: ${playlistUrl}`);

    // 6. Fetch the actual M3U8 file contents
    const m3u8Res = await fetch(playlistUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://kodik.info/'
      }
    });

    if (!m3u8Res.ok) {
      console.error(`[KODIK PROXY] Failed to fetch M3U8, status: ${m3u8Res.status}`);
      return new Response(`Error: Kodik manifest loading failed with status ${m3u8Res.status}`, {
        status: m3u8Res.status,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const m3u8Text = await m3u8Res.text();

    // Validation: Ensure the playlist starts with #EXTM3U (not HTML error or blank page)
    if (!m3u8Text || !m3u8Text.trim().startsWith('#EXTM3U')) {
      console.error(`[KODIK PROXY ERROR] Manifest from Kodik is empty or invalid. Res length: ${m3u8Text?.length || 0}. Starts with:`, m3u8Text ? m3u8Text.slice(0, 500) : "empty");
      return new Response('Error: Proxy loaded an invalid M3U8 manifest from Kodik. The source might be blocking or offline.', {
        status: 502,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        }
      });
    }

    // 7. Rewrite chunk entries in M3U8
    const m3u8Base = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1);
    
    // Clean CRLF and split cleanly to avoid breaking tags
    const lines = m3u8Text.replace(/\r/g, '').split('\n');
    const proxyUrlBase = `${getProxyOrigin(c)}/api/media/segment?url=`;

    const rewrittenLines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return line;
      }
      
      // Resolve path
      let absSegmentUrl = trimmed;
      if (!trimmed.startsWith('http')) {
        absSegmentUrl = trimmed.startsWith('/') 
          ? new URL(trimmed, playlistUrl).toString()
          : m3u8Base + trimmed;
      }

      // Add segment proxy URL
      return `${proxyUrlBase}${encodeURIComponent(absSegmentUrl)}`;
    });

    const rewrittenText = rewrittenLines.join('\n');

    return new Response(rewrittenText, {
       status: 200,
       headers: {
         'Content-Type': 'application/x-mpegURL',
         'Access-Control-Allow-Origin': '*',
         'Access-Control-Allow-Methods': 'GET, OPTIONS',
         'Access-Control-Allow-Headers': '*',
         'Cache-Control': 'no-cache, no-store, must-revalidate',
       }
    });

  } catch (error: any) {
    console.error('[KODIK PROXY ERROR]', error);
    return new Response('Error: Failed to compile streaming proxy playlist. ' + error.message, {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      }
    });
  }
});

app.get('/api/media/segment', async (c) => {
  let segmentUrl = c.req.query('url');
  const rawUrl = c.req.url;
  const urlIndex = rawUrl.indexOf('url=');
  if (urlIndex !== -1) {
    const extracted = rawUrl.substring(urlIndex + 4);
    try {
      segmentUrl = decodeURIComponent(extracted);
    } catch (err) {
      segmentUrl = c.req.query('url');
    }
  }

  if (!segmentUrl) {
    return c.json({ error: 'No segment URL provided' }, 400);
  }

  try {
    const segmentUrlObj = new URL(segmentUrl);
    const referer = `https://${segmentUrlObj.host}/` || 'https://kodik.info/';

    const response = await fetch(segmentUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Referer': referer,
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
       return new Response(`Error fetching segment: ${response.status}`, { status: response.status });
    }

    const arrayBuffer = await response.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'video/mp2t',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      }
    });
  } catch (e: any) {
    console.error('[KODIK SEGMENT PROXY EXCEPTION]', e);
    return c.json({ error: 'Segment proxy fetch failed: ' + e.message }, 500);
  }
});

// SPA Fallback
app.get('*', serveStatic({ root: './dist' }));

const isProd = process.env.NODE_ENV === 'production';
const port = 3000;

console.log(`[HONO NODE SERVER] Starting backend listener on port ${port}...`);
serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0'
});

export default {
  fetch: app.fetch,
};
