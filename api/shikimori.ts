
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
        'User-Agent': 'AnimeStream/1.0',
        'Accept': 'application/json',
        'Referer': 'https://shikimori.one/'
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Shikimori API error: ${response.status}` });
    }

    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('application/json')) {
       console.error(`Upstream API returned ${contentType}`);
       return res.status(502).json({ error: 'Upstream API returned non-JSON response' });
    }

    const data = await response.json();

    // Aggressive Caching Headers
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');
    return res.status(200).json(data);
  } catch (error: any) {
    console.error(`Proxy error for ${targetUrl}:`, error?.message);
    return res.status(500).json({ error: 'Proxy error', details: error?.message });
  }
}
