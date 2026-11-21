import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.PAGES_BASE_PATH || '/',
  server: {
    port: 5175,
    strictPort: true,
    watch: {
      ignored: ['**/.pnpm-store/**'],
      usePolling: true,
    },
  },
  preview: {
    port: 4175,
    strictPort: true,
  },
  test: {
    environment: 'node',
    pool: 'threads',
    maxWorkers: 1,
  },
});
