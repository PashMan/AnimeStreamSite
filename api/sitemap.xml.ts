import { Request, Response } from 'express';

const SHIKIMORI_API_URL = 'https://shikimori.one/api';
const SITE_URL = 'https://anime-stream.ru';

export default async function sitemapHandler(req: Request, res: Response) {
  try {
    // 1. Static URLs
    const staticUrls = [
      '/',
      '/catalog',
      '/news',
      '/forum'
    ];

    // 2. Fetch Top Anime from Shikimori (Top 50 Popular)
    // Using fetch directly to avoid dependencies on internal services that might use browser APIs
    const response = await fetch(`${SHIKIMORI_API_URL}/animes?limit=50&order=popularity`, {
      headers: {
        'User-Agent': 'AnimeStream/1.0',
        'Referer': 'https://shikimori.one/'
      }
    });

    if (!response.ok) {
      console.error(`Shikimori API error: ${response.status}`);
      // Fallback to static URLs only if API fails
    }

    const animes = response.ok ? await response.json() : [];

    // 3. Generate XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Add Static URLs
    staticUrls.forEach(url => {
      const priority = url === '/' ? '1.0' : '0.8';
      xml += `
  <url>
    <loc>${SITE_URL}${url === '/' ? '' : url}</loc>
    <changefreq>daily</changefreq>
    <priority>${priority}</priority>
  </url>`;
    });

    // Add Anime URLs
    if (Array.isArray(animes)) {
      animes.forEach((anime: any) => {
        xml += `
  <url>
    <loc>${SITE_URL}/anime/${anime.id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
      });
    }

    xml += `
</urlset>`;

    // 4. Send Response with Headers
    res.setHeader('Content-Type', 'text/xml');
    // Cache for 24 hours (86400s), stale-while-revalidate for 12 hours (43200s)
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');
    res.send(xml);

  } catch (error) {
    console.error('Sitemap generation error:', error);
    res.status(500).send('Error generating sitemap');
  }
}
