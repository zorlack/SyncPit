import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: './client',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'client/index.html'),
        creator: resolve(__dirname, 'client/creator.html'),
        viewer: resolve(__dirname, 'client/viewer.html'),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/pit': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/stats': 'http://localhost:3000',
    },
  },
});
