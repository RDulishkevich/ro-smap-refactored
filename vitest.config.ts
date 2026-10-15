import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const root = path.resolve(__dirname);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'apps/web/src'),
      '@polevka/core': path.resolve(root, 'packages/core/src/index.ts'),
      '@polevka/design': path.resolve(root, 'packages/design/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./apps/web/src/test/setup.ts'],
    include: [
      'apps/web/src/**/*.test.{ts,tsx}',
      'packages/core/src/**/*.test.ts',
      'packages/design/src/**/*.test.ts',
    ],
    exclude: ['e2e/**', 'node_modules/**', 'apps/web/dist/**'],
    css: false,
  },
});
