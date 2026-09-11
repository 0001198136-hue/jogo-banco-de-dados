import { supabase } from './supabaseClient.js';

/**
 * Cria o canal broadcast da sessão (ainda SEM se inscrever).
 * `self: false` porque cada client só precisa ouvir os outros —
 * ele já sabe o próprio estado localmente.
 *
 * IMPORTANTE: o Supabase Realtime só entrega broadcast pra handlers
 * registrados com .on(...) ANTES do .subscribe(). Handler registrado
 * depois do subscribe fica "surdo" — foi exatamente isso que fazia a
 * contagem de acertos nunca chegar no telão. Por isso a criação do
 * canal foi separada da inscrição: primeiro criarCanalSessao(), depois
 * TODOS os onProgresso/onFinalizado/onFreeze, só então inscreverCanal().
 */
export function criarCanalSessao(sessionId) {
  return supabase.channel(`session:${sessionId}`, {
    config: { broadcast: { self: false } },
  });
}

/** Chamar por último, depois de registrar todos os .on() do canal. */
export function inscreverCanal(channel) {
  channel.subscribe();
  return channel;
}

export function enviarProgresso(channel, playerId, progresso) {
  channel.send({
    type: 'broadcast',
    event: 'progresso',
    payload: { playerId, progresso },
  });
}

export function enviarFinalizado(channel, playerId, tempoFinal) {
  channel.send({
    type: 'broadcast',
    event: 'finalizado',
    payload: { playerId, tempoFinal },
  });
}

/** Admin dispara isso quando o countdown zera: trava novas conexões em todo mundo. */
export function enviarFreeze(channel) {
  channel.send({ type: 'broadcast', event: 'freeze', payload: {} });
}

export function onProgresso(channel, callback) {
  channel.on('broadcast', { event: 'progresso' }, ({ payload }) => callback(payload));
}

export function onFinalizado(channel, callback) {
  channel.on('broadcast', { event: 'finalizado' }, ({ payload }) => callback(payload));
}

export function onFreeze(channel, callback) {
  channel.on('broadcast', { event: 'freeze' }, () => callback());
}

/**
 * Fonte de verdade do ranking: escuta updates reais na tabela `players`.
 * O broadcast 'finalizado' é só o efeito visual instantâneo; se ele se
 * perder no meio do evento, isso aqui garante que o ranking final bate.
 */
export function assinarPlayersFinalizados(sessionId, callback) {
  const channel = supabase
    .channel(`players-db:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'players',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => callback(payload.new)
    )
    .subscribe();
  return channel;
}

/**
 * Rede de segurança do projetor: polling independente do WebSocket.
 * Custa quase nada com ~20 linhas e garante que o ranking nunca trava
 * mesmo se o Realtime cair no meio do evento.
 */
export function iniciarPollingPlayers(sessionId, callback, intervalMs = 3000) {
  const tick = async () => {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('session_id', sessionId);
    if (!error && data) callback(data);
  };
  tick();
  return setInterval(tick, intervalMs);
}
