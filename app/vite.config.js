import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// Read version from package.json
const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));
const version = packageJson.version || '0.0.0-dev';

export default defineConfig({
  root: './client',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
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
  plugins: [
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        return html.replace(/__APP_VERSION__/g, version);
      },
    },
  ],
});
