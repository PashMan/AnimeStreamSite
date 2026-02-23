
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxyConfig = {
  '/api/shikimori': {
    target: 'https://shikimori.one/api',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/api\/shikimori/, ''),
    headers: {
      'User-Agent': 'AnimeStream/1.0',
      'Referer': 'https://shikimori.one/'
    }
  },
  '/kodik-proxy': {
    target: 'https://kodikapi.com',
    changeOrigin: true,
    secure: false,
    rewrite: (path: string) => path.replace(/^\/kodik-proxy/, ''),
  }
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: proxyConfig,
    host: true // Expose to network for testing
  },
  preview: {
    proxy: proxyConfig,
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    emptyOutDir: true,
  }
});