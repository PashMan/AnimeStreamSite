import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE_URL = 'https://anime-stream.ru'; // Change this to your domain
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

async function fetchTopAnime() {
  try {
    console.log('Fetching top anime...');
    const response = await fetch(`${SHIKIMORI_API}/animes?limit=50&order=popularity`, {
      headers: { 'User-Agent': 'AnimeStream-Sitemap-Generator' }
    });
    if (!response.ok) {
        console.error('Failed to fetch anime:', response.statusText);
        return [];
    }
    const data = await response.json();
    return data.map((anime: any) => `/anime/${anime.id}`);
  } catch (e) {
    console.error('Failed to fetch top anime', e);
    return [];
  }
}

async function fetchForumTopics() {
  if (!supabase) return [];
  console.log('Fetching forum topics...');
  const { data, error } = await supabase
    .from('forum_topics')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(50);
    
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
    .limit(50);
    
  if (error) {
      console.error('Failed to fetch clubs:', error);
      return [];
  }
  return (data || []).map((c: any) => `/club/${c.id}`);
}

async function fetchNews() {
    console.log('Fetching news...');
     try {
        const response = await fetch(`${SHIKIMORI_API}/topics?forum=news&limit=50&linked_type=Anime`, {
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

async function generateSitemap() {
  console.log('Generating sitemap...');
  
  const [animeRoutes, forumRoutes, clubRoutes, newsRoutes] = await Promise.all([
    fetchTopAnime(),
    fetchForumTopics(),
    fetchClubs(),
    fetchNews()
  ]);

  const allRoutes = [
    ...staticRoutes,
    ...animeRoutes,
    ...forumRoutes,
    ...clubRoutes,
    ...newsRoutes
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes.map(route => `  <url>
    <loc>${SITE_URL}${route}</loc>
    <changefreq>${route === '/' ? 'daily' : 'weekly'}</changefreq>
    <priority>${route === '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>`;

  const publicDir = path.resolve(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap);
  console.log(`Sitemap generated successfully with ${allRoutes.length} URLs at public/sitemap.xml`);
}

generateSitemap().catch(console.error);
