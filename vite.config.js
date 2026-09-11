import { defineConfig } from 'vite';
import { resolve } from 'path';

// O Vite só builda index.html por padrão. Como o projeto tem 3 páginas
// (jogador, admin, projetor), cada uma precisa aparecer aqui como entry
// point — senão o `npm run build` gera só a raiz e as outras duas somem
// no deploy da Vercel (ficam 404).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        jogador: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        projetor: resolve(__dirname, 'projetor.html'),
      },
    },
  },
});
