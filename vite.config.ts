import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5181, strictPort: true, host: '127.0.0.1' },
  // `npm run phone` serves the built game here to phones on the same Wi-Fi.
  preview: { port: 5182, strictPort: true },
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
});
