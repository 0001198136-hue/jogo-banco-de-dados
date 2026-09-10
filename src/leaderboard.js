import { formatarMMSS } from './timer.js';

/**
 * players: array de linhas da tabela `players` (fonte de verdade = banco).
 * Só quem finalizou entra no ranking, ordenado por tempo_final crescente.
 */
export function ordenarRanking(players) {
  return players
    .filter((p) => p.finalizado && p.tempo_final != null)
    .sort((a, b) => a.tempo_final - b.tempo_final);
}

export function renderizarRanking(container, players, { congelado = false } = {}) {
  const ranking = ordenarRanking(players);

  container.innerHTML = '';
  container.classList.toggle('ranking-congelado', congelado);

  if (ranking.length === 0) {
    container.innerHTML = '<li class="ranking-vazio">Ninguém terminou ainda</li>';
    return;
  }

  ranking.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'ranking-item';
    if (i === 0) li.classList.add('ranking-primeiro');
    li.innerHTML = `
      <span class="ranking-posicao">${i + 1}º</span>
      <span class="ranking-nome">${escaparHtml(p.nome)}</span>
      <span class="ranking-tempo">${formatarMMSS(p.tempo_final)}</span>
    `;
    container.appendChild(li);
  });
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}
