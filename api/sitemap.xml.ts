import { Request, Response } from 'express';

const SHIKIMORI_API_URL = 'https://shikimori.one/api';

// Helper for slug generation (same as in shikimori.ts)
const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-');  // Replace multiple - with single -
};

// Hardcoded collections to ensure they appear in sitemap regardless of import issues
const COLLECTIONS = [
  { id: 'super-power' }, { id: 'friendship' }, { id: 'coming-of-age' },
  { id: 'parody' }, { id: 'romance' }, { id: 'sports' },
  { id: 'mecha' }, { id: 'music' }, { id: 'horror' },
  { id: 'martial-arts' }, { id: 'vampires' }, { id: 'adult-cast' },
  { id: 'video-games' }, { id: 'military' }, { id: 'survival' },
  { id: 'harem' }, { id: 'racing' }, { id: 'gag-humor' },
  { id: 'detective' }, { id: 'gore' }, { id: 'childcare' },
  { id: 'high-stakes-game' }, { id: 'idols-female' }, { id: 'idols-male' },
  { id: 'visual-arts' }, { id: 'performing-arts' }, { id: 'historical' },
  { id: 'iyashikei' }, { id: 'team-sports' }, { id: 'space' },
  { id: 'crossdressing' }, { id: 'otaku-culture' }, { id: 'love-polygon' },
  { id: 'magical-sex-shift' }, { id: 'mahou-shoujo' }, { id: 'medicine' },
  { id: 'mythology' }, { id: 'educational' }, { id: 'organized-crime' },
  { id: 'pets' }, { id: 'psychological' }, { id: 'time-travel' },
  { id: 'workplace' }, { id: 'reverse-harem' }, { id: 'reincarnation' },
  { id: 'romantic-subtext' }, { id: 'samurai' }, { id: 'combat-sports' },
  { id: 'strategy-game' }, { id: 'award-winning' }, { id: 'delinquents' },
  { id: 'school' }, { id: 'show-biz' }
];

// Simple in-memory cache for sitemap
let sitemapCache: { xml: string, timestamp: number } | null = null;
const SITEMAP_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

export default async function sitemapHandler(req: Request, res: Response) {
  const now = Date.now();
  
  // Return cached sitemap if available and not expired
  if (sitemapCache && (now - sitemapCache.timestamp < SITEMAP_CACHE_TTL)) {
    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    return res.send(sitemapCache.xml);
  }

  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const SITE_URL = `${protocol}://${host}`;
    const today = new Date().toISOString();

    // 1. Static URLs
    const staticUrls = [
      '/',
      '/catalog',
      '/collections',
      '/news',
      '/forum',
      '/social',
      '/premium',
      '/favorites'
    ];

    let animes: any[] = [];
    let news: any[] = [];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://shikimori.one/',
        'Accept': 'application/json'
      };

      // Fetch News
      const newsPromise = fetch(`${SHIKIMORI_API_URL}/topics?type=News&limit=20`, {
        headers: headers,
        signal: controller.signal
      }).then(res => res.ok ? res.json() : []);

      // Fetch Anime (Parallel pages)
      const animePromises = [];
      const MAX_PAGES = 20; // 20 * 50 = 1000 animes
      const PER_PAGE = 50;

      for (let i = 1; i <= MAX_PAGES; i++) {
        animePromises.push(
          fetch(`${SHIKIMORI_API_URL}/animes?limit=${PER_PAGE}&order=popularity&page=${i}`, {
            headers: headers,
            signal: controller.signal
          }).then(res => res.ok ? res.json() : [])
        );
      }

      const [newsData, ...animePages] = await Promise.all([newsPromise, ...animePromises]);
      
      clearTimeout(timeoutId);

      news = newsData;
      animes = animePages.flat();
    } catch (e) {
      console.error('Sitemap fetch error:', e);
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
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${priority}</priority>
  </url>`;
    });

    // Add News URLs
    if (Array.isArray(news)) {
      news.forEach((item: any) => {
        const lastmod = item.created_at ? new Date(item.created_at).toISOString() : today;
        xml += `
  <url>
    <loc>${SITE_URL}/news/${item.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
      });
    }

    // Add Collections URLs
    COLLECTIONS.forEach(collection => {
      xml += `
  <url>
    <loc>${SITE_URL}/collections/${collection.id}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });

    // Add Anime URLs with Slugs
    if (Array.isArray(animes)) {
      animes.forEach((anime: any) => {
        const slug = slugify(anime.name || anime.russian || 'anime');
        const lastmod = anime.updated_at ? new Date(anime.updated_at).toISOString() : today;
        
        xml += `
  <url>
    <loc>${SITE_URL}/anime/${anime.id}-${slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
      });
    }

    xml += `
</urlset>`;

    // 4. Update Cache
    sitemapCache = { xml, timestamp: Date.now() };

    // 5. Send Response
    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');
    res.send(xml);

  } catch (error) {
    console.error('Sitemap generation error:', error);
    res.status(500).send('Error generating sitemap');
  }
}
