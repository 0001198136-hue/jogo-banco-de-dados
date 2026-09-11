import { supabase } from './supabase.js';

/**
 * Calcula o offset entre o relógio do celular e o do servidor, chamando
 * a função `now_ms()` do banco uma vez ao carregar. Corrige celular com
 * hora errada / drift entre devices. Se a função não existir (schema.sql
 * não rodado) ou o RPC falhar, degrada pra offset 0 — o jogo continua
 * funcionando normalmente, só sem a correção de drift entre aparelhos.
 */
export async function calcularOffset() {
  try {
    const t0 = Date.now();
    const { data, error } = await supabase.rpc('now_ms');
    const t1 = Date.now();
    if (error) throw error;
    const viagemMs = t1 - t0;
    const servidorNoMeio = Number(data) + viagemMs / 2;
    return servidorNoMeio - t1;
  } catch (err) {
    console.warn('[tempo] now_ms() indisponível, seguindo sem correção de offset.', err);
    return 0;
  }
}

export function agora(offsetMs) {
  return Date.now() + offsetMs;
}

export function formatarTempo(segundosTotais) {
  const s = Math.max(0, Math.round(segundosTotais));
  const min = String(Math.floor(s / 60)).padStart(2, '0');
  const seg = String(s % 60).padStart(2, '0');
  return `${min}:${seg}`;
}

/**
 * Countdown global da sessão — igual pra todo mundo (celular de cada
 * aluno + telão), calculado a partir do mesmo `started_at` do servidor
 * mais o offset de relógio de cada device. Não depende de nenhuma
 * mensagem chegar: mesmo quem entra ou recarrega a página depois do
 * tempo ter acabado calcula "acabou" sozinho, sem precisar ouvir ninguém.
 */
export function criarCountdown({ startedAtMs, duracaoSegundos, offsetMs, onTick, onFim }) {
  const fimMs = startedAtMs + duracaoSegundos * 1000;
  let encerrado = false;

  function passo() {
    if (encerrado) return;
    const restanteMs = fimMs - agora(offsetMs);
    const restanteSeg = Math.max(0, Math.ceil(restanteMs / 1000));
    onTick(restanteSeg);
    if (restanteMs <= 0) {
      encerrado = true;
      clearInterval(intervalId);
      onFim();
    }
  }

  const intervalId = setInterval(passo, 250);
  passo();
  return () => { encerrado = true; clearInterval(intervalId); };
}

/**
 * Cronômetro pessoal: conta pra cima desde o início da sessão, soma
 * penalidade a cada erro. `.parar()` congela o valor (vira o tempo_final
 * que decide o ranking) e `.pausarExibicao()` só para o ponteiro visual
 * sem "prender" o valor — usado quando o tempo da sessão acaba antes do
 * aluno terminar, pra não ficar contando pra sempre na tela dele.
 */
export function criarCronometro({ startedAtMs, offsetMs, onTick }) {
  let penalidadeMs = 0;
  let paradoEm = null;
  let pausado = false;

  const valorMs = () => {
    const fim = paradoEm ?? agora(offsetMs);
    return Math.max(0, fim - startedAtMs + penalidadeMs);
  };

  const intervalId = setInterval(() => {
    if (paradoEm === null && !pausado) onTick(valorMs() / 1000);
  }, 250);

  return {
    adicionarPenalidade(segundos = 3) {
      penalidadeMs += segundos * 1000;
    },
    pausarExibicao() {
      pausado = true;
    },
    segundosAtuais: () => valorMs() / 1000,
    parar() {
      if (paradoEm === null) paradoEm = agora(offsetMs);
      clearInterval(intervalId);
      return valorMs() / 1000;
    },
  };
}
