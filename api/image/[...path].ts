
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

  const targetUrl = `https://shikimori.one/${path}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'AnimeStreamProject/1.0 (contact: admin@anime-stream.ru)',
        'Referer': 'https://shikimori.one/'
      },
    });

    if (!response.ok) {
      console.error(`Image proxy error [${response.status}] for ${targetUrl}`);
      return res.status(response.status).end();
    }

    const contentType = response.headers.get('Content-Type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable'); // Cache for 1 year
    return res.send(Buffer.from(buffer));
  } catch (error: any) {
    console.error(`Image proxy catch error for ${targetUrl}:`, error?.message);
    return res.status(500).end();
  }
}
