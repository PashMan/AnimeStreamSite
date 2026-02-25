
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: {
      '/api/shikimori': {
        target: 'https://shikimori.one/api',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/shikimori/, ''),
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
    },
    host: true // Expose to network for testing
  },
  preview: {
    proxy: {
      '/api/shikimori': {
        target: 'https://shikimori.one/api',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/shikimori/, ''),
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
    },
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react'],
          'supabase-vendor': ['@supabase/supabase-js']
        }
      }
    }
  }
});