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

    let animes: any[] = [];

    try {
      // 2. Fetch Top Anime from Shikimori (Real-time)
      const response = await fetch(`${SHIKIMORI_API_URL}/animes?limit=50&order=popularity`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AnimeStreamProject/1.0',
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        animes = await response.json();
      } else {
        console.error("Sitemap Fetch Error:", response.status, await response.text());
      }
    } catch (fetchError) {
      console.error('Sitemap: Fetch error:', fetchError);
    }

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

    // 4. Send Response
    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');
    res.send(xml);

  } catch (error) {
    console.error('Sitemap generation error:', error);
    res.status(500).send('Error generating sitemap');
  }
}
