
const SHIKIMORI_API_URL = 'https://shikimori.one/api';

// Hardcoded collections
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

export const onRequest = async (context: any) => {
  try {
    const today = new Date().toISOString();
    const url = new URL(context.request.url);
    const SITE_URL = url.origin;

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

      // Fetch News
      const newsPromise = fetch(`${SHIKIMORI_API_URL}/topics?type=News&limit=20`, {
        headers: { 'User-Agent': 'KamiAnime/1.0', 'Accept': 'application/json' },
        signal: controller.signal
      }).then(res => res.ok ? res.json() : []);

      // Fetch Anime (Parallel pages) - EXCLUDE HENentai
      const animePromises = [];
      const MAX_PAGES = 25; // 25 * 50 = 1250 animes to compensate for filtering
      const PER_PAGE = 50;

      for (let i = 1; i <= MAX_PAGES; i++) {
        animePromises.push(
          fetch(`${SHIKIMORI_API_URL}/animes?limit=${PER_PAGE}&order=popularity&rating=!rx&genre=!12,!539,!33,!34,!28,!26&page=${i}`, {
            headers: { 'User-Agent': 'KamiAnime/1.0', 'Accept': 'application/json' },
            signal: controller.signal
          }).then(res => res.ok ? res.json() : [])
        );
      }

      const [newsData, ...animePages] = await Promise.all([newsPromise, ...animePromises]);
      
      clearTimeout(timeoutId);

      news = newsData as any[];
      animes = animePages.flat() as any[];

    } catch (e) {
      console.error('Sitemap fetch error:', e);
    }

    let dmcaBlocks: string[] = [];
    try {
      if (context.env?.DB) {
        const { results } = await context.env.DB.prepare('SELECT anime_id FROM dmca_blocks').all();
        if (results) {
          dmcaBlocks = results.map((r: any) => r.anime_id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch dmca blocks for sitemap:', e);
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

    // Add Anime URLs without Slugs to prevent indexing of english names
    if (Array.isArray(animes)) {
      animes.forEach((anime: any) => {
        const lastmod = anime.updated_at ? new Date(anime.updated_at).toISOString() : today;
        const isDmcaBlocked = dmcaBlocks.includes(anime.id.toString());
        const targetUrl = isDmcaBlocked ? `/anime/${anime.id}-watch` : `/anime/${anime.id}`;
        
        xml += `
  <url>
    <loc>${SITE_URL}${targetUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
      });
    }

    xml += `
</urlset>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'text/xml',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200'
      }
    });

  } catch (error) {
    console.error('Sitemap generation error:', error);
    return new Response('Error generating sitemap', { status: 500 });
  }
};
