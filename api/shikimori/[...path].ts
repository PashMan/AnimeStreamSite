
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, options: any, retries = 3, backoff = 1000) {
  let lastResponse;
  for (let i = 0; i < retries; i++) {
    lastResponse = await fetch(url, options);
    if (lastResponse.status === 429 && i < retries - 1) {
      await sleep(backoff * Math.pow(2, i));
      continue;
    }
    return lastResponse;
  }
  return lastResponse;
}

export default async function handler(req: any, res: any) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Vercel populates req.query.path for [...path].ts
  const pathParts = req.query.path || [];
  const path = Array.isArray(pathParts) ? pathParts.join('/') : pathParts;
  
  // Get query params excluding 'path'
  const query = new URLSearchParams();
  for (const key in req.query) {
    if (key !== 'path') {
      if (Array.isArray(req.query[key])) {
        req.query[key].forEach((v: string) => query.append(key, v));
      } else {
        query.append(key, req.query[key]);
      }
    }
  }
  
  const search = query.toString() ? `?${query.toString()}` : '';
  const targetUrl = `https://shikimori.one/api/${path}${search}`;

  try {
    const response = await fetchWithRetry(targetUrl, {
      headers: {
        'User-Agent': 'MyAnimeStreamApp/1.0',
        'Accept': 'application/json',
        'Referer': 'https://shikimori.one/'
      },
    });

    if (!response || !response.ok) {
      const status = response?.status || 500;
      return res.status(status).json({ error: `Shikimori API error: ${status}` });
    }

    const data = await response.json();

    // Dynamic Caching Strategy
    // Default: 1 hour (for lists, searches, ongoing)
    let cacheControl = 'public, s-maxage=3600, stale-while-revalidate=1800';
    
    // If it's a single anime object and it's released, cache for 24 hours
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.status === 'released') {
        cacheControl = 'public, s-maxage=86400, stale-while-revalidate=43200';
      }
    }

    res.setHeader('Cache-Control', cacheControl);
    return res.status(200).json(data);
  } catch (error: any) {
    console.error(`Proxy error for ${targetUrl}:`, error?.message);
    return res.status(500).json({ error: 'Proxy error', details: error?.message });
  }
}
