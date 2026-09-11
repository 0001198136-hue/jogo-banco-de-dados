import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    'Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Copie .env.example pra .env e preencha, ou configure as env vars na Vercel.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Busca a sessão ativa mais recente (a única que importa no dia do evento).
 * Retorna null se nenhuma sessão foi criada ainda.
 */
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

/**
 * Cria uma sessão nova (chamado pelo admin.html se não houver nenhuma ativa).
 */
export async function criarSessao(durationSeconds = 600) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ duration_seconds: durationSeconds, active: true })
    .select()
    .single();

  if (error) throw error;
  return data;
}
