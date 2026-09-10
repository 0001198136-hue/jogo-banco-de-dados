import { supabase } from './supabaseClient.js';

/**
 * Sincroniza o relógio local com o do servidor UMA vez ao carregar a página.
 * Corrige o drift de celulares com hora errada. Se a função `now_ms()`
 * não existir no banco (schema.sql não rodado) ou o RPC falhar, degrada
 * pra offset 0 — o jogo continua funcionando, só sem a correção de drift.
 */
export async function calcularOffset() {
  try {
    const t0 = Date.now();
    const { data, error } = await supabase.rpc('now_ms');
    const t1 = Date.now();
    if (error) throw error;
    const serverNow = Number(data) + (t1 - t0) / 2; // compensa latência de ida/volta
    return serverNow - Date.now();
  } catch (e) {
    console.warn('[timer] sem now_ms() no banco, usando relógio local sem correção.', e);
    return 0;
  }
}

export function agoraReal(offset) {
  return Date.now() + offset;
}

/**
 * Countdown global da sessão (10min, igual pra todo mundo — presente no
 * projetor e em cada celular). Não é afetado por penalidades individuais.
 * Retorna uma função pra cancelar o interval.
 */
export function criarCountdownSessao({ startedAtMs, durationSeconds, offset, onTick, onFim }) {
  const fimMs = startedAtMs + durationSeconds * 1000;

  const passo = () => {
    const restanteMs = fimMs - agoraReal(offset);
    const restanteSeg = Math.max(0, Math.ceil(restanteMs / 1000));
    onTick(restanteSeg);
    if (restanteMs <= 0) {
      clearInterval(intervalId);
      onFim();
    }
  };

  const intervalId = setInterval(passo, 250);
  passo();
  return () => clearInterval(intervalId);
}

/**
 * Cronômetro pessoal do jogador: conta pra cima desde o início da sessão
 * e soma penalidade a cada erro. `.parar()` congela o valor — isso vira
 * o `tempo_final` que decide o ranking.
 */
export function criarCronometroJogador({ startedAtMs, offset, onTick }) {
  let penalidadeMs = 0;
  let paradoEm = null;

  const tempoAtualMs = () => {
    const fim = paradoEm ?? agoraReal(offset);
    return fim - startedAtMs + penalidadeMs;
  };

  const intervalId = setInterval(() => {
    if (paradoEm === null) onTick(tempoAtualMs() / 1000);
  }, 250);

  return {
    adicionarPenalidade(segundos = 3) {
      penalidadeMs += segundos * 1000;
    },
    tempoAtualSegundos: () => tempoAtualMs() / 1000,
    parar() {
      if (paradoEm === null) paradoEm = agoraReal(offset);
      clearInterval(intervalId);
      return tempoAtualMs() / 1000;
    },
  };
}

export function formatarMMSS(segundosTotais) {
  const s = Math.max(0, Math.round(segundosTotais));
  const min = Math.floor(s / 60).toString().padStart(2, '0');
  const seg = (s % 60).toString().padStart(2, '0');
  return `${min}:${seg}`;
}
