import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!URL || !ANON_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    '[supabase] Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.\n' +
    'Local: copie .env.example para .env e preencha.\n' +
    'Vercel: Settings → Environment Variables (e faça redeploy depois de adicionar).'
  );
}

export const supabase = createClient(URL ?? '', ANON_KEY ?? '');

/** true quando as env vars nem foram configuradas — usado pra dar um erro claro em vez de travar carregando. */
export const configurado = Boolean(URL && ANON_KEY);

/** Busca a sessão ativa mais recente (a única que importa no dia do evento). Null se nenhuma existir ainda. */
export async function buscarSessaoAtiva() {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function buscarSessaoPorId(id) {
  const { data, error } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Cria uma sessão nova (chamado pelo admin.html quando não há nenhuma ativa). */
export async function criarSessao(duration_seconds = 600) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ duration_seconds, active: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function iniciarSessao(sessionId) {
  const { data, error } = await supabase
    .from('sessions')
    .update({ started_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function buscarPlayerPorId(id) {
  const { data, error } = await supabase.from('players').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function criarPlayer(sessionId, nome) {
  return supabase.from('players').insert({ session_id: sessionId, nome }).select().single();
}

export async function contarPlayers(sessionId) {
  const { count, error } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId);
  if (error) throw error;
  return count ?? 0;
}

export async function listarPlayers(sessionId) {
  const { data, error } = await supabase.from('players').select('*').eq('session_id', sessionId);
  if (error) throw error;
  return data ?? [];
}

export async function finalizarPlayer(playerId, { tempoFinal, erros }) {
  const { error } = await supabase
    .from('players')
    .update({ tempo_final: tempoFinal, finalizado: true, erros })
    .eq('id', playerId);
  if (error) throw error;
}
