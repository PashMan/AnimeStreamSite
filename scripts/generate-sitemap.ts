import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE_URL = 'https://anime-stream.ru';
const SHIKIMORI_API = 'https://shikimori.one/api';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

let supabase: any = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('Missing Supabase credentials, skipping database routes');
}

const staticRoutes = [
  '/',
  '/catalog',
  '/forum',
  '/news',
  '/social',
  '/calendar',
  '/premium',
  '/login',
  '/register',
  '/reset-password'
];

// Helper to delay execution (to avoid rate limits)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const MAX_RETRIES = 5;
const BASE_DELAY = 2000;

async function fetchWithRetry(url: string, retries = 0): Promise<any> {
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'AnimeStream-Sitemap-Generator' }
        });

        if (response.ok) {
            return await response.json();
        }

        if (retries >= MAX_RETRIES) {
            console.error(`Failed to fetch ${url} after ${MAX_RETRIES} retries. Status: ${response.status}`);
            return null;
        }

        const status = response.status;
        if (status === 429 || status >= 500) {
            const delayTime = BASE_DELAY * Math.pow(2, retries);
            console.warn(`Request failed (${status}), retrying in ${delayTime}ms...`);
            await delay(delayTime);
            return fetchWithRetry(url, retries + 1);
        }

        console.error(`Request failed with status ${status}`);
        return null;
    } catch (error) {
        if (retries >= MAX_RETRIES) {
            console.error(`Failed to fetch ${url} after ${MAX_RETRIES} retries. Error:`, error);
            return null;
        }
        const delayTime = BASE_DELAY * Math.pow(2, retries);
        console.warn(`Request failed (error), retrying in ${delayTime}ms...`);
        await delay(delayTime);
        return fetchWithRetry(url, retries + 1);
    }
}

async function fetchAnimeBatch(page: number) {
  const data = await fetchWithRetry(`${SHIKIMORI_API}/animes?limit=50&order=popularity&page=${page}`);
  if (!data || !Array.isArray(data)) return [];
  return data.map((anime: any) => `/anime/${anime.id}`);
}

async function fetchTopAnime() {
  console.log('Fetching all anime (up to 20000)...');
  let allAnime: string[] = [];
  // Fetch top 20000 anime (400 pages * 50)
  const MAX_PAGES = 400; 
  
  for (let i = 1; i <= MAX_PAGES; i++) {
      const batch = await fetchAnimeBatch(i);
      if (batch.length === 0) {
          console.warn(`Page ${i} returned no data, stopping.`);
          break;
      }
      allAnime = [...allAnime, ...batch];
      process.stdout.write(`.`); // Progress indicator
      await delay(200); // 0.2s delay between successful requests
  }
  console.log(`\nFetched ${allAnime.length} anime URLs`);
  return allAnime;
}

async function fetchForumTopics() {
  if (!supabase) return [];
  console.log('Fetching forum topics...');
  // Fetch more topics for better indexing
  const { data, error } = await supabase
    .from('forum_topics')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(500);
    
  if (error) {
      console.error('Failed to fetch forum topics:', error);
      return [];
  }
  return (data || []).map((t: any) => `/forum/${t.id}`);
}

async function fetchClubs() {
  if (!supabase) return [];
  console.log('Fetching clubs...');
  const { data, error } = await supabase
    .from('clubs')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(200);
    
  if (error) {
      console.error('Failed to fetch clubs:', error);
      return [];
  }
  return (data || []).map((c: any) => `/club/${c.id}`);
}

async function fetchNews() {
    console.log('Fetching news...');
     try {
        // Fetch more news
        const response = await fetch(`${SHIKIMORI_API}/topics?forum=news&limit=100&linked_type=Anime`, {
          headers: { 'User-Agent': 'AnimeStream-Sitemap-Generator' }
        });
        if (!response.ok) {
            console.error('Failed to fetch news:', response.statusText);
            return [];
        }
        const data = await response.json();
        return data.map((news: any) => `/news/${news.id}`);
      } catch (e) {
        console.error('Failed to fetch news', e);
        return [];
      }
}

function generateSitemapXML(urls: string[], priority = '0.8', freq = 'weekly') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(route => `  <url>
    <loc>${SITE_URL}${route}</loc>
    <changefreq>${route === '/' ? 'daily' : freq}</changefreq>
    <priority>${route === '/' ? '1.0' : priority}</priority>
  </url>`).join('\n')}
</urlset>`;
}

function generateSitemapIndex(sitemaps: string[]) {
    const date = new Date().toISOString();
    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(name => `  <sitemap>
    <loc>${SITE_URL}/${name}</loc>
    <lastmod>${date}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>`;
}

async function generateSitemap() {
  console.log('Starting sitemap generation...');
  
  const publicDir = path.resolve(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Main Sitemap
  const mainXml = generateSitemapXML(staticRoutes, '1.0', 'daily');
  fs.writeFileSync(path.join(publicDir, 'sitemap-main.xml'), mainXml);
  console.log('Generated sitemap-main.xml');

  // 2. Anime Sitemap
  const animeRoutes = await fetchTopAnime();
  const animeXml = generateSitemapXML(animeRoutes, '0.8', 'weekly');
  fs.writeFileSync(path.join(publicDir, 'sitemap-anime.xml'), animeXml);
  console.log('Generated sitemap-anime.xml');

  // 3. News Sitemap
  const newsRoutes = await fetchNews();
  const newsXml = generateSitemapXML(newsRoutes, '0.7', 'daily');
  fs.writeFileSync(path.join(publicDir, 'sitemap-news.xml'), newsXml);
  console.log('Generated sitemap-news.xml');

  // 4. Forum Sitemap
  const forumRoutes = await fetchForumTopics();
  let forumSitemapName = '';
  if (forumRoutes.length > 0) {
      const forumXml = generateSitemapXML(forumRoutes, '0.6', 'daily');
      fs.writeFileSync(path.join(publicDir, 'sitemap-forum.xml'), forumXml);
      forumSitemapName = 'sitemap-forum.xml';
      console.log('Generated sitemap-forum.xml');
  }

  // 5. Clubs Sitemap
  const clubRoutes = await fetchClubs();
  let clubSitemapName = '';
  if (clubRoutes.length > 0) {
      const clubXml = generateSitemapXML(clubRoutes, '0.6', 'weekly');
      fs.writeFileSync(path.join(publicDir, 'sitemap-clubs.xml'), clubXml);
      clubSitemapName = 'sitemap-clubs.xml';
      console.log('Generated sitemap-clubs.xml');
  }

  // 6. Index Sitemap
  const sitemaps = [
      'sitemap-main.xml',
      'sitemap-anime.xml',
      'sitemap-news.xml',
      forumSitemapName,
      clubSitemapName
  ].filter(Boolean);

  const indexXml = generateSitemapIndex(sitemaps);
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), indexXml);
  console.log(`Sitemap Index generated successfully at public/sitemap.xml linking to ${sitemaps.length} files.`);
}

generateSitemap().catch(console.error);
