import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  root: 'src',
  plugins: [
    react({
      include: [/\.jsx$/],
    }),
    tailwindcss(),
  ],
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        table: 'table/index.html',
        detail: 'detail/index.html',
        import: 'import/index.html',
      },
    },
  },
});
