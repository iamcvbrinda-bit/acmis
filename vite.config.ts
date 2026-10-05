import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const port =
  process.env.PORT && process.env.PORT !== '8080'
    ? Number(process.env.PORT)
    : 3000;

const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  base: basePath,

  plugins: [
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'artifacts/acmis/src'),
      '@assets': path.resolve(
        import.meta.dirname,
        'attached_assets'
      ),
    },
    dedupe: ['react', 'react-dom'],
  },

  root: path.resolve(
    import.meta.dirname,
    'artifacts/acmis'
  ),

  build: {
    outDir: path.resolve(
      import.meta.dirname,
      'dist'
    ),
    emptyOutDir: true,
  },

  server: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,

    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },

  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
