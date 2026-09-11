import { formatarTempo } from './tempo.js';

/** players: array de linhas da tabela `players`. Só quem finalizou entra, ordenado por tempo crescente. */
export function ordenarRanking(players) {
  return players
    .filter((p) => p.finalizado && p.tempo_final != null)
    .sort((a, b) => a.tempo_final - b.tempo_final);
}

export function renderizarRanking(container, players, { congelado = false } = {}) {
  const ranking = ordenarRanking(players);
  container.classList.toggle('ranking-congelado', congelado);

  if (ranking.length === 0) {
    container.innerHTML = '<li class="ranking-vazio">Ninguém terminou ainda</li>';
    return;
  }

  container.innerHTML = ranking
    .map((p, i) => `
      <li class="ranking-item ${i === 0 ? 'ranking-primeiro' : ''}">
        <span class="ranking-posicao">${i + 1}º</span>
        <span class="ranking-nome">${escaparHtml(p.nome)}</span>
        <span class="ranking-tempo">${formatarTempo(p.tempo_final)}</span>
      </li>
    `)
    .join('');
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}
