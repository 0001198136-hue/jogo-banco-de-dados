import { defineConfig } from 'vite';
import { resolve } from 'path';

// Vite só builda index.html por padrão. Como o projeto tem 3 páginas
// (jogador, projetor, admin), cada uma precisa ser um entry point aqui —
// senão o `vite build` gera só o index.html e as outras somem no deploy.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        projetor: resolve(__dirname, 'projetor.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});
