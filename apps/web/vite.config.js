import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    strictPort: true,
    proxy: {
      '/api': process.env.API_ORIGIN ?? 'http://127.0.0.1:4000',
    },
  },
});
