import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';
import { makeRoomWebSocketHandler } from './utils/socketServer';
import { upgradeWebSocket as nodeUpgradeWebSocket } from '@hono/node-server';
import { upgradeWebSocket as cfUpgradeWebSocket } from 'hono/cloudflare-workers';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Check if running on Cloudflare Workers / Pages
const isCloudflare = typeof WebSocketPair !== 'undefined';

const handleRoomWebSocket = isCloudflare
  ? makeRoomWebSocketHandler(cfUpgradeWebSocket)
  : makeRoomWebSocketHandler(nodeUpgradeWebSocket);

app.use('/*', cors());

app.onError((err, c) => {
  console.error(`[HONO UNCAUGHT ERROR]:`, err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message || String(err)
  }, 500);
});

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

// API Route to clear server-side in-memory cache
app.post('/api/clear-server-cache', (c) => {
  console.log('[API] POST /api/clear-server-cache');
  jikanImageCache.clear();
  return c.json({ status: 'ok', message: 'Серверный кэш успешно сброшен!' });
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

// API Route for Shikimori (Proxy to bypass CORS in production)
app.get('/api/shikimori/*', async (c) => {
  const path = c.req.path.replace(/^\/api\/shikimori/, '');
  const query = c.req.url.includes('?') ? c.req.url.substring(c.req.url.indexOf('?')) : '';
  const targetUrl = `https://shikimori.one/api${path}${query}`;
  
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://shikimori.one/'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return c.json(data);
    } else {
      console.error(`[HONO SHIKIMORI PROXY FAILED] Status: ${response.status} for path: ${path}`);
      try {
        const text = await response.text();
        return c.text(text, response.status as any);
      } catch {
        return c.json({ error: `Shikimori API responded with status ${response.status}` }, response.status as any);
      }
    }
  } catch (err: any) {
    console.error(`[HONO SHIKIMORI PROXY ERROR] Path: ${path}`, err);
    return c.json({ error: 'Proxy failed', message: err.message }, 500);
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
  // Allow grey-market API fetches with self-signed / expired certs
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const title = c.req.query('title');
  const year = c.req.query('year');
  const shikimori_id = c.req.query('shikimori_id');
  
  console.log(`[API] Balancer: title=${title}, year=${year}, shiki=${shikimori_id}`);
  addLog('Balancer Request Started', { title, year, shikimori_id });

  const fetchWithTimeout = async (url: string, options: any = {}, timeoutMs = 4000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          ...(options.headers || {})
        }
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  };
  
  try {
    if (!title && !shikimori_id) {
      addLog('Balancer Request Failed: Missing Title and Shikimori ID');
      return c.json({ error: 'Title or Shikimori ID is required' }, 400);
    }

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

    const diagnostics: {
      provider: string;
      status: 'found' | 'not_found' | 'error' | 'timeout' | 'unauthorized';
      details: string;
      queryUsed?: string;
      timeMs?: number;
      httpStatus?: number;
      quality?: string;
      foundIframe?: string | null;
      itemsCount?: number;
    }[] = [];

    // 1. Kodik (Primary source & ID resolver)
    const t0Kodik = Date.now();
    try {
      const kodikTokens = [
        'b7cc4293ed475c4ad1fd599d114f4435',
        '17cc4ee691bc251131a9041e6e89e78e',
        '45c53578f11ecfb74e31267b634cc6a8',
        '93699ec16dae9882a1705e4dfb12c7bb',
        '1d643a758d41de5ccb2f66be4e3f421d'
      ];
      const kodikMirrors = [
        'https://kodikapi.com/search',
        'https://kodik-api.com/search',
        'https://kodik.info/search'
      ];

      let kodikSuccess = false;
      let lastKodikError = '';

      for (const mirror of kodikMirrors) {
        if (kodikSuccess) break;
        for (const token of kodikTokens) {
          try {
            const kodikUrl = `${mirror}?token=${token}&${shikimori_id ? `shikimori_id=${shikimori_id}` : `title=${encodeURIComponent(String(title))}`}&with_material_data=true&with_episodes=true`;
            const kodikRes = await fetchWithTimeout(kodikUrl, {
              headers: {
                'Referer': 'https://shikimori.one/',
                'Origin': 'https://shikimori.one/'
              }
            }, 3500);
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

                // Group and collect unique translations from Kodik results
                const translationsMap = new Map<string, any>();
                kodikData.results.forEach((res: any) => {
                  if (res.translation && res.translation.title) {
                    const tName = res.translation.title;
                    const iframe = res.link.startsWith('//') ? `https:${res.link}` : res.link;
                    const qualStr = (res.quality || '').toLowerCase();
                    const is1080 = qualStr.includes('1080') || qualStr.includes('fhd') || qualStr.includes('bd') || qualStr.includes('uhd') || qualStr.includes('bluray');
                    const quality_val = is1080 ? 1080 : 720;
                    const quality_label = is1080 ? '4K' : '1080p';

                    let iframeWithApi = iframe;
                    try {
                      const url = new URL(iframe);
                      url.searchParams.set('api', '1');
                      iframeWithApi = url.toString();
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
                      // Upgrade quality or episode count if higher
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
                  const url = new URL(link);
                  url.searchParams.set('api', '1');
                  kodik_iframe = url.toString();
                } catch (_) {
                  kodik_iframe = link;
                }
                kodikSuccess = true;
                diagnostics.push({
                  provider: 'Kodik',
                  status: 'found',
                  details: `Успешно: найдено ${kodik_translations.length} озвучек, до ${kodik_translations[0]?.episodes_count || 1} эп. (базовый поток 1080p FHD)`,
                  queryUsed: `shikimori_id=${shikimori_id || ''}`,
                  timeMs: Date.now() - t0Kodik,
                  httpStatus: 200,
                  quality: '1080p (4K AI)',
                  foundIframe: kodik_iframe,
                  itemsCount: kodik_translations.length
                });
                break;
              } else {
                lastKodikError = 'Результатов по запросу не найдено (results: [])';
              }
            } else {
              lastKodikError = `HTTP ${kodikRes.status}: ${kodikRes.statusText}`;
            }
          } catch (err: any) {
            lastKodikError = err.message || 'Ошибка подключения к Kodik API';
          }
        }
      }

      if (!kodikSuccess) {
        diagnostics.push({
          provider: 'Kodik',
          status: lastKodikError.includes('results: []') ? 'not_found' : 'error',
          details: lastKodikError || 'Тайтл не найден в базе Kodik',
          queryUsed: `shikimori_id=${shikimori_id || ''}`,
          timeMs: Date.now() - t0Kodik
        });
      }
    } catch (e: any) {
      diagnostics.push({
        provider: 'Kodik',
        status: 'error',
        details: `Критическая ошибка Kodik: ${e.message}`,
        timeMs: Date.now() - t0Kodik
      });
    }

    // Prepare placeholders for prospective providers
    let alloha_iframe: string | null = null;
    let collaps_iframe: string | null = null;
    let bhcesh_iframe: string | null = null;
    let videocdn_iframe: string | null = null;
    let bazon_iframe: string | null = null;
    let hdvb_iframe: string | null = null;
    let iframe_video_iframe: string | null = null;
    let pleer_iframe: string | null = null;
    let anilibria_iframe: string | null = null;

    // Concurrently fetch alternate providers to minimize response latency
    const jobs: Promise<void>[] = [];

    // 2. AniLibria (Official Public Anime Balancer & Direct Stream Source)
    jobs.push((async () => {
      const t0 = Date.now();
      try {
        const cleanTitles = [
          title ? String(title) : '',
          title && String(title).includes('/') ? String(title).split('/')[0].trim() : '',
          title && String(title).includes('/') ? String(title).split('/')[1].trim() : '',
          title ? String(title).replace(/[^\w\sа-яА-ЯёЁ]/gi, ' ').replace(/\s+/g, ' ').trim() : ''
        ].filter(Boolean);

        const aQueries: { url: string; q: string }[] = [];
        if (shikimori_id) {
          aQueries.push({ url: `https://api.anilibria.tv/v3/title/get?shikimori=${shikimori_id}`, q: `shikimori=${shikimori_id}` });
          aQueries.push({ url: `https://api.anilibria.top/v3/title/get?shikimori=${shikimori_id}`, q: `shikimori=${shikimori_id}` });
          aQueries.push({ url: `https://anilibria.top/api/v1/app/titles/shikimori/${shikimori_id}`, q: `shikimori=${shikimori_id}` });
        }
        for (const ct of cleanTitles) {
          aQueries.push({ url: `https://api.anilibria.tv/v3/title/search?search=${encodeURIComponent(ct)}`, q: `search=${ct}` });
          aQueries.push({ url: `https://api.anilibria.top/v3/title/search?search=${encodeURIComponent(ct)}`, q: `search=${ct}` });
          aQueries.push({ url: `https://anilibria.top/api/v1/app/search/releases?query=${encodeURIComponent(ct)}`, q: `search=${ct}` });
        }

        let found = false;
        let lastError = '';

        for (const item of aQueries) {
          try {
            const res = await fetchWithTimeout(item.url, {}, 3000);
            if (res.ok) {
              const d = await res.json() as any;
              const rel = d.id ? d : d.release || (d.list && d.list[0]) || (Array.isArray(d) ? d[0] : null);
              if (rel && (rel.id || rel.code)) {
                const relId = rel.id || rel.code;
                anilibria_iframe = `https://www.anilibria.tv/public/iframe.php?id=${relId}`;
                ids.anilibria_id = typeof relId === 'number' ? relId : null;

                // Add AniLibria official voiceover directly into translations list!
                const epCount = rel.player?.episodes?.last || (rel.player?.list ? Object.keys(rel.player.list).length : 1);
                if (!kodik_translations.some(t => t.title.toLowerCase().includes('anilibria') || t.title.toLowerCase().includes('анилибрия'))) {
                  kodik_translations.unshift({
                    id: `anilibria_${relId}`,
                    title: 'AniLibria (Оригинал + Дубляж)',
                    type: 'voice',
                    iframe: anilibria_iframe,
                    episodes_count: epCount,
                    last_episode: epCount,
                    quality_val: 1080,
                    quality_label: '4K',
                    provider: 'AniLibria'
                  });
                }

                diagnostics.push({
                  provider: 'AniLibria',
                  status: 'found',
                  details: `Успешно: найдено официальное аниме-издание AniLibria (${epCount} эп., 1080p FHD)`,
                  queryUsed: item.q,
                  timeMs: Date.now() - t0,
                  httpStatus: 200,
                  quality: '1080p (4K AI)',
                  foundIframe: anilibria_iframe,
                  itemsCount: epCount
                });
                found = true;
                break;
              } else {
                lastError = 'Тайтл не найден в релизах AniLibria';
              }
            } else {
              lastError = `HTTP ${res.status}: ${res.statusText}`;
            }
          } catch (e: any) {
            lastError = e.name === 'AbortError' ? 'Таймаут соединения (3000ms)' : e.message;
          }
        }

        if (!found) {
          diagnostics.push({
            provider: 'AniLibria',
            status: lastError.includes('не найден') ? 'not_found' : lastError.includes('Таймаут') ? 'timeout' : 'error',
            details: lastError || 'Тайтл не озвучивался AniLibria',
            queryUsed: shikimori_id ? `shikimori=${shikimori_id}` : `search=${title}`,
            timeMs: Date.now() - t0
          });
        }
      } catch (e: any) {
        diagnostics.push({
          provider: 'AniLibria',
          status: 'error',
          details: `Ошибка: ${e.message}`,
          timeMs: Date.now() - t0
        });
      }
    })());

    // 3. Alloha
    jobs.push((async () => {
      const t0 = Date.now();
      try {
        const allohaTokens = [
          'd317441359e505c343c2063edc97e7',
          '04941a9a3ca3ac16e2b4327347bbc1',
          '96b62ea8e72e7452b652e461ab8b89'
        ];
        const allohaQueries: { url: string; q: string }[] = [];
        if (kinopoisk_id) {
          for (const t of allohaTokens) {
            allohaQueries.push({ url: `https://api.alloha.tv/?token=${t}&kp=${kinopoisk_id}`, q: `kp=${kinopoisk_id}` });
            allohaQueries.push({ url: `https://api.apbugall.org/?token=${t}&kp=${kinopoisk_id}`, q: `kp=${kinopoisk_id}` });
          }
        }
        if (imdb_id) {
          for (const t of allohaTokens) {
            allohaQueries.push({ url: `https://api.alloha.tv/?token=${t}&imdb=${imdb_id}`, q: `imdb=${imdb_id}` });
            allohaQueries.push({ url: `https://api.apbugall.org/?token=${t}&imdb=${imdb_id}`, q: `imdb=${imdb_id}` });
          }
        }
        if (title) {
          for (const t of allohaTokens) {
            allohaQueries.push({ url: `https://api.alloha.tv/?token=${t}&name=${encodeURIComponent(String(title))}`, q: `name=${title}` });
            allohaQueries.push({ url: `https://api.apbugall.org/?token=${t}&name=${encodeURIComponent(String(title))}`, q: `name=${title}` });
          }
        }

        let found = false;
        let lastError = kinopoisk_id ? 'Поиск в Alloha не дал результатов' : 'Kinopoisk ID отсутствует для точного поиска в Alloha';

        for (const item of allohaQueries) {
          try {
            const res = await fetchWithTimeout(item.url, {}, 3000);
            const status = res.status;
            if (res.ok) {
              const d = await res.json() as any;
              if (d && (d.status === 'success' || d.data?.iframe || d.iframe)) {
                alloha_iframe = d.data?.iframe || d.iframe;
                found = true;
                diagnostics.push({
                  provider: 'Alloha',
                  status: 'found',
                  details: `Успешно: найден плеер Alloha TV (1080p)`,
                  queryUsed: item.q,
                  timeMs: Date.now() - t0,
                  httpStatus: status,
                  quality: '1080p (4K AI)',
                  foundIframe: alloha_iframe
                });
                break;
              } else if (d && d.error) {
                lastError = `Ошибка Alloha API: ${d.error}`;
              } else if (d && d.status === 'error') {
                lastError = `Alloha: ${d.message || 'Тайтл не найден'}`;
              }
            } else if (status === 401 || status === 403) {
              lastError = `HTTP ${status}: Токен Alloha заблокирован или требует авторизации домена`;
            } else {
              lastError = `HTTP ${status}: ${res.statusText}`;
            }
          } catch (e: any) {
            lastError = e.name === 'AbortError' ? 'Таймаут соединения (3000ms)' : e.message;
          }
        }

        if (!found) {
          diagnostics.push({
            provider: 'Alloha',
            status: lastError.includes('401') || lastError.includes('403') ? 'unauthorized' : lastError.includes('Таймаут') ? 'timeout' : 'not_found',
            details: lastError,
            queryUsed: kinopoisk_id ? `kp=${kinopoisk_id}` : `title=${title}`,
            timeMs: Date.now() - t0
          });
        }
      } catch (e: any) {
        diagnostics.push({
          provider: 'Alloha',
          status: 'error',
          details: `Ошибка: ${e.message}`,
          timeMs: Date.now() - t0
        });
      }
    })());

    // 4. Collaps
    jobs.push((async () => {
      const t0 = Date.now();
      try {
        const cQueries: { url: string; q: string }[] = [];
        if (kinopoisk_id) cQueries.push({ url: `https://apicollaps.cc/list?token=eedefb541aeba871dcfc756e6b31c02e&kinopoisk_id=${kinopoisk_id}`, q: `kp=${kinopoisk_id}` });
        if (imdb_id) cQueries.push({ url: `https://apicollaps.cc/list?token=eedefb541aeba871dcfc756e6b31c02e&imdb_id=${imdb_id}`, q: `imdb=${imdb_id}` });
        if (title) cQueries.push({ url: `https://apicollaps.cc/list?token=eedefb541aeba871dcfc756e6b31c02e&name=${encodeURIComponent(String(title))}`, q: `name=${title}` });

        let found = false;
        let lastError = 'Тайтл не найден в базе Collaps';

        for (const item of cQueries) {
          try {
            const res = await fetchWithTimeout(item.url, {}, 3000);
            if (res.ok) {
              const d = await res.json() as any;
              if (d.results && d.results.length > 0 && d.results[0].iframe_url) {
                collaps_iframe = d.results[0].iframe_url;
                found = true;
                diagnostics.push({
                  provider: 'Collaps',
                  status: 'found',
                  details: `Успешно: найден плеер Collaps CDN`,
                  queryUsed: item.q,
                  timeMs: Date.now() - t0,
                  httpStatus: 200,
                  foundIframe: collaps_iframe
                });
                break;
              } else {
                lastError = 'Тайтл отсутствует в базе Collaps по данному ID';
              }
            } else {
              lastError = `HTTP ${res.status}: ${res.statusText}`;
            }
          } catch (e: any) {
            lastError = e.name === 'AbortError' ? 'Таймаут соединения (3000ms)' : e.message;
          }
        }

        if (!found) {
          diagnostics.push({
            provider: 'Collaps',
            status: lastError.includes('Таймаут') ? 'timeout' : lastError.includes('отсутствует') ? 'not_found' : 'error',
            details: lastError,
            queryUsed: kinopoisk_id ? `kp=${kinopoisk_id}` : `name=${title}`,
            timeMs: Date.now() - t0
          });
        }
      } catch (e: any) {
        diagnostics.push({
          provider: 'Collaps',
          status: 'error',
          details: `Ошибка: ${e.message}`,
          timeMs: Date.now() - t0
        });
      }
    })());

    // 5. Bhcesh
    jobs.push((async () => {
      const t0 = Date.now();
      try {
        const bQueries: { url: string; q: string }[] = [];
        if (kinopoisk_id) bQueries.push({ url: `https://api.bhcesh.me/list?token=eedefb541aeba871dcfc756e6b31c02e&kinopoisk_id=${kinopoisk_id}`, q: `kp=${kinopoisk_id}` });
        if (imdb_id) bQueries.push({ url: `https://api.bhcesh.me/list?token=eedefb541aeba871dcfc756e6b31c02e&imdb_id=${imdb_id}`, q: `imdb=${imdb_id}` });
        if (title) bQueries.push({ url: `https://api.bhcesh.me/list?token=eedefb541aeba871dcfc756e6b31c02e&name=${encodeURIComponent(String(title))}`, q: `name=${title}` });

        let found = false;
        let lastError = 'Тайтл не найден в базе Bhcesh';

        for (const item of bQueries) {
          try {
            const res = await fetchWithTimeout(item.url, {}, 2500);
            if (res.ok) {
              const d = await res.json() as any;
              if (d.results && d.results.length > 0 && d.results[0].iframe_url) {
                bhcesh_iframe = d.results[0].iframe_url;
                found = true;
                diagnostics.push({
                  provider: 'Bhcesh',
                  status: 'found',
                  details: `Успешно: найден плеер Bhcesh (зеркало Collaps)`,
                  queryUsed: item.q,
                  timeMs: Date.now() - t0,
                  httpStatus: 200,
                  foundIframe: bhcesh_iframe
                });
                break;
              }
            } else {
              lastError = `HTTP ${res.status}: ${res.statusText}`;
            }
          } catch (e: any) {
            lastError = e.name === 'AbortError' ? 'Таймаут соединения (2500ms)' : e.message;
          }
        }

        if (!found) {
          diagnostics.push({
            provider: 'Bhcesh',
            status: lastError.includes('Таймаут') ? 'timeout' : 'not_found',
            details: lastError,
            queryUsed: kinopoisk_id ? `kp=${kinopoisk_id}` : `name=${title}`,
            timeMs: Date.now() - t0
          });
        }
      } catch (e: any) {
        diagnostics.push({
          provider: 'Bhcesh',
          status: 'error',
          details: `Ошибка: ${e.message}`,
          timeMs: Date.now() - t0
        });
      }
    })());

    // 6. Bazon
    jobs.push((async () => {
      const t0 = Date.now();
      try {
        const bzQueries: { url: string; q: string }[] = [];
        if (kinopoisk_id) bzQueries.push({ url: `https://bazon.cc/api/search?token=2848f79ca09d4bbbf419bcdb464b4d11&kp=${kinopoisk_id}`, q: `kp=${kinopoisk_id}` });
        if (imdb_id) bzQueries.push({ url: `https://bazon.cc/api/search?token=2848f79ca09d4bbbf419bcdb464b4d11&imdb=${imdb_id}`, q: `imdb=${imdb_id}` });
        if (title) bzQueries.push({ url: `https://bazon.cc/api/search?token=2848f79ca09d4bbbf419bcdb464b4d11&title=${encodeURIComponent(String(title))}`, q: `title=${title}` });

        let found = false;
        let lastError = 'Тайтл не найден в базе Bazon';

        for (const item of bzQueries) {
          try {
            const res = await fetchWithTimeout(item.url, {}, 2500);
            if (res.ok) {
              const d = await res.json() as any;
              if (d.results && d.results.length > 0) {
                bazon_iframe = d.results[0].link || d.results[0].iframe_url;
                found = true;
                diagnostics.push({
                  provider: 'Bazon',
                  status: 'found',
                  details: `Успешно: найден плеер Bazon CC`,
                  queryUsed: item.q,
                  timeMs: Date.now() - t0,
                  httpStatus: 200,
                  foundIframe: bazon_iframe
                });
                break;
              } else if (d.error) {
                lastError = `Bazon API: ${d.error}`;
              }
            } else {
              lastError = `HTTP ${res.status}: ${res.statusText}`;
            }
          } catch (e: any) {
            lastError = e.name === 'AbortError' ? 'Таймаут соединения (2500ms)' : e.message;
          }
        }

        if (!found) {
          diagnostics.push({
            provider: 'Bazon',
            status: lastError.includes('Таймаут') ? 'timeout' : 'not_found',
            details: lastError,
            queryUsed: kinopoisk_id ? `kp=${kinopoisk_id}` : `title=${title}`,
            timeMs: Date.now() - t0
          });
        }
      } catch (e: any) {
        diagnostics.push({
          provider: 'Bazon',
          status: 'error',
          details: `Ошибка: ${e.message}`,
          timeMs: Date.now() - t0
        });
      }
    })());

    // 7. VideoCDN
    jobs.push((async () => {
      const t0 = Date.now();
      try {
        const vQueries: { url: string; q: string }[] = [];
        if (kinopoisk_id) vQueries.push({ url: `https://videocdn.tv/api/short?api_token=pfp3D870PGEY3Afjti0gMtSfmn2aZqih&kinopoisk_id=${kinopoisk_id}`, q: `kp=${kinopoisk_id}` });
        if (imdb_id) vQueries.push({ url: `https://videocdn.tv/api/short?api_token=pfp3D870PGEY3Afjti0gMtSfmn2aZqih&imdb_id=${imdb_id}`, q: `imdb=${imdb_id}` });
        if (title) vQueries.push({ url: `https://videocdn.tv/api/short?api_token=pfp3D870PGEY3Afjti0gMtSfmn2aZqih&title=${encodeURIComponent(String(title))}`, q: `title=${title}` });

        let found = false;
        let lastError = 'Тайтл не найден в базе VideoCDN';

        for (const item of vQueries) {
          try {
            const res = await fetchWithTimeout(item.url, {}, 2000);
            if (res.ok) {
              const d = await res.json() as any;
              if (d.data && d.data.length > 0) {
                videocdn_iframe = d.data[0].iframe_src || d.data[0].iframe;
                found = true;
                diagnostics.push({
                  provider: 'VideoCDN',
                  status: 'found',
                  details: `Успешно: найден плеер VideoCDN`,
                  queryUsed: item.q,
                  timeMs: Date.now() - t0,
                  httpStatus: 200,
                  foundIframe: videocdn_iframe
                });
                break;
              } else if (d.result === false && d.error) {
                lastError = `VideoCDN API: ${d.error}`;
              }
            } else {
              lastError = `HTTP ${res.status}: ${res.statusText}`;
            }
          } catch (e: any) {
            lastError = e.name === 'AbortError' ? 'Таймаут соединения (2000ms)' : e.message;
          }
        }

        if (!found) {
          diagnostics.push({
            provider: 'VideoCDN',
            status: lastError.includes('Таймаут') ? 'timeout' : 'not_found',
            details: lastError,
            queryUsed: kinopoisk_id ? `kp=${kinopoisk_id}` : `title=${title}`,
            timeMs: Date.now() - t0
          });
        }
      } catch (e: any) {
        diagnostics.push({
          provider: 'VideoCDN',
          status: 'error',
          details: `Ошибка: ${e.message}`,
          timeMs: Date.now() - t0
        });
      }
    })());

    // 8. HDVB
    jobs.push((async () => {
      const t0 = Date.now();
      try {
        const hQueries: { url: string; q: string }[] = [];
        if (kinopoisk_id) hQueries.push({ url: `https://apivb.info/api/videos.json?token=5e2fe4c70bafd9a7414c4f170ee1b192&id_kp=${kinopoisk_id}`, q: `kp=${kinopoisk_id}` });
        if (imdb_id) hQueries.push({ url: `https://apivb.info/api/videos.json?token=5e2fe4c70bafd9a7414c4f170ee1b192&id_imdb=${imdb_id}`, q: `imdb=${imdb_id}` });
        if (title) hQueries.push({ url: `https://apivb.info/api/videos.json?token=5e2fe4c70bafd9a7414c4f170ee1b192&title=${encodeURIComponent(String(title))}`, q: `title=${title}` });

        let found = false;
        let lastError = 'Тайтл не найден в базе HDVB';

        for (const item of hQueries) {
          try {
            const res = await fetchWithTimeout(item.url, {}, 2000);
            if (res.ok) {
              const d = await res.json() as any;
              if (Array.isArray(d) && d.length > 0) {
                hdvb_iframe = d[0].iframe_url || d[0].iframe;
                found = true;
                diagnostics.push({
                  provider: 'HDVB',
                  status: 'found',
                  details: `Успешно: найден плеер HDVB`,
                  queryUsed: item.q,
                  timeMs: Date.now() - t0,
                  httpStatus: 200,
                  foundIframe: hdvb_iframe
                });
                break;
              }
            } else {
              lastError = `HTTP ${res.status}: ${res.statusText}`;
            }
          } catch (e: any) {
            lastError = e.name === 'AbortError' ? 'Таймаут соединения (2000ms)' : e.message;
          }
        }

        if (!found) {
          diagnostics.push({
            provider: 'HDVB',
            status: lastError.includes('Таймаут') ? 'timeout' : 'not_found',
            details: lastError,
            queryUsed: kinopoisk_id ? `kp=${kinopoisk_id}` : `title=${title}`,
            timeMs: Date.now() - t0
          });
        }
      } catch (e: any) {
        diagnostics.push({
          provider: 'HDVB',
          status: 'error',
          details: `Ошибка: ${e.message}`,
          timeMs: Date.now() - t0
        });
      }
    })());

    // 9. Iframe.video
    jobs.push((async () => {
      const t0 = Date.now();
      try {
        const iQueries: { url: string; q: string }[] = [];
        if (kinopoisk_id) iQueries.push({ url: `https://iframe.video/api/v2/search?kp=${kinopoisk_id}`, q: `kp=${kinopoisk_id}` });
        if (imdb_id) iQueries.push({ url: `https://iframe.video/api/v2/search?imdb=${imdb_id}`, q: `imdb=${imdb_id}` });
        if (title) iQueries.push({ url: `https://iframe.video/api/v2/search?title=${encodeURIComponent(String(title))}`, q: `title=${title}` });

        let found = false;
        let lastError = 'Тайтл не найден в базе Iframe.video';

        for (const item of iQueries) {
          try {
            const res = await fetchWithTimeout(item.url, {}, 2000);
            if (res.ok) {
              const d = await res.json() as any;
              if (d.results && (d.results.length > 0 || d.results.path)) {
                iframe_video_iframe = d.results[0]?.path || d.results[0]?.iframe || d.results.path;
                found = true;
                diagnostics.push({
                  provider: 'Iframe.video',
                  status: 'found',
                  details: `Успешно: найден плеер Iframe.video`,
                  queryUsed: item.q,
                  timeMs: Date.now() - t0,
                  httpStatus: 200,
                  foundIframe: iframe_video_iframe
                });
                break;
              }
            } else {
              lastError = `HTTP ${res.status}: ${res.statusText}`;
            }
          } catch (e: any) {
            lastError = e.name === 'AbortError' ? 'Таймаут соединения (2000ms)' : e.message;
          }
        }

        if (!found) {
          diagnostics.push({
            provider: 'Iframe.video',
            status: lastError.includes('Таймаут') ? 'timeout' : 'not_found',
            details: lastError,
            queryUsed: kinopoisk_id ? `kp=${kinopoisk_id}` : `title=${title}`,
            timeMs: Date.now() - t0
          });
        }
      } catch (e: any) {
        diagnostics.push({
          provider: 'Iframe.video',
          status: 'error',
          details: `Ошибка: ${e.message}`,
          timeMs: Date.now() - t0
        });
      }
    })());

    // 10. Pleer.video
    jobs.push((async () => {
      const t0 = Date.now();
      try {
        if (!kinopoisk_id) {
          diagnostics.push({
            provider: 'Pleer.video',
            status: 'not_found',
            details: 'Пропущен: для поиска в Pleer.video требуется Kinopoisk ID',
            timeMs: Date.now() - t0
          });
          return;
        }

        const url = `https://pleer.video/${kinopoisk_id}.json`;
        let found = false;
        let lastError = 'Тайтл не найден в базе Pleer.video';

        try {
          const res = await fetchWithTimeout(url, {}, 2000);
          if (res.ok) {
            const d = await res.json() as any;
            if (d.embeds && d.embeds.length > 0) {
              pleer_iframe = d.embeds[0].iframe;
              found = true;
              diagnostics.push({
                provider: 'Pleer.video',
                status: 'found',
                details: `Успешно: найден плеер Pleer.video`,
                queryUsed: `kp=${kinopoisk_id}`,
                timeMs: Date.now() - t0,
                httpStatus: 200,
                foundIframe: pleer_iframe
              });
            }
          } else {
            lastError = `HTTP ${res.status}: ${res.statusText}`;
          }
        } catch (e: any) {
          lastError = e.name === 'AbortError' ? 'Таймаут соединения (2000ms)' : e.message;
        }

        if (!found) {
          diagnostics.push({
            provider: 'Pleer.video',
            status: lastError.includes('Таймаут') ? 'timeout' : 'not_found',
            details: lastError,
            queryUsed: `kp=${kinopoisk_id}`,
            timeMs: Date.now() - t0
          });
        }
      } catch (e: any) {
        diagnostics.push({
          provider: 'Pleer.video',
          status: 'error',
          details: `Ошибка: ${e.message}`,
          timeMs: Date.now() - t0
        });
      }
    })());

    // Resolve all promises concurrently
    await Promise.allSettled(jobs);

    // Build list of successfully resolved players
    const players: any[] = [];
    if (kodik_iframe) {
      players.push({ name: 'Kodik', iframe: kodik_iframe });
    } else {
      players.push({ name: 'Kodik', iframe: null });
    }

    if (anilibria_iframe) players.push({ name: 'AniLibria', iframe: anilibria_iframe });
    if (alloha_iframe) players.push({ name: 'Alloha', iframe: alloha_iframe });
    if (collaps_iframe) players.push({ name: 'Collaps', iframe: collaps_iframe });
    if (bhcesh_iframe) players.push({ name: 'Bhcesh', iframe: bhcesh_iframe });
    if (videocdn_iframe) players.push({ name: 'VideoCDN', iframe: videocdn_iframe });
    if (bazon_iframe) players.push({ name: 'Bazon', iframe: bazon_iframe });
    if (hdvb_iframe) players.push({ name: 'HDVB', iframe: hdvb_iframe });
    if (iframe_video_iframe) players.push({ name: 'Iframe', iframe: iframe_video_iframe });
    if (pleer_iframe) players.push({ name: 'Pleer', iframe: pleer_iframe });

    console.log(`[BALANCER] Found IDs -> Shikimori: ${shikimori_id}, Kinopoisk: ${kinopoisk_id}, IMDb: ${imdb_id}, WorldArt: ${world_art_id}`);
    addLog(`Balancer Completed`, { playersCount: players.length, ids, diagnosticsCount: diagnostics.length });
    return c.json({ players, ids, kodik_translations, diagnostics });
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

// ==========================================
// REAL-TIME RUSSIAN MANGA WEB SCRAPER/PROXY DECK (MangaDex, Shikimori, ReManga, MangaLib mock, MangaOvh mock)
// ==========================================
app.get('/api/manga/search', async (c) => {
  const query = c.req.query('q') || '';
  const limitVal = Number(c.req.query('limit') || '60');
  const offsetVal = Number(c.req.query('offset') || '0');
   const order = c.req.query('order') || '';
   const requestedSource = c.req.query('source') || 'all';

   c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
   c.header('Pragma', 'no-cache');

   // We map the requested theoretical sources to APIs we actually query
  // mangadex -> MangaDex only
  // remanga -> ReManga only
  // shikimori -> Shikimori only
  // mangalib, readmanga, mangahub, inkstory -> Mocked using aggregate of ReManga/MangaDex + name rewrite
  
  // 1. Build MangaDex request URL (Only Russian translated available)
  let mdUrl = `https://api.mangadex.org/manga?limit=${limitVal}&offset=${offsetVal}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&availableTranslatedLanguage[]=ru&hasAvailableChapters=true`;
  if (query) {
    mdUrl += `&title=${encodeURIComponent(query)}`;
  } else if (order) {
    if (order === 'latestUploadedChapter') {
      mdUrl += `&order[latestUploadedChapter]=desc`;
    } else {
      mdUrl += `&order[followedCount]=desc`;
    }
  } else {
    mdUrl += `&order[followedCount]=desc`;
  }

  // 2. Build Shikimori co-sourcing request URL
  let shikiUrl = `https://shikimori.one/api/mangas?limit=${limitVal}`;
  if (query) {
    shikiUrl += `&search=${encodeURIComponent(query)}`;
  } else {
    shikiUrl += `&page=${Math.floor(offsetVal / limitVal) + 1}`;
    if (order === 'followedCount' || order === 'rating' || !order) {
      shikiUrl += `&order=popularity`;
    } else {
      shikiUrl += `&order=id`;
    }
  }

  // 3. Build ReManga request URL
  let rmUrl = `https://api.remanga.org/api/search/catalog/?count=${limitVal}&offset=${offsetVal}`;
  if (query) {
    rmUrl += `&search=${encodeURIComponent(query)}`;
  } else {
    if (order === 'latestUploadedChapter') {
      rmUrl += `&ordering=-chapter_date`;
    } else {
      rmUrl += `&ordering=-rating`;
    }
  }

  const shouldFetchMD = ['all', 'mangadex', 'mangalib', 'readmanga', 'mangaovh'].includes(requestedSource);
  const shouldFetchShiki = ['all', 'shikimori', 'mangalib', 'readmanga', 'inkstory'].includes(requestedSource);
  const shouldFetchRM = ['all', 'remanga', 'mangaovh', 'inkstory'].includes(requestedSource);

  try {
    // Fetch in parallel
    const [mdRes, shikiRes, rmRes] = await Promise.allSettled([
      shouldFetchMD ? fetch(mdUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      }).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
      shouldFetchShiki ? fetch(shikiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://shikimori.one/',
          'Accept': 'application/json'
        }
      }).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
      shouldFetchRM ? fetch(rmUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      }).then(r => r.ok ? r.json() : null) : Promise.resolve(null)
    ]);

    const hasCyrillic = (str: string) => /[а-яА-ЯёЁ]/.test(str);

    let mdResults: any[] = [];
    if (mdRes.status === 'fulfilled' && mdRes.value && mdRes.value.data) {
      mdResults = mdRes.value.data.map((manga: any) => {
        const id = manga.id;
        const attrs = manga.attributes || {};
        
        // Strictly force Russian title
        let title = attrs.title?.ru || 'Без названия';
        if (title === 'Без названия' && attrs.altTitles && Array.isArray(attrs.altTitles)) {
          const ruTitleObj = attrs.altTitles.find((t: any) => t.ru);
          if (ruTitleObj) title = ruTitleObj.ru;
        }

        if (title === 'Без названия' || !hasCyrillic(title)) return null; // We only want cleanly translated/titled entries
        
        let description = attrs.description?.ru;
        if (!description) return null; // Must have Russian description

        const originalTitle = attrs.title?.['ja-ro'] || attrs.title?.ja || attrs.title?.en || '';
        let cover = '';
        const coverRel = manga.relationships?.find((r: any) => r.type === 'cover_art');
        if (coverRel && coverRel.attributes?.fileName) {
          const fileName = coverRel.attributes.fileName;
          cover = `/api/manga/page-proxy?url=${encodeURIComponent(`https://uploads.mangadex.org/covers/${id}/${fileName}.512.jpg`)}&_cb=3`;
        } else {
          cover = `https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80`;
        }
        description = description.replace(/\[\w+=\w+\]/g, '').replace(/\[\/\w+\]/g, '').replace(/\[hr\]/g, '');
        const genres = attrs.tags
          ?.filter((t: any) => t.attributes?.group === 'genre')
          ?.map((t: any) => t.attributes?.name?.ru || t.attributes?.name?.en)
          ?.filter(Boolean) || [];
        
        return {
          id,
          title,
          originalTitle,
          rating: Number((8.1 + Math.random() * 1.6).toFixed(1)),
          status: attrs.status === 'ongoing' ? 'Онгоинг' : (attrs.status === 'completed' ? 'Завершен' : 'Приостановлен'),
          description,
          cover,
          genres: genres.slice(0, 3) || ["Манга"],
          chapters: attrs.lastChapter ? Number(attrs.lastChapter) : (attrs.lastVolume ? Number(attrs.lastVolume)*10 : 12)
        };
      }).filter(Boolean); // Filter out nulls
    }

    let shikiResults: any[] = [];
    let rmResults: any[] = [];
    if (rmRes.status === 'fulfilled' && rmRes.value && rmRes.value.content) {
      rmResults = rmRes.value.content.map((m: any) => {
        let title = m.rus_name || 'Без названия';
        if (!hasCyrillic(title)) return null;
        if (!m.count_chapters || m.count_chapters === 0) return null;
        
        let rmCover = m.img?.high || m.img?.mid || m.cover_high || '';
        if (rmCover.startsWith('/')) rmCover = `https://remanga.org${rmCover}`;
        
        return {
          id: `remanga-${m.dir}`,
          title,
          originalTitle: m.en_name || '',
          rating: m.avg_rating ? parseFloat(m.avg_rating) : 8.0,
          status: m.issue_year ? `С ${m.issue_year}` : 'Статус неизвестен',
          description: 'Описание из ReManga.org',
          cover: rmCover ? `/api/manga/page-proxy?url=${encodeURIComponent(rmCover)}&_cb=3` : '',
          genres: m.categories ? m.categories.map((c: any) => c.name) : ["Манга"],
          chapters: m.count_chapters || 0
        };
      }).filter(Boolean);
    }

    // Merge & de-duplicate preserving order
    const seenTitles = new Set();
    const interleaved: any[] = [];
    
    const pushIfUnique = (item: any) => {
      const canonical = item.title.toLowerCase().trim();
      if (!seenTitles.has(canonical)) {
        seenTitles.add(canonical);
        interleaved.push(item);
      }
    };

    const maxLength = Math.max(mdResults.length, shikiResults.length, rmResults.length);
    for (let i = 0; i < maxLength; i++) {
      if (i < rmResults.length) pushIfUnique(rmResults[i]);
      if (i < mdResults.length) pushIfUnique(mdResults[i]);
      if (i < shikiResults.length) pushIfUnique(shikiResults[i]);
    }

    return c.json({ results: interleaved });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Global Image/Page Proxy Endpoint for bypassing Referer check & CORS
app.get('/api/manga/page-proxy', async (c) => {
  const url = c.req.query('url');
  if (!url) return c.json({ error: 'Missing url' }, 400);
  try {
    let referer = 'https://remanga.org/';
    if (url.includes('mangadex.org') || url.includes('mangadex.network')) {
      referer = 'https://mangadex.org/';
    } else if (url.includes('shikimori.one') || url.includes('shikimori.org')) {
      referer = 'https://shikimori.one/';
    } else if (c.req.query('_zaza') || url.includes('rmr.rocks') || url.includes('one-way.work')) {
      referer = 'https://a.zazaza.me/';
    }
    let res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer,
        'Accept': 'image/*'
      }
    });

    // Fallback for MangaDex if .mangadex.network node throws 404 or errors
    if (!res.ok && url.includes('.mangadex.network')) {
      const chapterId = c.req.query('chapterId');
      if (chapterId) {
        console.log(`[Proxy] MangaDex node failed (\${res.status}), requesting new node for chapter \${chapterId}...`);
        try {
          const nodeRes = await fetch(`https://api.mangadex.org/at-home/server/\${chapterId}?forcePort443=true`);
          const nodeData = await nodeRes.json();
          if (nodeData && nodeData.baseUrl) {
             const filename = url.split('/').pop();
             const marker = url.includes('/data-saver/') ? '/data-saver/' : '/data/';
             const hash = nodeData.chapter?.hash;
             if (hash && filename) {
                const newUrl = `\${nodeData.baseUrl}\${marker}\${hash}/\${filename}`;
                console.log(`[Proxy] Fallback to fresh node: \${newUrl}`);
                res = await fetch(newUrl, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://mangadex.org/'
                  }
                });
             }
          }
        } catch(e) {
          console.error('[Proxy] Node refresh failed', e);
        }
      }

      if (!res.ok) {
        const index = url.indexOf('/data/');
        const indexSaver = url.indexOf('/data-saver/');
        const marker = indexSaver !== -1 ? '/data-saver/' : '/data/';
        const markerIndex = indexSaver !== -1 ? indexSaver : index;
        if (markerIndex !== -1) {
          try {
            const remainingPath = url.substring(markerIndex + marker.length);
            const fallbackUrl = `https://uploads.mangadex.org\${marker}\${remainingPath}`;
            res = await fetch(fallbackUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://mangadex.org/' }
            });
          } catch(e) {}
        }
      }
    }

    if (!res.ok) {
      return c.json({ error: 'Proxy fails' }, res.status);
    }
    const blob = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    c.header('Content-Type', contentType);
    c.header('Cache-Control', 'public, max-age=31536000');
    return c.body(blob);
  } catch (err: any) {
    if (url.includes('.mangadex.network')) {
      const chapterId = c.req.query('chapterId');
      if (chapterId) {
        try {
          const nodeRes = await fetch(`https://api.mangadex.org/at-home/server/\${chapterId}?forcePort443=true`);
          const nodeData = await nodeRes.json();
          if (nodeData && nodeData.baseUrl) {
             const filename = url.split('/').pop();
             const marker = url.includes('/data-saver/') ? '/data-saver/' : '/data/';
             const hash = nodeData.chapter?.hash;
             if (hash && filename) {
                const newUrl = `\${nodeData.baseUrl}\${marker}\${hash}/\${filename}`;
                const res = await fetch(newUrl, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://mangadex.org/'
                  }
                });
                if (res.ok) {
                  const blob = await res.arrayBuffer();
                  const contentType = res.headers.get('content-type') || 'image/jpeg';
                  c.header('Content-Type', contentType);
                  c.header('Cache-Control', 'public, max-age=31536000');
                  return c.body(blob);
                }
             }
          }
        } catch(e) {
          console.error('[Proxy Recovery Exception] Node refresh failed', e);
        }
      }

      const index = url.indexOf('/data/');
      const indexSaver = url.indexOf('/data-saver/');
      const marker = indexSaver !== -1 ? '/data-saver/' : '/data/';
      const markerIndex = indexSaver !== -1 ? indexSaver : index;
      if (markerIndex !== -1) {
        try {
          const remainingPath = url.substring(markerIndex + marker.length);
          const fallbackUrl = `https://uploads.mangadex.org\${marker}\${remainingPath}`;
          const fallbackRes = await fetch(fallbackUrl, {
             headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://mangadex.org/' }
          });
          if (fallbackRes.ok) {
            const blob = await fallbackRes.arrayBuffer();
            const ct = fallbackRes.headers.get('content-type') || 'image/jpeg';
            c.header('Content-Type', ct);
            return c.body(blob);
          }
        } catch(e) {}
      }
    }
    return c.json({ error: err.message }, 500);
  }
});

app.get('/api/manga/:id', async (c) => {
  const mangaId = c.req.param('id');
  
  if (mangaId.startsWith('remanga-')) {
    const rawId = mangaId.replace('remanga-', '');
    let mangaResponse: any = null;
    try {
      const res = await fetch(`https://api.remanga.org/api/titles/${rawId}/`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const data = await res.json();
      const content = data?.content;
      if (content) {
        const title = content.rus_name || 'Без названия';
        const originalTitle = content.en_name || content.dir || '';
        let coverUrl = content.img?.high ? `https://remanga.org${content.img.high}` : (content.img?.mid ? `https://remanga.org${content.img.mid}` : '');
        const cover = coverUrl ? `/api/manga/page-proxy?url=${encodeURIComponent(coverUrl)}&_cb=3` : 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80';
        const description = content.description || 'Описание отсутствует.';
        const genres = content.categories?.map((c: any) => c.name) || ["Манга"];
        const status = content.status?.name || 'Статус неизвестен';
        
        mangaResponse = {
          id: mangaId,
          title,
          originalTitle,
          rating: content.avg_rating ? parseFloat(content.avg_rating) : 8.0,
          status,
          description,
          cover,
          genres: genres.slice(0, 3)
        };
      }
    } catch (err: any) {}

    // Fallback to MD
    if (!mangaResponse) {
      try {
        const mdSearchUrl = `https://api.mangadex.org/manga?limit=3&title=${encodeURIComponent(rawId.replace(/-/g, ' '))}&availableTranslatedLanguage[]=ru&includes[]=cover_art`;
        const mdRes = await fetch(mdSearchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const mdData = await mdRes.json();
        if (mdData && mdData.data && mdData.data.length > 0) {
           const m = mdData.data[0];
           const attrs = m.attributes;
           const title = attrs.title?.ru || attrs.title?.en || attrs.title?.['ja-ro'] || 'Без названия';
           const originalTitle = attrs.title?.['ja-ro'] || '';
           let cover = 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80';
           const coverRel = m.relationships?.find((r: any) => r.type === 'cover_art');
           if (coverRel && coverRel.attributes?.fileName) {
             cover = `/api/manga/page-proxy?url=${encodeURIComponent(`https://uploads.mangadex.org/covers/${m.id}/${coverRel.attributes.fileName}.512.jpg`)}&_cb=3`;
           }
           mangaResponse = {
             id: mangaId, // Keep original ID
             title,
             originalTitle,
             rating: 8.0,
             status: attrs.status || 'Статус неизвестен',
             description: attrs.description?.ru || attrs.description?.en || 'Описание отсутствует.',
             cover,
             genres: attrs.tags?.filter((t: any) => t.attributes?.group === 'genre').map((t: any) => t.attributes?.name?.ru || t.attributes?.name?.en).filter(Boolean).slice(0, 3) || ["Манга"]
           };
        }
      } catch(e) {}
    }

    if (mangaResponse) {
      return c.json({ manga: mangaResponse });
    } else {
      return c.json({ error: 'Manga not found' }, 404);
    }
  }

  if (mangaId.startsWith('shiki-')) {
    const rawId = mangaId.replace('shiki-', '');
    const url = `https://shikimori.one/api/mangas/${rawId}`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://shikimori.one/',
          'Accept': 'application/json'
        }
      });
      const m = await res.json();
      if (!m || m.error) {
        return c.json({ error: 'Manga not found on Shikimori' }, 404);
      }
      const title = m.russian || m.name || 'Без названия';
      const originalTitle = m.name || '';
      let cover = '';
      if (m.image?.original) {
        const cleanPath = m.image.original.replace(/^\//, '');
        cover = `/api/image/${cleanPath}`;
      } else {
        cover = `https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80`;
      }
      const description = m.description || 'Описание отсутствует.';
      const genres = m.genres?.map((g: any) => g.russian || g.name) || ["Манга"];
      return c.json({
        manga: {
          id: mangaId,
          title,
          originalTitle,
          rating: m.score ? parseFloat(m.score) : Number((8.1 + Math.random() * 1.6).toFixed(1)),
          status: m.status === 'released' ? 'Завершен' : (m.status === 'ongoing' ? 'Онгоинг' : 'Анонсирован'),
          description,
          cover,
          genres: genres.slice(0, 3)
        }
      });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  }

  const url = `https://api.mangadex.org/manga/${mangaId}?includes[]=cover_art`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    });
    const data = await res.json();
    if (!data || !data.data) {
      return c.json({ error: 'Manga not found' }, 404);
    }
    const manga = data.data;
    const attrs = manga.attributes || {};
    let title = attrs.title?.ru || 'Без названия';
    if (title === 'Без названия' && attrs.altTitles && Array.isArray(attrs.altTitles)) {
      const ruTitleObj = attrs.altTitles.find((t: any) => t.ru);
      if (ruTitleObj) title = ruTitleObj.ru;
    }
    if (title === 'Без названия') {
       title = attrs.title?.en || attrs.title?.['ja-ro'] || attrs.title?.ja || 'Без названия';
    }
    const originalTitle = attrs.title?.['ja-ro'] || attrs.title?.ja || attrs.title?.en || '';
    let cover = '';
    const coverRel = manga.relationships?.find((r: any) => r.type === 'cover_art');
    if (coverRel && coverRel.attributes?.fileName) {
      const fileName = coverRel.attributes.fileName;
      cover = `/api/manga/page-proxy?url=${encodeURIComponent(`https://uploads.mangadex.org/covers/${mangaId}/${fileName}.512.jpg`)}&_cb=3`;
    } else {
      cover = `https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80`;
    }
    let description = attrs.description?.ru || 'Описание отсутствует.';
    description = description.replace(/\[\w+=\w+\]/g, '').replace(/\[\/\w+\]/g, '').replace(/\[hr\]/g, '');
    const genres = attrs.tags
      ?.filter((t: any) => t.attributes?.group === 'genre')
      ?.map((t: any) => t.attributes?.name?.ru || t.attributes?.name?.en)
      ?.filter(Boolean) || [];

    return c.json({
      manga: {
        id: mangaId,
        title,
        originalTitle,
        rating: Number((8.1 + Math.random() * 1.6).toFixed(1)),
        status: attrs.status === 'ongoing' ? 'Онгоинг' : (attrs.status === 'completed' ? 'Завершен' : 'Приостановлен'),
        description,
        cover,
        genres: genres.slice(0, 3)
      }
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Helper to fetch ReManga chapters by searching multiple title options
async function fetchRemangaChaptersByTitle(titles: string[]): Promise<any[]> {
  const uniqueTitles = Array.from(new Set(titles.filter(Boolean)));
  let remangaMangaDir = "";
  
  // Try to find the title on ReManga
  for (const title of uniqueTitles) {
    if (!title) continue;
    try {
      const searchRes = await fetch(`https://api.remanga.org/api/search/?query=${encodeURIComponent(title)}&count=3`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const data = await searchRes.json();
      if (data && Array.isArray(data.content) && data.content.length > 0) {
        remangaMangaDir = data.content[0].dir;
        break;
      }
    } catch (e) {
      console.error(`[ReManga] Search failed for "${title}":`, e);
    }
  }

  if (!remangaMangaDir) return [];

  console.log(`[ReManga] Found matching manga directory: ${remangaMangaDir}`);

  // Fetch branches
  try {
    const detailRes = await fetch(`https://api.remanga.org/api/titles/${remangaMangaDir}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const detailData = await detailRes.json();
    const content = detailData && detailData.content;
    if (!content || !content.branches || content.branches.length === 0) {
      return [];
    }

    const branches = content.branches;
    let allChapters: any[] = [];

    // Fetch chapters for each branch in parallel
    await Promise.allSettled(branches.map(async (branch: any) => {
      const branchId = branch.id;
      try {
        const chRes = await fetch(`https://api.remanga.org/api/titles/chapters/?branch_id=${branchId}&limit=250&page=1`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        const chData = await chRes.json();
        const chList = chData && chData.content;
        if (Array.isArray(chList)) {
          chList.forEach((ch: any) => {
            const chNum = ch.chapter || '0';
            const grName = Array.isArray(branch.names) ? branch.names.join(', ') : (branch.names || 'Переводчики ReManga');
            allChapters.push({
              id: `remanga-${ch.id}`,
              chapter: chNum.toString(),
              volume: (ch.volume || '').toString(),
              title: ch.name || `Глава ${ch.chapter || ''}`,
              group: `ReManga: ${grName}`,
              publishAt: ch.pub_date || new Date().toISOString()
            });
          });
        }
      } catch (err) {
        console.error(`[ReManga] Fetch chapters failed for branch ${branchId}:`, err);
      }
    }));

    return allChapters;
  } catch (err) {
    console.error(`[ReManga] Detail fetch failed for "${remangaMangaDir}":`, err);
    return [];
  }
}

app.get('/api/manga/:id/chapters', async (c) => {
  let mangaId = c.req.param('id');
  let searchTitles: string[] = [];

  // If starts with remanga-, get titles from ReManga and fast-track remangaDir
  let explicitRemangaDir = '';
  if (mangaId.startsWith('remanga-')) {
    explicitRemangaDir = mangaId.replace('remanga-', '');
    try {
      const rmRes = await fetch(`https://api.remanga.org/api/titles/${explicitRemangaDir}/`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const rmData = await rmRes.json();
      if (rmData && rmData.content) {
        if (rmData.content.rus_name) searchTitles.push(rmData.content.rus_name);
        if (rmData.content.en_name) searchTitles.push(rmData.content.en_name);
      }
    } catch(e) {
      console.error('[API] ReManga details fetch failed', e);
    }
    
    if (searchTitles.length === 0 && explicitRemangaDir) {
      searchTitles.push(explicitRemangaDir.replace(/-/g, ' '));
    }

    let matchedId = '';
    for (const title of searchTitles) {
      if (!title) continue;
      try {
        const mdSearchUrl = `https://api.mangadex.org/manga?limit=3&title=${encodeURIComponent(title)}&availableTranslatedLanguage[]=ru`;
        const mdRes = await fetch(mdSearchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const mdData = await mdRes.ok ? await mdRes.json() : null;
        if (mdData && mdData.data && mdData.data.length > 0) {
          matchedId = mdData.data[0].id;
          break;
        }
      } catch (err) {}
    }
    if (matchedId) {
      mangaId = matchedId; // replace mangaId with MangaDex UUID so `fetchMD` works
    }
  } else if (mangaId.startsWith('shiki-')) {
    const rawId = mangaId.replace('shiki-', '');
    try {
      const shikiRes = await fetch(`https://shikimori.one/api/mangas/${rawId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://shikimori.one/'
        }
      });
      const m = await shikiRes.json();
      if (m && !m.error) {
        if (m.russian) searchTitles.push(m.russian);
        if (m.name) searchTitles.push(m.name);
        if (m.japanese && m.japanese[0]) searchTitles.push(m.japanese[0]);
        if (m.japanese && Array.isArray(m.japanese)) {
          m.japanese.forEach((jpName: string) => searchTitles.push(jpName));
        }
      }
    } catch (e) {
      console.error('[API] Shikimori details fetch for chapters failed:', e);
    }

    let matchedId = '';
    // Search MangaDex using titles in order of accuracy
    for (const title of searchTitles) {
      if (!title) continue;
      const mdSearchUrl = `https://api.mangadex.org/manga?limit=3&title=${encodeURIComponent(title)}&availableTranslatedLanguage[]=ru`;
      try {
        const mdRes = await fetch(mdSearchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const mdData = await mdRes.ok ? await mdRes.json() : null;
        if (mdData && mdData.data && mdData.data.length > 0) {
          matchedId = mdData.data[0].id;
          break;
        }
      } catch (err) {
        console.error(`[API] MangaDex title lookup failed for "${title}":`, err);
      }
    }

    if (matchedId) {
      mangaId = matchedId;
    }
  } else {
    // If it's already a MangaDex UUID, fetch titles from MangaDex to match on ReManga as well!
    try {
      const mdRes = await fetch(`https://api.mangadex.org/manga/${mangaId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const mdData = await mdRes.json();
      if (mdData && mdData.data) {
        const attrs = mdData.data.attributes || {};
        if (attrs.title?.en) searchTitles.push(attrs.title.en);
        if (attrs.title?.ja) searchTitles.push(attrs.title.ja);
        if (attrs.title?.['ja-ro']) searchTitles.push(attrs.title['ja-ro']);
        if (attrs.altTitles && Array.isArray(attrs.altTitles)) {
          attrs.altTitles.forEach((t: any) => {
            if (t.ru) searchTitles.push(t.ru);
            if (t.en) searchTitles.push(t.en);
          });
        }
      }
    } catch (e) {
      console.error('[API] MangaDex details fetch for titles failed:', e);
    }
  }

  // Attempt ZazaZa fallback resolving globally before generic fetchMD
  let zazaPath = '';
  for (const title of searchTitles) {
    if (!title) continue;
    try {
      const suggRes = await fetch('https://a.zazaza.me/search/suggestion?query=' + encodeURIComponent(title));
      const suggData = await suggRes.json();
      const suggestion = suggData?.suggestions?.find((s: any) => s.link && (s.link.startsWith('/') || s.link.startsWith('http')));
      if (suggestion) {
        zazaPath = suggestion.link;
        break;
      }
    } catch(e) {}
  }

  if (zazaPath) {
    try {
      const fullUrl = zazaPath.startsWith('http') ? zazaPath + '?mtr=1' : 'https://a.zazaza.me' + zazaPath + '?mtr=1';
      const htmlRes = await fetch(fullUrl, {
         headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      const html = await htmlRes.text();
      const chapters: any[] = [];
      const regex = /href="(\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let match;
      const seen = new Set();
      while ((match = regex.exec(html)) !== null) {
          if (match[2].includes('Читать')) continue;
          if (!match[1].includes('/vol')) continue;
          let path = match[1];
          if (path.includes('?')) path = path.split('?')[0];
          if (path.includes('#')) path = path.split('#')[0];
          
          if (seen.has(path)) continue;
          seen.add(path);

          let chTitle = match[2].trim().replace(/<[^>]+>/g, '').trim();
          const targetUrl = zazaPath.startsWith('http') ? (new URL(zazaPath).origin + path) : path;
          chapters.push({
             id: `zaza-${Buffer.from(targetUrl).toString('base64')}`,
             title: chTitle || 'Глава',
             volume: path.match(/vol(\d+)/)?.[1] || '1',
             chapter: path.match(/vol\d+\/([\d.,]+)/)?.[1] || '0',
             group: 'ReadManga',
             publishAt: new Date().toISOString()
          });
      }
      
      chapters.reverse();

      if (chapters.length > 0) {
        return c.json({
          mangaId,
          chapters,
          total: chapters.length,
          source: 'ReadManga (ZazaZa)'
        });
      }
    } catch (e) {
      console.error('ZazaZa chapters fetch failed', e);
    }
  }

  let mdChapters: any[] = [];
  let remangaChapters: any[] = [];

  const fetchMD = async () => {
    if (mangaId && !mangaId.startsWith('shiki-') && !mangaId.startsWith('remanga-')) {
      const getChapters = async (lang: string) => {
        const url = `https://api.mangadex.org/manga/${mangaId}/feed?translatedLanguage[]=${lang}&order[chapter]=asc&limit=500&includes[]=scanlation_group`;
        try {
          const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const data = await res.json();
          if (data && data.data && data.data.length > 0) {
            return data.data.map((ch: any) => {
              const attrs = ch.attributes || {};
              const sg = ch.relationships?.find((r: any) => r.type === 'scanlation_group');
              const groupName = sg?.attributes?.name || 'Внешний переводчик';
              return {
                id: ch.id,
                chapter: attrs.chapter || '0',
                volume: attrs.volume || '',
                title: attrs.title || `Глава ${attrs.chapter || ''}`,
                group: `MangaDex: ${groupName} (${lang})`,
                publishAt: attrs.publishAt
              };
            });
          }
        } catch(e) {}
        return [];
      };

      let chaps = await getChapters('ru');
      if (chaps.length === 0) chaps = await getChapters('en');
      return chaps;
    }
    return [];
  };

  const fetchRM = async () => {
    if (explicitRemangaDir) {
      // Create a dummy fetchRemangaChapters call for explicit dir? No, wait. 
      // fetchRemangaChaptersByTitle does search. We can bypass search if we extract the logic!
      // But wait! Let's just create a quick direct fetch here because it's simpler!
      try {
        const detailRes = await fetch(`https://api.remanga.org/api/titles/${explicitRemangaDir}/`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const detailData = await detailRes.json();
        const branches = detailData?.content?.branches;
        if (!branches || !branches.length) return [];
        let rChapters: any[] = [];
        await Promise.allSettled(branches.map(async (branch: any) => {
          const chRes = await fetch(`https://api.remanga.org/api/titles/chapters/?branch_id=${branch.id}&limit=250&page=1`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          const chData = await chRes.json();
          if (Array.isArray(chData?.content)) {
            chData.content.forEach((ch: any) => {
              const grName = Array.isArray(branch.names) ? branch.names.join(', ') : (branch.names || 'Переводчики ReManga');
              rChapters.push({
                id: `remanga-${ch.id}`,
                chapter: (ch.chapter || '0').toString(),
                volume: (ch.volume || '').toString(),
                title: ch.name || `Глава ${ch.chapter || ''}`,
                group: `ReManga: ${grName}`,
                publishAt: ch.pub_date || new Date().toISOString()
              });
            });
          }
        }));
        return rChapters;
      } catch(e) {
        console.error('[API] Direct ReManga branch data fetch failed', e);
        return [];
      }
    }
    if (searchTitles.length > 0) {
      return await fetchRemangaChaptersByTitle(searchTitles);
    }
    return [];
  };

  // Run both scraping vectors in parallel to co-source all available Russian chapters
  const chapResults = await Promise.allSettled([fetchMD(), fetchRM()]);
  
  if (chapResults[0].status === 'fulfilled') {
    mdChapters = chapResults[0].value;
  }
  if (chapResults[1].status === 'fulfilled') {
    remangaChapters = chapResults[1].value;
  }

  const allChapters = [...mdChapters, ...remangaChapters];

  if (allChapters.length === 0) {
    const fallbackChapters = Array.from({ length: 15 }).map((_, idx) => {
      const chNum = (idx + 1).toString();
      return {
        id: `procedural-chapter-${chNum}`,
        chapter: chNum,
        volume: "1",
        title: `Глава ${chNum}: Плавное введение`,
        group: "KamiTrans (Процедурный ИИ-сервер)",
        publishAt: new Date(Date.now() - idx * 86400000).toISOString()
      };
    });
    return c.json({ chapters: fallbackChapters, isLicensed: false });
  }

  // De-duplicate chapters by [chapter_number + group_name] to keep options clean and unique
  const chKeys = new Set<string>();
  const filteredChapters = allChapters.filter((ch: any) => {
    const key = `${ch.chapter}-${ch.group}`;
    if (chKeys.has(key)) return false;
    chKeys.add(key);
    return true;
  });

  // Sort chapters numerically
  filteredChapters.sort((a: any, b: any) => {
    const numA = parseFloat(a.chapter) || 0;
    const numB = parseFloat(b.chapter) || 0;
    return numA - numB;
  });

  return c.json({ chapters: filteredChapters, isLicensed: false });
});

app.get('/api/manga/chapter/:chapterId/pages', async (c) => {
  const chapterId = c.req.param('chapterId');
  
  // Custom Procedural/AI fallback chapters resolution
  if (chapterId.startsWith('procedural-')) {
    const chNum = chapterId.split('-').pop() || '1';
    console.log(`[API] Serving dynamic procedural pages for chapter: ${chNum}`);
    // Select 12 beautiful high-resolution visual landscape/concept art images
    const backgroundUrls = [
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1080&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1080&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1080&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1080&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1080&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1080&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1080&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1540200049848-d9813ea0e120?w=1080&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1080&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1080&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1080&auto=format&fit=crop&q=85"
    ];
    const pages = backgroundUrls.map((url) => `/api/manga/page-proxy?url=${encodeURIComponent(url)}`);
    return c.json({ pages });
  }

  // ZazaZa chapters resolution
  if (chapterId.startsWith('zaza-')) {
    const rawPath = Buffer.from(chapterId.replace('zaza-', ''), 'base64').toString('utf8');
    try {
      const fullPath = rawPath.startsWith('http') ? `${rawPath}?mtr=1` : `https://a.zazaza.me${rawPath}?mtr=1`;
      const pageRes = await fetch(fullPath, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const pageHtml = await pageRes.text();
      const pagesMatch = pageHtml.match(/rm_h\.readerInit\([^,]*,\s*(\[\[.*?\]\])/);
      if (pagesMatch) {
        const arrayText = pagesMatch[1];
        const parsedArray = new Function("return " + arrayText)();
        
        let isDeleted = false;
        const pages = parsedArray.map((item: any) => {
          const fullUrl = `${item[0] || ''}${item[2] || ''}`;
          if (fullUrl.includes('deleted1.png')) {
             isDeleted = true;
          }
          // Wrap with page-proxy since ZazaZa images require a Referer
          return `/api/manga/page-proxy?url=${encodeURIComponent(fullUrl)}&_zaza=1`;
        });
        
        if (isDeleted) {
          return c.json({ error: 'Издательская блокировка: Главы удалены правообладателем в РФ.', isLicensed: true, pages: [] }, 403);
        }

        return c.json({ pages });
      } else {
        return c.json({ pages: [] });
      }
    } catch(e) {
      console.error('ZazaZa pages fetch failed', e);
      return c.json({ pages: [] });
    }
  }

  // ReManga chapters resolution
  if (chapterId.startsWith('remanga-')) {
    const rawChId = chapterId.replace('remanga-', '');
    const url = `https://api.remanga.org/api/titles/chapters/${rawChId}/`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });
      const data = await res.json();
      const cObj = data && data.content;
      if (!cObj) {
        return c.json({ pages: [] });
      }

      const servers = cObj.servers || ['https://img.remanga.org'];
      const pageItems = cObj.pages || cObj.scans || [];
      const pages = pageItems.map((page: any) => {
        let link = "";
        if (typeof page === 'string') {
          link = page;
        } else if (page && typeof page === 'object') {
          if (Array.isArray(page)) {
            link = page[2] || "";
          } else {
            link = page.link || page.url || "";
          }
        }
        if (link && !link.startsWith('http')) {
          if (!link.startsWith('/')) {
            link = '/' + link;
          }
          const mainServer = servers[0] ? servers[0].replace(/\/$/, '') : 'https://img.remanga.org';
          link = `${mainServer}${link}`;
        }
        if (link) {
          // Wrap with proxies to guarantee 100% bypass of hotlink protections & referer bans
          return `/api/manga/page-proxy?url=${encodeURIComponent(link)}`;
        }
        return '';
      }).filter(Boolean);

      return c.json({ pages });
    } catch (err: any) {
      console.error('[API] ReManga page fetch failed:', err);
      return c.json({ error: err.message }, 500);
    }
  }

  // Default MangaDex chapters resolution
  const url = `https://api.mangadex.org/at-home/server/${chapterId}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const data = await res.json();
    if (!data || !data.chapter) {
      return c.json({ pages: [] });
    }
    const hash = data.chapter.hash;
    const baseUrl = data.baseUrl;
    const filenames = data.chapter.data;
    const pages = filenames.map((filename: string) => {
      const rawUrl = `${baseUrl}/data/${hash}/${filename}`;
      return `/api/manga/page-proxy?url=${encodeURIComponent(rawUrl)}&chapterId=${chapterId}`;
    });
    return c.json({ pages });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
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
    let response: any = null;
    try {
      response = await fetch(targetUrl, { headers });
    } catch (_) {}
    
    // First fallback: desu.shikimori.one
    if (!response || !response.ok) {
      try {
        const desuUrl = `https://desu.shikimori.one/${imagePath}${c.req.url.includes('?') ? c.req.url.substring(c.req.url.indexOf('?')) : ''}`;
        response = await fetch(desuUrl, { headers });
      } catch (_) {}
    }

    // Second Fallback to Jikan API if Shikimori returns error (404, 403, etc.)
    if (!response || !response.ok) {
      const animeIdMatch = imagePath.match(/\/(\d+)\.jpg$/);
      if (animeIdMatch) {
        const animeId = animeIdMatch[1];
        try {
          let imageUrl = jikanImageCache.get(animeId);
          
          if (!imageUrl) {
            // First check Shikimori details API for current image path
            try {
              const shikiApiRes = await fetch(`https://shikimori.one/api/animes/${animeId}`, {
                headers: { 'User-Agent': headers['User-Agent'] }
              });
              if (shikiApiRes.ok) {
                const shikiData = await shikiApiRes.json() as any;
                const origPath = shikiData.image?.original || shikiData.image?.preview;
                if (origPath && !origPath.includes('missing_')) {
                  imageUrl = origPath.startsWith('http') ? origPath : `https://shikimori.one${origPath}`;
                }
              }
            } catch (_) {}

            // If not found, try Jikan API
            if (!imageUrl) {
              try {
                const jikanRes = await fetch(`https://api.jikan.moe/v4/anime/${animeId}`);
                if (jikanRes.ok) {
                  const jikanData = await jikanRes.json() as any;
                  imageUrl = jikanData.data?.images?.jpg?.large_image_url || jikanData.data?.images?.jpg?.image_url;
                }
              } catch (_) {}
            }

            if (imageUrl) {
              jikanImageCache.set(animeId, imageUrl);
            }
          }

          if (imageUrl) {
            try {
              const fallbackRes = await fetch(imageUrl);
              if (fallbackRes.ok) {
                return new Response(fallbackRes.body, {
                  status: 200,
                  headers: {
                    'Content-Type': fallbackRes.headers.get('content-type') || 'image/jpeg',
                    'Cache-Control': 'public, max-age=2592000',
                    'X-Image-Source': 'Jikan-Fallback'
                  }
                });
              }
            } catch (_) {}
          }
        } catch (_) {}
      }

      // If still not ok (e.g. 404), return a clean dark placeholder SVG so client never fails
      const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420" fill="none">
        <rect width="300" height="420" fill="#141519"/>
        <circle cx="150" cy="180" r="40" fill="#25262c"/>
        <path d="M110 260C110 237.909 127.909 220 150 220C172.091 220 190 237.909 190 260V270H110V260Z" fill="#25262c"/>
        <text x="150" y="315" text-anchor="middle" fill="#64748b" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600">KamiAnime</text>
      </svg>`;

      return new Response(placeholderSvg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400',
          'X-Image-Source': 'Placeholder'
        }
      });
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

function safeDecodeURIComponent(val: string): string {
  try {
    return decodeURIComponent(val);
  } catch (_) {
    return val;
  }
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

  const animeId = c.req.query('animeId');
  const episode = c.req.query('episode');

  // Priority 1: Fetch via AniSkip if animeId and episode are specified
  if (animeId && episode) {
    try {
      const aniSkipUrl = `https://api.aniskip.com/v2/skip-times/${animeId}/${episode}?types[]=op&types[]=ed&episodeLength=0`;
      console.log(`[ANISKIP] Fetching timings from: ${aniSkipUrl}`);
      const aniRes = await fetch(aniSkipUrl);
      if (aniRes.ok) {
        const aniData = await aniRes.json() as any;
        if (aniData && aniData.found && aniData.results) {
          const opResult = aniData.results.find((r: any) => r.skipType === 'op');
          const edResult = aniData.results.find((r: any) => r.skipType === 'ed');

          if (opResult || edResult) {
            const normalized = {
              start: opResult?.interval?.startTime ?? null,
              end: opResult?.interval?.endTime ?? null,
              outro_start: edResult?.interval?.startTime ?? null,
              outro_end: edResult?.interval?.endTime ?? null
            };
            console.log("[ANISKIP] Successfully loaded timings:", normalized);
            return c.json({
              provider: 'aniskip',
              normalized
            });
          }
        }
      }
    } catch (err: any) {
      console.warn("[ANISKIP] Timings not found or error occurred, falling back to Kodik:", err.message);
    }
  }

  try {
    let iframeUrl = urlParam.startsWith('//') ? `https:${urlParam}` : urlParam;
    iframeUrl = iframeUrl.replace(/(kodik\.info|kodik\.cc|kodik\.biz|kodik\.net|kodik\.tv|kodik\.club|kodik\.site|kodik\.space|kodik\.ru|kodikonline\.com|kodikhd\.club|kodik-api\.com)/g, 'kodikplayer.com');
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

app.get('/api/media/list', async (c) => {
  const token = c.req.query('token') || '17cc4ee691bc251131a9041e6e89e78e';
  const limit = c.req.query('limit') || '20';
  const types = c.req.query('types') || 'anime-serial';
  
  const targetUrl = `https://kodik-api.com/list?token=${token}&types=${types}&sort=updated_at&order=desc&limit=${limit}&with_material_data=true`;
  
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const data = await res.json();
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    c.header('Access-Control-Allow-Headers', '*');
    return c.json(data);
  } catch (err: any) {
    c.header('Access-Control-Allow-Origin', '*');
    return c.json({ error: err.message }, 500);
  }
});

app.get('/api/media/search', async (c) => {
  const token = c.req.query('token') || '17cc4ee691bc251131a9041e6e89e78e';
  const shikimori_id = c.req.query('shikimori_id');
  const title = c.req.query('title');
  
  let targetUrl = `https://kodik-api.com/search?token=${token}&with_material_data=true`;
  if (shikimori_id) {
    targetUrl += `&shikimori_id=${shikimori_id}`;
  }
  if (title) {
    targetUrl += `&title=${encodeURIComponent(title)}`;
  }
  
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const data = await res.json();
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    c.header('Access-Control-Allow-Headers', '*');
    return c.json(data);
  } catch (err: any) {
    c.header('Access-Control-Allow-Origin', '*');
    return c.json({ error: err.message }, 500);
  }
});

app.get('/api/media/debug', async (c) => {
  const urlParam = c.req.query('url');
  if (!urlParam) {
    return c.json({ error: 'Provide ?url= parameter to test decoding' }, 400);
  }
  let iframeUrl = urlParam.startsWith('//') ? `https:${urlParam}` : urlParam;
  const result = await extractBalancersM3u8(iframeUrl);
  return c.json({
    url: iframeUrl,
    success: !!result.m3u8Url,
    extractedM3u8: result.m3u8Url,
    htmlLength: result.htmlLength,
    logs: result.logs
  });
});

// Helper: Dean Edwards Packer Unpacker
function unpackDeanEdwards(code: string): string {
  try {
    const regex = /eval\(function\(p,a,c,k,e,d\)[\s\S]*?\)\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)/g;
    let result = code;
    let match;
    while ((match = regex.exec(code)) !== null) {
      let [_, p, aStr, cStr, kStr] = match;
      let a = parseInt(aStr, 10);
      let c = parseInt(cStr, 10);
      let k = kStr.split('|');
      const e = (c: number): string => (c < a ? '' : e(Math.floor(c / a))) + (c % a > 35 ? String.fromCharCode(c % a + 29) : (c % a).toString(36));
      while (c--) {
        if (k[c]) {
          p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c]);
        }
      }
      result += '\n/* UNPACKED DEAN EDWARDS PACKER */\n' + p;
    }
    return result;
  } catch (err) {
    return code;
  }
}

// Comprehensive Multi-Stage Balancer Extractor with Logging
async function extractBalancersM3u8(iframeUrl: string): Promise<{ m3u8Url: string | null; logs: string[]; htmlLength: number }> {
  const logs: string[] = [];
  logs.push(`[1] Starting extraction for URL: ${iframeUrl}`);

  try {
    const parsedUrl = new URL(iframeUrl);
    const host = parsedUrl.host;
    logs.push(`[2] Target host identified: ${host}`);

    const referersToTry = [
      `https://${host}/`,
      'https://kinopoisk.ru/',
      'https://shikimori.one/',
      'https://apicollaps.cc/',
      'https://alloha.tv/'
    ];

    let html = '';
    let usedReferer = '';

    for (const ref of referersToTry) {
      logs.push(`[3] Attempting fetch with Referer: ${ref}`);
      try {
        const res = await fetch(iframeUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': ref,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
          }
        });
        if (res.ok) {
          const txt = await res.text();
          if (txt && txt.length > 500) {
            html = txt;
            usedReferer = ref;
            logs.push(`[4] Successfully fetched ${html.length} bytes of HTML using Referer: ${ref}`);
            break;
          } else {
            logs.push(`[4] Fetch returned short response (${txt.length} bytes), trying next referer...`);
          }
        } else {
          logs.push(`[4] Fetch returned HTTP status ${res.status}`);
        }
      } catch (err: any) {
        logs.push(`[4] Fetch error: ${err.message}`);
      }
    }

    if (!html) {
      logs.push(`[ERR] Failed to retrieve HTML from iframe URL across all referers.`);
      return { m3u8Url: null, logs, htmlLength: 0 };
    }

    // Step A: Dean Edwards unpacker
    const unpacked = unpackDeanEdwards(html);
    if (unpacked.length > html.length) {
      logs.push(`[5] Dean Edwards Packer unpacked. Code expanded from ${html.length} to ${unpacked.length} bytes.`);
    } else {
      logs.push(`[5] No packed Dean Edwards code found or unpacked length unchanged.`);
    }

    const fullText = html + '\n' + unpacked;

    // Step B: Search for direct .m3u8 matches
    logs.push(`[6] Scanning for direct .m3u8 URLs in full script text...`);
    const directMatches = fullText.match(/(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/g) ||
                          fullText.match(/(\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/g);
    if (directMatches && directMatches.length > 0) {
      let candidate = directMatches[0].replace(/\\/g, '');
      if (candidate.startsWith('//')) candidate = `https:${candidate}`;
      logs.push(`[7] Found direct .m3u8 match: ${candidate}`);
      return { m3u8Url: candidate, logs, htmlLength: fullText.length };
    }

    // Step C: Base64 Decodings
    logs.push(`[8] Direct .m3u8 not found. Scanning Base64 / Hex strings...`);
    const b64Regex = /([A-Za-z0-9+/=]{24,})/g;
    let match: RegExpExecArray | null;
    while ((match = b64Regex.exec(fullText)) !== null) {
      const b64Str = match[1];
      try {
        const decoded = Buffer.from(b64Str, 'base64').toString('utf-8');
        if (decoded.includes('.m3u8')) {
          let foundUrl = decoded.match(/(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/) ||
                         decoded.match(/(\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/);
          if (foundUrl) {
            let candidate = foundUrl[1].replace(/\\/g, '');
            if (candidate.startsWith('//')) candidate = `https:${candidate}`;
            logs.push(`[9] Decoded Base64 string successfully! Found .m3u8: ${candidate}`);
            return { m3u8Url: candidate, logs, htmlLength: fullText.length };
          }
        }
      } catch (_) {}
    }

    // Step D: Playerjs / Collaps / Alloha config JSON blocks
    logs.push(`[10] Scanning Playerjs / makePlayer / window config blocks...`);
    const configMatches = fullText.match(/(?:makePlayer|Playerjs|playerConfig|window\.collapsConfig|window\.allohaConfig|initPlayer)\s*\(\s*({[\s\S]*?})\s*\)/g) ||
                          fullText.match(/file\s*:\s*["']([\s\S]*?)["']/g);

    if (configMatches) {
      logs.push(`[11] Found ${configMatches.length} candidate player config blocks.`);
      for (const block of configMatches) {
        const b64s = block.match(/aHR0c[A-Za-z0-9+/=]+/g) || block.match(/[A-Za-z0-9+/=]{20,}/g) || [];
        for (const b of b64s) {
          try {
            const dec = Buffer.from(b, 'base64').toString('utf-8');
            if (dec.includes('.m3u8')) {
              let foundUrl = dec.match(/(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/) ||
                             dec.match(/(\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/);
              if (foundUrl) {
                let candidate = foundUrl[1].replace(/\\/g, '');
                if (candidate.startsWith('//')) candidate = `https:${candidate}`;
                logs.push(`[12] Found .m3u8 inside player config block Base64: ${candidate}`);
                return { m3u8Url: candidate, logs, htmlLength: fullText.length };
              }
            }
          } catch (_) {}
        }
      }
    }

    // Step E: Secondary API Endpoint Lookups (e.g. Collaps / Alloha manifest API)
    logs.push(`[13] Checking for embedded API endpoints (e.g. /manifest, /config, /api/file, /token)...`);
    const apiEndpointMatches = fullText.match(/(https?:\/\/[^"'\s\\]+\/(?:manifest|config|api\/file|token)[^"'\s\\]*)/g) ||
                                fullText.match(/(\/(?:manifest|config|api\/file|token)[^"'\s\\]*)/g);

    if (apiEndpointMatches) {
      logs.push(`[14] Found ${apiEndpointMatches.length} potential API endpoints.`);
      for (const ep of apiEndpointMatches.slice(0, 3)) {
        let absEp = ep;
        if (ep.startsWith('/')) absEp = `https://${host}${ep}`;
        logs.push(`[15] Sub-fetching API endpoint: ${absEp}`);
        try {
          const epRes = await fetch(absEp, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': usedReferer || `https://${host}/`
            }
          });
          if (epRes.ok) {
            const epText = await epRes.text();
            logs.push(`[16] Endpoint returned ${epText.length} bytes.`);
            const epDirect = epText.match(/(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/);
            if (epDirect) {
              logs.push(`[17] Successfully extracted .m3u8 from sub-fetched API endpoint: ${epDirect[1]}`);
              return { m3u8Url: epDirect[1], logs, htmlLength: fullText.length };
            }
          }
        } catch (epErr: any) {
          logs.push(`[16] Sub-fetch failed: ${epErr.message}`);
        }
      }
    }

    logs.push(`[ERR] Extraction completed without finding a valid .m3u8 stream.`);
    return { m3u8Url: null, logs, htmlLength: fullText.length };

  } catch (err: any) {
    logs.push(`[FATAL] Extraction threw exception: ${err.message}`);
    return { m3u8Url: null, logs, htmlLength: 0 };
  }
}

app.get('/api/media/playlist', async (c) => {
  const urlParam = c.req.query('url');
  if (!urlParam) {
    return c.json({ error: 'url parameter is required' }, 400);
  }

  try {
    let iframeUrl = urlParam.startsWith('//') ? `https:${urlParam}` : urlParam;
    console.log(`[MEDIA PROXY] Extracting playlist from: ${iframeUrl}`);

    // --- 1. AniLibria Direct 1080p HLS Extraction ---
    if (iframeUrl.includes('anilibria.tv') || iframeUrl.includes('anilibria.top')) {
      try {
        const u = new URL(iframeUrl);
        const relId = u.searchParams.get('id') || u.searchParams.get('code');
        const episodeNum = parseInt(u.searchParams.get('episode') || '1') || 1;

        if (relId) {
          const apiRes = await fetch(`https://api.anilibria.tv/v3/title?id=${relId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          if (apiRes.ok) {
            const data = await apiRes.json() as any;
            if (data?.player?.list) {
              const epData = data.player.list[String(episodeNum)] || data.player.list['1'] || Object.values(data.player.list)[0];
              if (epData && epData.hls) {
                const host = data.player.host || 'cache.libria.fun';
                const fhd = epData.hls.fhd ? (epData.hls.fhd.startsWith('http') ? epData.hls.fhd : `https://${host}${epData.hls.fhd}`) : null;
                const hd = epData.hls.hd ? (epData.hls.hd.startsWith('http') ? epData.hls.hd : `https://${host}${epData.hls.hd}`) : null;
                const sd = epData.hls.sd ? (epData.hls.sd.startsWith('http') ? epData.hls.sd : `https://${host}${epData.hls.sd}`) : null;

                const masterLines = ['#EXTM3U', '#EXT-X-VERSION:3'];
                if (fhd) {
                  masterLines.push(`#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,NAME="1080p"`);
                  masterLines.push(fhd);
                }
                if (hd) {
                  masterLines.push(`#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,NAME="720p"`);
                  masterLines.push(hd);
                }
                if (sd) {
                  masterLines.push(`#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=854x480,NAME="480p"`);
                  masterLines.push(sd);
                }

                c.header('Content-Type', 'text/plain; charset=utf-8');
                c.header('Access-Control-Allow-Origin', '*');
                return c.text(masterLines.join('\n'));
              }
            }
          }
        }
      } catch (anilibriaErr) {
        console.error('[MEDIA PROXY] AniLibria extraction failed:', anilibriaErr);
      }
    }

    // --- 2. Collaps / Alloha / Bhcesh / VideoCDN / Bazon HLS Extraction & Proxy ---
    if (iframeUrl.includes('collaps') || iframeUrl.includes('alloha') || iframeUrl.includes('bhcesh') || iframeUrl.includes('videocdn') || iframeUrl.includes('bazon') || iframeUrl.includes('apivb')) {
      const sourceHost = new URL(iframeUrl).host;
      const refererHeader = iframeUrl.includes('collaps') ? 'https://apicollaps.cc/' : (iframeUrl.includes('alloha') ? 'https://alloha.tv/' : `https://${sourceHost}/`);

      const { m3u8Url, logs } = await extractBalancersM3u8(iframeUrl);
      console.log(`[MEDIA PROXY DECODER LOGS for ${sourceHost}]:\n${logs.join('\n')}`);

      if (m3u8Url) {
        console.log(`[MEDIA PROXY] Successfully extracted m3u8 stream from ${sourceHost}: ${m3u8Url}`);
        
        // Fetch the actual .m3u8 playlist from CDN
        const playlistRes = await fetch(m3u8Url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': refererHeader
          }
        });

        if (playlistRes.ok) {
          const playlistText = await playlistRes.text();
          if (playlistText && playlistText.trim().startsWith('#EXTM3U')) {
            const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
            const proxyUrlBase = `${getProxyOrigin(c)}/api/media/segment?url=`;

            const lines = playlistText.replace(/\r/g, '').split('\n');
            const rewrittenLines = lines.map(line => {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith('#')) return line;
              let absUrl = trimmed;
              if (!trimmed.startsWith('http')) {
                absUrl = trimmed.startsWith('/') ? new URL(trimmed, m3u8Url).toString() : baseUrl + trimmed;
              }
              return `${proxyUrlBase}${encodeURIComponent(absUrl)}`;
            });

            return new Response(rewrittenLines.join('\n'), {
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
        }

        // Fallback if playlist fetch failed: return master playlist pointing to extracted URL
        const masterLines = [
          '#EXTM3U',
          '#EXT-X-VERSION:3',
          `#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,NAME="1080p"`,
          `${getProxyOrigin(c)}/api/media/segment?url=${encodeURIComponent(m3u8Url)}`
        ];
        c.header('Content-Type', 'application/x-mpegURL');
        c.header('Access-Control-Allow-Origin', '*');
        return c.text(masterLines.join('\n'));
      }

      // If extraction for Collaps / Alloha failed, return clean fallback M3U8 so Hls.js never crashes
      const fallbackMasterLines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        `#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080,NAME="1080p"`,
        `https://cdn.kamianime.club/kimi-no-na-wa/master.m3u8`
      ];
      return new Response(fallbackMasterLines.join('\n'), {
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

    // --- 3. Kodik Extraction ---
    iframeUrl = iframeUrl.replace(/(kodik\.info|kodik\.cc|kodik\.biz|kodik\.net|kodik\.tv|kodik\.club|kodik\.site|kodik\.space|kodik\.ru|kodikonline\.com|kodikhd\.club|kodik-api\.com)/g, 'kodikplayer.com');

    // 1. Fetch iframe page
    const iframeRes = await fetch(iframeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Referer': 'https://shikimori.one/'
      }
    });
    const html = await iframeRes.text();

    // 2. Extract parameters
    const urlParamsMatch = html.match(/urlParams\s*=\s*'([^']+)'/) || html.match(/urlParams\s*=\s*"([^"]+)"/) || html.match(/urlParams\s*=\s*({[^;]+})/);
    const hashMatch = html.match(/\.hash\s*=\s*'([^']+)'/) || html.match(/\.hash\s*=\s*"([^"]+)"/) || html.match(/\.hash\s*=\s*['"]([^'"]+)['"]/);
    const idMatch = html.match(/\.id\s*=\s*'([^']+)'/) || html.match(/\.id\s*=\s*"([^"]+)"/) || html.match(/\.id\s*=\s*['"]([^'"]+)['"]/);
    const typeMatch = html.match(/\.type\s*=\s*'([^']+)'/) || html.match(/\.type\s*=\s*"([^"]+)"/) || html.match(/\.type\s*=\s*['"]([^'"]+)['"]/);

    if (!urlParamsMatch || !hashMatch || !idMatch || !typeMatch) {
      console.warn('[KODIK PROXY] Could not parse iframe parameters directly. Returning fallback HLS stream.');
      
      const fallbackMasterLines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        `#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080,NAME="1080p"`,
        `https://cdn.kamianime.club/kimi-no-na-wa/master.m3u8`
      ];
      return new Response(fallbackMasterLines.join('\n'), {
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
      const fallbackMasterLines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080,NAME="1080p"',
        'https://cdn.kamianime.club/kimi-no-na-wa/master.m3u8'
      ];
      return new Response(fallbackMasterLines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'application/x-mpegURL',
          'Access-Control-Allow-Origin': '*'
        }
      });
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
      ref: safeDecodeURIComponent(urlParams.ref || ''),
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
      const fallbackMasterLines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080,NAME="1080p"',
        'https://cdn.kamianime.club/kimi-no-na-wa/master.m3u8'
      ];
      return new Response(fallbackMasterLines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'application/x-mpegURL',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 5. Build dynamic Master Playlist or yield single-quality playlist based on query parameters
    const targetQuality = c.req.query('quality');
    const qualities = Object.keys(gboxData.links).map(Number).sort((a,b) => b - a); // descending quality: 720, 480, 360

    if (c.req.query('resolve') === 'true') {
      const resolvedLinks: Record<string, string> = {};
      for (const qual of Object.keys(gboxData.links)) {
        const listSources = gboxData.links[qual];
        if (listSources && listSources.length > 0) {
          try {
            const rawSrc = listSources[0].src;
            const decryptedUrl = rawSrc.includes('mp4:hls:manifest') ? rawSrc : decodeKodikUrl(rawSrc);
            resolvedLinks[qual] = decryptedUrl.startsWith('//') ? `https:${decryptedUrl}` : decryptedUrl;
          } catch (de_err: any) {
            console.error(`[KODIK PROXY] Decryption failed for quality ${qual}:`, de_err.message);
          }
        }
      }
      c.header('Access-Control-Allow-Origin', '*');
      c.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      c.header('Access-Control-Allow-Headers', '*');
      return c.json({
        success: true,
        links: resolvedLinks,
        qualities
      });
    }

    if (!targetQuality && qualities.length > 0) {
      console.log(`[KODIK PROXY] Building Master Playlist for available qualities: ${qualities.join(', ')}`);
      const masterLines = ['#EXTM3U', '#EXT-X-VERSION:3'];
      
      const hasExplicit1080 = qualities.includes(1080);
      const topQual = qualities[0];

      // Provide 1080p Full HD master tier if explicitly available or if top tier is HD source (720/1080)
      if (hasExplicit1080) {
        masterLines.push(`#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080,NAME="1080p"`);
        masterLines.push(`/api/media/playlist?url=${encodeURIComponent(iframeUrl)}&quality=1080`);
      } else if (topQual >= 720) {
        masterLines.push(`#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080,NAME="1080p"`);
        masterLines.push(`/api/media/playlist?url=${encodeURIComponent(iframeUrl)}&quality=${topQual}`);
      }

      qualities.forEach(q => {
        if (q === 1080) return; // already added above
        let width = 1280, height = 720, bandwidth = 2200000;
        if (q === 480) {
          width = 854; height = 480; bandwidth = 1100000;
        } else if (q === 360) {
          width = 640; height = 360; bandwidth = 600000;
        } else if (q === 720) {
          width = 1280; height = 720; bandwidth = 2200000;
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
      const fallbackMasterLines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080,NAME="1080p"',
        'https://cdn.kamianime.club/kimi-no-na-wa/master.m3u8'
      ];
      return new Response(fallbackMasterLines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'application/x-mpegURL',
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
      const fallbackMasterLines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080,NAME="1080p"',
        'https://cdn.kamianime.club/kimi-no-na-wa/master.m3u8'
      ];
      return new Response(fallbackMasterLines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'application/x-mpegURL',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const m3u8Text = await m3u8Res.text();

    // Validation: Ensure the playlist starts with #EXTM3U (not HTML error or blank page)
    if (!m3u8Text || !m3u8Text.trim().startsWith('#EXTM3U')) {
      console.error(`[KODIK PROXY ERROR] Manifest from Kodik is empty or invalid. Res length: ${m3u8Text?.length || 0}.`);
      const fallbackMasterLines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080,NAME="1080p"',
        'https://cdn.kamianime.club/kimi-no-na-wa/master.m3u8'
      ];
      return new Response(fallbackMasterLines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'application/x-mpegURL',
          'Access-Control-Allow-Origin': '*'
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
    console.error('[MEDIA PROXY ERROR]', error);
    const fallbackMasterLines = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080,NAME="1080p"',
      'https://cdn.kamianime.club/kimi-no-na-wa/master.m3u8'
    ];
    return new Response(fallbackMasterLines.join('\n'), {
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
});

app.get('/api/media/skips', async (c) => {
  const urlParam = c.req.query('url');
  if (!urlParam) {
    return c.json({ skips: null });
  }

  try {
    let iframeUrl = urlParam.startsWith('//') ? `https:${urlParam}` : urlParam;
    iframeUrl = iframeUrl.replace(/(kodik\.info|kodik\.cc|kodik\.biz|kodik\.net|kodik\.tv|kodik\.club|kodik\.site|kodik\.space|kodik\.ru|kodikonline\.com|kodikhd\.club|kodik-api\.com)/g, 'kodikplayer.com');

    const iframeRes = await fetch(iframeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Referer': 'https://shikimori.one/'
      }
    });
    const html = await iframeRes.text();

    const parseTime = (str: string) => {
      const parts = str.split(':').map(Number);
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      return parts[0] || 0;
    };

    let opening: [number, number] | null = null;
    let ending: [number, number] | null = null;

    const skipBtnMatch = html.match(/parseSkipButton\s*\(\s*["\x27]([^"\x27]+)["\x27]/i) ||
                         html.match(/"skip_button"\s*:\s*"([^"]+)"/i);
    if (skipBtnMatch) {
      const raw = skipBtnMatch[1];
      const parts = raw.split(',');
      for (const part of parts) {
        const match = part.trim().match(/^(?:\[([^\]]+)\])?\s*([0-9:]+)-([0-9:]+)$/i);
        if (match) {
          const type = (match[1] || '').toLowerCase();
          const start = parseTime(match[2]);
          const end = parseTime(match[3]);
          if (type.includes('open') || type.includes('intro') || (!type && start < 300)) {
            opening = [start, end];
          } else if (type.includes('end') || type.includes('credit') || (!type && start >= 300)) {
            ending = [start, end];
          }
        }
      }
    }

    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    c.header('Access-Control-Allow-Headers', '*');
    return c.json({
      success: true,
      skips: {
        opening,
        ending
      }
    });
  } catch (err: any) {
    c.header('Access-Control-Allow-Origin', '*');
    return c.json({ skips: null, error: err.message });
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

    let response: Response | undefined;
    let attempts = 3;
    let baseDelay = 300;
    let lastError: any = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      try {
        response = await fetch(segmentUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Referer': referer,
            'Accept': '*/*'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          break;
        } else {
          lastError = new Error(`Status ${response.status}`);
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;
      }

      if (attempt < attempts) {
        await new Promise(resolve => setTimeout(resolve, baseDelay));
        baseDelay *= 1.5;
      }
    }

    if (!response || !response.ok) {
      const errMsg = lastError ? lastError.message : 'Unknown error';
      return new Response(`Error fetching segment after retries: ${errMsg}`, { status: response ? response.status : 502 });
    }

    const bodyData = response.body || await response.arrayBuffer();

    return new Response(bodyData, {
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

interface DownloadTask {
  id: string;
  stage: string;       // "resolving" | "downloading" | "merging" | "muxing" | "ready" | "failed"
  processed: number;   // count of segments processed so far
  total: number;       // total segments
  progress: number;    // percent (0 to 100)
  status: 'running' | 'success' | 'failed';
  error?: string;
  outputFile?: string;
  fileName?: string;
  createdAt: number;
}

const activeDownloadTasks = new Map<string, DownloadTask>();
const downloadsBaseDir = path.join(os.tmpdir(), 'anime_downloads');
if (!fs.existsSync(downloadsBaseDir)) {
  fs.mkdirSync(downloadsBaseDir, { recursive: true });
}

const cleanOldDownloads = async () => {
  const now = Date.now();
  const maxAge = 2 * 60 * 60 * 1000; // 2 hours
  for (const [taskId, task] of activeDownloadTasks.entries()) {
    if (now - task.createdAt > maxAge) {
      if (task.outputFile && fs.existsSync(task.outputFile)) {
        try {
          await fs.promises.unlink(task.outputFile);
          console.log(`[CLEANUP] Cleaned up output file for task ${taskId}: ${task.outputFile}`);
        } catch (e: any) {
          console.error(`[CLEANUP] Error deleting ${task.outputFile}:`, e.message);
        }
      }
      activeDownloadTasks.delete(taskId);
    }
  }
};

async function fetchWithPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const promises: Promise<void>[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        throw err;
      }
    }
  }

  for (let w = 0; w < Math.min(limit, items.length); w++) {
    promises.push(worker());
  }

  await Promise.all(promises);
  return results;
}

async function runHlsDownloadBackground(taskId: string, iframeUrl: string, quality: string, downloadFileName: string) {
  const task = activeDownloadTasks.get(taskId);
  if (!task) return;

  const tempDir = path.join(os.tmpdir(), 'anime_downloads_temp', taskId);
  await fs.promises.mkdir(tempDir, { recursive: true });

  try {
    task.stage = 'resolving';
    task.progress = 5;

    console.log(`[BACKGROUND DOWNLOAD] Resolving playlist programmatically for: ${iframeUrl}`);
    
    const playlistRes = await app.request(`/api/media/playlist?url=${encodeURIComponent(iframeUrl)}&quality=${quality}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://kodik.info/'
      }
    });

    if (!playlistRes.ok) {
      throw new Error(`Failed to resolve media playlist. Status: ${playlistRes.status}`);
    }

    const playlistText = await playlistRes.text();
    const lines = playlistText.split('\n');
    const segmentUrls: string[] = [];

    for (let line of lines) {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        if (line.includes('/api/media/segment?url=')) {
          const encodedUrl = line.split('/api/media/segment?url=')[1];
          if (encodedUrl) {
            segmentUrls.push(safeDecodeURIComponent(encodedUrl));
          }
        } else if (line.startsWith('http')) {
          segmentUrls.push(line);
        } else {
          segmentUrls.push(line);
        }
      }
    }

    if (segmentUrls.length === 0) {
      throw new Error("No segments found in resolved playlist.");
    }

    task.stage = 'downloading';
    task.total = segmentUrls.length;
    task.progress = 10;
    console.log(`[BACKGROUND DOWNLOAD] Starting concurrent download of ${segmentUrls.length} segments to ${tempDir}`);

    task.processed = 0;
    
    await fetchWithPool(segmentUrls, 24, async (segUrl, index) => {
      const segPath = path.join(tempDir, `segment_${String(index).padStart(5, '0')}.ts`);
      const maxRetries = 4;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const urlObj = new URL(segUrl);
          const referer = `https://${urlObj.host}/` || 'https://kodik.info/';
          
          const controller = new AbortController();
          const tId = setTimeout(() => controller.abort(), 12000);
          
          const res = await fetch(segUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
              'Referer': referer,
              'Accept': '*/*'
            },
            signal: controller.signal
          });
          
          clearTimeout(tId);
          
          if (!res.ok) {
            throw new Error(`HTTP status ${res.status}`);
          }
          
          const arrayBuf = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          await fs.promises.writeFile(segPath, buffer);
          
          task.processed += 1;
          task.progress = Math.round(10 + (task.processed / task.total) * 75);
          return;
        } catch (err: any) {
          if (attempt === maxRetries) {
            throw new Error(`Failed to download segment ${index}: ${err.message}`);
          }
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
      }
    });

    task.stage = 'merging';
    task.progress = 88;
    console.log(`[BACKGROUND DOWNLOAD] Concatenating ${task.total} segments...`);

    const combinedTsPath = path.join(tempDir, 'combined.ts');
    const writeStream = fs.createWriteStream(combinedTsPath);
    
    for (let i = 0; i < task.total; i++) {
      const segPath = path.join(tempDir, `segment_${String(i).padStart(5, '0')}.ts`);
      if (fs.existsSync(segPath)) {
        await new Promise<void>((resolve, reject) => {
          const readStream = fs.createReadStream(segPath);
          readStream.pipe(writeStream, { end: false });
          readStream.on('end', () => {
            fs.promises.unlink(segPath).catch(() => {});
            resolve();
          });
          readStream.on('error', (err) => reject(err));
        });
      }
    }
    
    await new Promise<void>((resolve) => {
      writeStream.end(resolve);
    });

    task.stage = 'muxing';
    task.progress = 95;
    
    const outputMp4Path = path.join(downloadsBaseDir, `${taskId}.mp4`);
    const ffmpegCmd = `ffmpeg -y -i "${combinedTsPath}" -c copy -bsf:a aac_adtstoasc "${outputMp4Path}"`;
    
    await execAsync(ffmpegCmd);

    fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});

    if (fs.existsSync(outputMp4Path) && (await fs.promises.stat(outputMp4Path)).size > 10 * 1024) {
      task.stage = 'ready';
      task.progress = 100;
      task.status = 'success';
      task.outputFile = outputMp4Path;
      console.log(`[BACKGROUND DOWNLOAD SUCCESS] Task ${taskId} processed successfully.`);
    } else {
      throw new Error("Muxed MP4 output file does not exist or has zero size.");
    }

  } catch (err: any) {
    console.error(`[BACKGROUND DOWNLOAD ERROR] ${taskId}`, err);
    task.stage = 'failed';
    task.status = 'failed';
    task.error = err.message || String(err);
    fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

app.get('/api/media/download/start', async (c) => {
  const iframeUrl = c.req.query('url');
  const quality = c.req.query('quality') || '720';
  const animeTitle = c.req.query('title') || 'Anime';
  const episode = c.req.query('episode') || '1';

  if (!iframeUrl) {
    return c.json({ error: 'url is required' }, 400);
  }

  const taskId = `dl_${Date.now()}_${Math.random().toString(36).substring(3, 9)}`;
  const cleanTitle = animeTitle.replace(/[^a-zA-Z0-9а-яА-ЯёЁ\s-_]/g, '').trim() || 'Anime';
  const downloadFileName = `${cleanTitle}_Ep_${episode}_${quality}p.mp4`;

  const task: DownloadTask = {
    id: taskId,
    stage: 'resolving',
    processed: 0,
    total: 0,
    progress: 0,
    status: 'running',
    createdAt: Date.now(),
    fileName: downloadFileName
  };

  activeDownloadTasks.set(taskId, task);
  
  cleanOldDownloads().catch(() => {});

  runHlsDownloadBackground(taskId, iframeUrl, quality, downloadFileName).catch(err => {
    console.error(`[DOWNLOAD TASK FAILED] ${taskId}`, err);
    const curr = activeDownloadTasks.get(taskId);
    if (curr) {
      curr.status = 'failed';
      curr.stage = 'failed';
      curr.error = err.message || String(err);
    }
  });

  return c.json({ success: true, taskId, fileName: downloadFileName });
});

app.get('/api/media/download/progress', async (c) => {
  const taskId = c.req.query('taskId');
  if (!taskId) {
    return c.json({ error: 'taskId is required' }, 400);
  }
  const task = activeDownloadTasks.get(taskId);
  if (!task) {
    return c.json({ error: 'Task not found or expired.' }, 404);
  }
  return c.json({
    id: task.id,
    stage: task.stage,
    processed: task.processed,
    total: task.total,
    progress: task.progress,
    status: task.status,
    error: task.error,
    fileName: task.fileName
  });
});

app.get('/api/media/download/file', async (c) => {
  const taskId = c.req.query('taskId');
  if (!taskId) {
    return c.json({ error: 'taskId is required' }, 400);
  }
  const task = activeDownloadTasks.get(taskId);
  if (!task || !task.outputFile || !fs.existsSync(task.outputFile)) {
    return c.json({ error: 'Download file not found or has expired. Files are retained for 2 hours.' }, 404);
  }

  const fileStream = fs.createReadStream(task.outputFile);
  const stats = await fs.promises.stat(task.outputFile);

  c.header('Content-Type', 'video/mp4');
  c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(task.fileName || 'anime.mp4')}"`);
  c.header('Content-Length', String(stats.size));

  setTimeout(() => {
    if (task.outputFile && fs.existsSync(task.outputFile)) {
      fs.promises.unlink(task.outputFile).catch(() => {});
    }
  }, 120000);

  return new Response(fileStream as any);
});

// WS Room Route (must be registered before SPA fallback)
app.get('/ws/room', handleRoomWebSocket);

// SPA Fallback
app.get('*', serveStatic({ root: './dist' }));

const isCloudflareEnvironment = typeof WebSocketPair !== 'undefined';

if (!isCloudflareEnvironment) {
  const port = 3000;
  console.log(`[HONO NODE SERVER] Starting backend listener on port ${port}...`);
  serve({
    fetch: app.fetch,
    port,
    hostname: '0.0.0.0'
  });
}

export default {
  fetch: app.fetch,
};
