import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works from any folder or sub-path.
  base: './',
  // Three.js alone is ~500 kB minified (~130 kB gzipped); that's expected, not a warning sign.
  // lookdev.html is the look-development page (src/lookdev.js), built too so it can be opened on phones.
  build: { chunkSizeWarningLimit: 600, rollupOptions: { input: { main: 'index.html', lookdev: 'lookdev.html' } } },
});
