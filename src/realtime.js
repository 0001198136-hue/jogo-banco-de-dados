import { supabase } from './supabase.js';

/**
 * Cria o canal broadcast da sessão, ainda SEM se inscrever.
 * `self: false` porque cada client só precisa ouvir os outros — ele já
 * sabe o próprio estado localmente.
 *
 * IMPORTANTE: o Supabase Realtime só entrega broadcast pra handlers
 * registrados com `.on(...)` ANTES do `.subscribe()`. Um handler
 * registrado depois do subscribe fica surdo. Por isso a criação do canal
 * é sempre separada da inscrição nesse módulo: primeiro
 * `criarCanalSessao()`, depois TODOS os `on*(...)`, só então
 * `inscreverCanal()`.
 */
export function criarCanalSessao(sessionId) {
  return supabase.channel(`sessao:${sessionId}`, {
    config: { broadcast: { self: false } },
  });
}

/** Chamar por último, depois de registrar todos os listeners do canal. */
export function inscreverCanal(channel) {
  channel.subscribe();
  return channel;
}

export function enviarProgresso(channel, playerId, progresso) {
  channel.send({ type: 'broadcast', event: 'progresso', payload: { playerId, progresso } });
}

export function enviarFinalizado(channel, playerId, tempoFinal) {
  channel.send({ type: 'broadcast', event: 'finalizado', payload: { playerId, tempoFinal } });
}

export function onProgresso(channel, callback) {
  channel.on('broadcast', { event: 'progresso' }, ({ payload }) => callback(payload));
}

export function onFinalizado(channel, callback) {
  channel.on('broadcast', { event: 'finalizado' }, ({ payload }) => callback(payload));
}

/**
 * Fonte de verdade do ranking: escuta updates reais na tabela `players`.
 * O broadcast 'finalizado' é só o efeito visual instantâneo no telão; se
 * ele se perder no meio do evento (aba trocou de rede, etc.), isso aqui
 * garante que o ranking final sempre bate com o banco.
 */
export function assinarPlayersDoBanco(sessionId, callback) {
  return supabase
    .channel(`players-db:${sessionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${sessionId}` },
      (payload) => callback(payload.new)
    )
    .subscribe();
}

/**
 * Rede de segurança do projetor: polling independente do WebSocket.
 * Custa quase nada e garante que o ranking nunca trava mesmo se o
 * Realtime cair no meio do evento (Wi-Fi de escola não é sempre estável).
 * Retorna uma função pra cancelar.
 */
export function iniciarPollingPlayers(sessionId, callback, intervalMs = 3000) {
  let cancelado = false;
  const tick = async () => {
    if (cancelado) return;
    const { data, error } = await supabase.from('players').select('*').eq('session_id', sessionId);
    if (!error && data) callback(data);
  };
  tick();
  const intervalId = setInterval(tick, intervalMs);
  return () => { cancelado = true; clearInterval(intervalId); };
}
