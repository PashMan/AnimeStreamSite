import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sitemapHandler from './api/sitemap.xml.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// API Routes
app.get('/api/sitemap.xml', sitemapHandler);
app.get('/sitemap.xml', sitemapHandler);

// Dynamic Meta Tags for Anime Pages (SSR-lite)
app.get('/anime/:id', async (req, res, next) => {
  const animeId = req.params.id.split('-')[0];
  
  try {
    const response = await fetch(`https://shikimori.one/api/animes/${animeId}`, {
      headers: { 'User-Agent': 'AnimeStream/1.0' }
    });
    
    if (!response.ok) return next();
    
    const anime: any = await response.json();
    const indexPath = process.env.NODE_ENV === 'production' 
      ? path.resolve(__dirname, 'dist', 'index.html')
      : path.resolve(__dirname, 'index.html');
      
    let html = await fs.promises.readFile(indexPath, 'utf-8');

    const title = `Смотреть ${anime.russian || anime.name} онлайн бесплатно`;
    const description = anime.description 
      ? anime.description.slice(0, 160).replace(/"/g, '&quot;') 
      : `Смотреть аниме ${anime.russian || anime.name} в хорошем качестве на AnimeStream.`;
    const image = anime.image?.original ? `https://shikimori.one${anime.image.original}` : '';

    // Inject Meta Tags
    html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
    html = html.replace('</head>', `
      <meta name="description" content="${description}">
      <meta property="og:title" content="${title}" />
      <meta property="og:description" content="${description}" />
      <meta property="og:image" content="${image}" />
      <meta property="og:type" content="video.movie" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${title}" />
      <meta name="twitter:description" content="${description}" />
      <meta name="twitter:image" content="${image}" />
    </head>`);

    // Inject bot content
    const botContent = `<div style="display:none"><h1>${anime.russian || anime.name}</h1><p>${anime.description}</p></div>`;
    html = html.replace('<div id="root"></div>', `<div id="root">${botContent}</div>`);

    res.send(html);
  } catch (e) {
    next();
  }
});

// Proxies
app.use('/api/shikimori', createProxyMiddleware({
  target: 'https://shikimori.one/api',
  changeOrigin: true,
  pathRewrite: { '^/api/shikimori': '' },
  onProxyReq: (proxyReq: any) => {
    proxyReq.setHeader('User-Agent', 'AnimeStream/1.0');
    proxyReq.setHeader('Referer', 'https://shikimori.one/');
  }
} as any));

app.use('/api/image', createProxyMiddleware({
  target: 'https://shikimori.one',
  changeOrigin: true,
  pathRewrite: { '^/api/image': '' },
  onProxyReq: (proxyReq: any) => {
    proxyReq.setHeader('User-Agent', 'AnimeStream/1.0');
    proxyReq.setHeader('Referer', 'https://shikimori.one/');
  }
} as any));

app.use('/kodik-proxy', createProxyMiddleware({
  target: 'https://kodikapi.com',
  changeOrigin: true,
  pathRewrite: { '^/kodik-proxy': '' }
}));

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
