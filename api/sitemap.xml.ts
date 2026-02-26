import { Request, Response } from 'express';
import { COLLECTIONS_DATA } from '../constants';

const SHIKIMORI_API_URL = 'https://shikimori.one/api';
const SITE_URL = 'https://anime-stream.ru';

export default async function sitemapHandler(req: Request, res: Response) {
  try {
    // 1. Static URLs
    const staticUrls = [
      '/',
      '/catalog',
      '/collections',
      '/news',
      '/forum',
      '/social',
      '/premium'
    ];

    let animes: any[] = [];

    try {
      // 2. Fetch Top 50 Anime from Shikimori by Popularity
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
        // Fallback: Use popular anime IDs if API fails
        animes = [
          { id: 52991 }, { id: 5114 }, { id: 40748 }, { id: 44511 }, { id: 11061 },
          { id: 38000 }, { id: 31964 }, { id: 21 }, { id: 1535 }, { id: 30276 },
          { id: 16498 }, { id: 20 }, { id: 19815 }, { id: 40028 }, { id: 32281 },
          { id: 9253 }, { id: 5114 }, { id: 1575 }, { id: 21 }, { id: 31964 }
        ];
      }
    } catch (fetchError) {
      console.error('Sitemap: Fetch error:', fetchError);
      // Fallback on error
      animes = [
          { id: 52991 }, { id: 5114 }, { id: 40748 }, { id: 44511 }, { id: 11061 },
          { id: 38000 }, { id: 31964 }, { id: 21 }, { id: 1535 }, { id: 30276 }
      ];
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

    // Add Collections URLs
    COLLECTIONS_DATA.forEach(collection => {
      xml += `
  <url>
    <loc>${SITE_URL}/collections/${collection.id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });

    // Add Anime URLs
    if (Array.isArray(animes)) {
      animes.forEach((anime: any) => {
        xml += `
  <url>
    <loc>${SITE_URL}/anime/${anime.id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
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
