
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxyConfig = {
  // Use distinct proxy paths to avoid conflicts with reserved /api routes
  '/shikimori-proxy': {
    target: 'https://shikimori.one',
    changeOrigin: true,
    secure: false, // Allow self-signed certs if needed, though Shikimori is valid
    rewrite: (path) => path.replace(/^\/shikimori-proxy/, ''),
    headers: {
      'User-Agent': 'AnimeStream/1.0',
      'Referer': 'https://shikimori.one/'
    }
  },
  '/kodik-proxy': {
    target: 'https://kodikapi.com',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path.replace(/^\/kodik-proxy/, ''),
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