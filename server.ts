import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
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
