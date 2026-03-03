import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import sitemapHandler from './server-api/sitemap.xml.ts';

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

// Health Check
app.get('/api/health-check', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.get('/api/sitemap.xml', sitemapHandler);
app.get('/sitemap.xml', sitemapHandler);

// Proxies
const shikimoriProxy = createProxyMiddleware({
  target: 'https://shikimori.one/api',
  changeOrigin: true,
  secure: false,
  pathRewrite: { '^/api/shikimori': '' },
  onProxyReq: (proxyReq: any, req: any, res: any) => {
    proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    proxyReq.setHeader('Referer', 'https://shikimori.one/');
  },
  onError: (err: any, req: any, res: any) => {
    console.error('Shikimori Proxy Error:', err);
    res.status(500).send('Proxy Error');
  }
} as any);

app.use('/api/shikimori', shikimoriProxy);

const imageProxy = createProxyMiddleware({
  target: 'https://shikimori.one',
  changeOrigin: true,
  secure: false,
  pathRewrite: { '^/api/image': '' },
  onProxyReq: (proxyReq: any, req: any, res: any) => {
    proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    proxyReq.setHeader('Referer', 'https://shikimori.one/');
  },
  onError: (err: any, req: any, res: any) => {
    console.error('Image Proxy Error:', err);
    res.status(500).send('Proxy Error');
  }
} as any);

app.use('/api/image', imageProxy);

const kodikProxy = createProxyMiddleware({
  target: 'https://kodikapi.com',
  changeOrigin: true,
  secure: false,
  pathRewrite: { '^/kodik-proxy': '' },
  onError: (err: any, req: any, res: any) => {
    console.error('Kodik Proxy Error:', err);
    res.status(500).send('Proxy Error');
  }
} as any);

app.use('/kodik-proxy', kodikProxy);

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
