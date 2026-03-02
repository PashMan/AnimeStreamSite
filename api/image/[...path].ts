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
  
  if (!path) {
    return res.status(400).json({ error: 'Missing image path' });
  }

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
  const targetUrl = `https://shikimori.one/${path}${search}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MyAnimeStream/1.0',
        'Referer': 'https://shikimori.one'
      },
    });

    if (!response.ok) {
      console.error(`Image proxy error [${response.status}] for ${targetUrl}`);
      return res.status(response.status).end();
    }

    const contentType = response.headers.get('Content-Type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year
    return res.send(Buffer.from(buffer));
  } catch (error: any) {
    console.error(`Image proxy catch error for ${targetUrl}:`, error?.message);
    return res.status(500).end();
  }
}
