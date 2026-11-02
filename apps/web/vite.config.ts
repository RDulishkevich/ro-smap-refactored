import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

const root = path.resolve(__dirname, '../..');
const dist = path.resolve(__dirname, 'dist');

function spaFallback() {
  return {
    name: 'polevka-spa-fallback',
    closeBundle() {
      const index = path.join(dist, 'index.html');
      if (fs.existsSync(index)) fs.copyFileSync(index, path.join(dist, '404.html'));
      // staff.polevka.art can point at the same Pages deploy; prefer /staff.html entry.
      const staff = path.join(dist, 'staff.html');
      if (fs.existsSync(staff)) {
        const staffDir = path.join(dist, 'staff');
        fs.mkdirSync(staffDir, { recursive: true });
        fs.copyFileSync(staff, path.join(staffDir, 'index.html'));
      }
    },
  };
}

export default defineConfig({
  root: path.resolve(__dirname),
  publicDir: path.resolve(__dirname, 'public'),
  appType: 'spa',
  build: {
    outDir: dist,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        staff: path.resolve(__dirname, 'staff.html'),
      },
    },
  },
  plugins: [react(), tailwindcss(), spaFallback()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@polevka/core': path.resolve(root, 'packages/core/src/index.ts'),
      '@polevka/design': path.resolve(root, 'packages/design/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    host: true,
    fs: { allow: [root] },
    watch: { ignored: ['**/dist/**', '**/dist-build/**'] },
  },
  preview: {
    port: 4173,
    host: true,
  },
});
