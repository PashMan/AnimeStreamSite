
export default async function handler(req: any, res: any) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get the path from the URL
  // req.url contains the full path including /api/shikimori
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname.replace('/api/shikimori', '');
  const search = url.search;

  const targetUrl = `https://shikimori.one/api${path}${search}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'AnimeStreamProject/1.0 (contact: admin@anime-stream.ru)',
        'Accept': 'application/json',
        'Referer': 'https://shikimori.one/'
      }
    });
    
    const data = await response.text();
    
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    
    // Aggressive Caching Headers
    let cacheControl = 'public, s-maxage=3600, stale-while-revalidate=1800';
    try {
      if (response.ok) {
        const parsedData = JSON.parse(data);
        if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
          if (parsedData.status === 'released') {
            cacheControl = 'public, s-maxage=86400, stale-while-revalidate=43200';
          }
        }
      }
    } catch (e) {}

    res.setHeader('Cache-Control', cacheControl);
    return res.status(response.status).send(data);
  } catch (error: any) {
    console.error(`Proxy error for ${targetUrl}:`, error?.message);
    return res.status(500).json({ error: 'Proxy error', details: error?.message });
  }
}
