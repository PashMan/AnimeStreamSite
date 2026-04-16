import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE_URL = 'https://kamianime.club';
const SHIKIMORI_API = 'https://shikimori.one/api';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchHentaiAnime() {
  let hentaiUrls: string[] = [];
  console.log('Fetching hentai anime to remove...');
  
  // Fetching specifically rx rating or hentai genre (12)
  for (let page = 1; page <= 20; page++) {
      const url = `${SHIKIMORI_API}/animes?limit=50&rating=rx&page=${page}`;
      try {
          const response = await fetch(url, { headers: { 'User-Agent': 'KamiAnimeBot' } });
          if (!response.ok) break;
          const data = await response.json();
          if (!data || data.length === 0) break;
          
          const urls = data.map((anime: any) => `/anime/${anime.id}`);
          hentaiUrls.push(...urls);
          process.stdout.write('.');
          await delay(500);
      } catch (e) {
          break;
      }
  }
  console.log(`\nFound ${hentaiUrls.length} adult anime URLs to remove.`);
  return hentaiUrls;
}

async function generateRemoveSitemap() {
  const urls = await fetchHentaiAnime();
  if (urls.length === 0) return;

  const date = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(route => `  <url>
    <loc>${SITE_URL}${route}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`).join('\n')}
</urlset>`;

  const publicDir = path.resolve(process.cwd(), 'public');
  fs.writeFileSync(path.join(publicDir, 'sitemap-remove.xml'), xml);
  console.log('Generated sitemap-remove.xml');
}

generateRemoveSitemap().catch(console.error);
