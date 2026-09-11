import { configurado, supabase, buscarSessaoAtiva, listarPlayers } from './supabase.js';
import { criarCanalSessao, inscreverCanal, onProgresso, onFinalizado, assinarPlayersDoBanco, iniciarPollingPlayers } from './realtime.js';
import { calcularOffset, criarCountdown, formatarTempo } from './tempo.js';
import { renderizarRanking } from './ranking.js';

const $ = (sel) => document.querySelector(sel);
const players = new Map(); // id -> { nome, progresso, finalizado, tempo_final }
let congelado = false;

function mergePlayer(id, patch) {
  const atual = players.get(id) || { nome: 'Jogador', progresso: 0, finalizado: false, tempo_final: null };
  players.set(id, { ...atual, ...patch });
  renderTudo();
}

function renderTudo() {
  const lista = Array.from(players.entries()).map(([id, p]) => ({ id, ...p }));
  renderizarGrid(lista);
  renderizarRanking($('#ranking-lista'), lista, { congelado });
  atualizarBrilhoTurma(lista);
}

function atualizarBrilhoTurma(lista) {
  const cerebroEl = $('.cerebro-turma');
  if (!cerebroEl || lista.length === 0) return;
  const media = lista.reduce((soma, p) => soma + (p.finalizado ? 100 : p.progresso), 0) / lista.length;
  cerebroEl.style.setProperty('--progresso', String(media / 100));
  cerebroEl.classList.toggle('cerebro-completo', lista.every((p) => p.finalizado));
}

function renderizarGrid(lista) {
  const container = $('#grid-cerebros');
  lista
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .forEach((p) => {
      let card = container.querySelector(`[data-player-id="${p.id}"]`);
      if (!card) {
        card = document.createElement('div');
        card.className = 'mini-cerebro';
        card.dataset.playerId = p.id;
        card.innerHTML = '<span class="nome"></span><div class="barra-fundo"><div class="barra"></div></div>';
        container.appendChild(card);
      }
      card.querySelector('.nome').textContent = p.nome;
      card.querySelector('.barra').style.width = `${p.finalizado ? 100 : p.progresso}%`;
      card.classList.toggle('finalizado', !!p.finalizado);
    });
}

async function esperarSessaoIniciada() {
  return new Promise((resolve) => {
    const tick = async () => {
      try {
        const s = await buscarSessaoAtiva();
        if (s?.started_at) { clearInterval(intervalId); resolve(s); }
      } catch (err) {
        console.error('[projetor] falha ao checar sessão', err);
      }
    };
    const intervalId = setInterval(tick, 2000);
    tick();
  });
}

async function main() {
  if (!configurado) {
    $('#titulo-projetor').textContent = 'Configuração do Supabase ausente';
    return;
  }

  const session = await esperarSessaoIniciada();
  $('#titulo-projetor').textContent = 'Conecta Ideias';

  try {
    const iniciais = await listarPlayers(session.id);
    iniciais.forEach((p) => players.set(p.id, {
      nome: p.nome, progresso: p.finalizado ? 100 : 0, finalizado: p.finalizado, tempo_final: p.tempo_final,
    }));
    renderTudo();
  } catch (err) {
    console.error('[projetor] falha ao carregar jogadores iniciais', err);
  }

  const offset = await calcularOffset();
  const startedAtMs = new Date(session.started_at).getTime();

  // onProgresso/onFinalizado precisam ser registrados ANTES de
  // inscreverCanal() — ver nota em realtime.js. É esse o motivo dos
  // acertos não atualizarem em tempo real se a ordem for invertida.
  const channel = criarCanalSessao(session.id);
  onProgresso(channel, ({ playerId, progresso }) => mergePlayer(playerId, { progresso }));
  onFinalizado(channel, ({ playerId }) => mergePlayer(playerId, { finalizado: true, progresso: 100 }));
  inscreverCanal(channel);

  assinarPlayersDoBanco(session.id, (row) => mergePlayer(row.id, {
    nome: row.nome, finalizado: row.finalizado, tempo_final: row.tempo_final,
  }));

  // Rede de segurança: independe de WebSocket, garante que o ranking
  // nunca trava mesmo se o Realtime cair no meio do evento.
  iniciarPollingPlayers(session.id, (lista) => {
    lista.forEach((row) => mergePlayer(row.id, {
      nome: row.nome, finalizado: row.finalizado, tempo_final: row.tempo_final,
    }));
  });

  const countdownEl = $('#countdown-sessao');
  criarCountdown({
    startedAtMs,
    duracaoSegundos: session.duration_seconds,
    offsetMs: offset,
    onTick: (seg) => {
      countdownEl.textContent = formatarTempo(seg);
      countdownEl.classList.toggle('acabando', seg <= 30);
    },
    onFim: () => {
      congelado = true;
      renderTudo();
    },
  });
}

main();
