
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
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'AnimeStreamProject/1.0 (contact: admin@anime-stream.ru)',
        'Accept': 'application/json',
        'Referer': 'https://shikimori.one/'
      },
    });

    const data = await response.text();
    
    // Set appropriate headers based on the response
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    
    // Dynamic Caching Strategy
    // Default: 1 hour (for lists, searches, ongoing)
    let cacheControl = 'public, s-maxage=3600, stale-while-revalidate=1800';
    
    // Try to parse JSON to determine if it's a released anime for longer caching
    try {
      if (response.ok) {
        const parsedData = JSON.parse(data);
        if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
          if (parsedData.status === 'released') {
            cacheControl = 'public, s-maxage=86400, stale-while-revalidate=43200';
          }
        }
      }
    } catch (e) {
      // Ignore parsing errors for cache control logic
    }

    res.setHeader('Cache-Control', cacheControl);
    return res.status(response.status).send(data);
  } catch (error: any) {
    console.error(`Proxy error for ${targetUrl}:`, error?.message);
    return res.status(500).json({ error: 'Proxy error', details: error?.message });
  }
}
