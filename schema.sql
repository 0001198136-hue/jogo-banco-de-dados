-- Rode isso no SQL Editor do Supabase (Project > SQL Editor > New query).
-- Guarda o resultado final de cada jogador. O progresso ao vivo NÃO passa
-- por aqui — ele viaja só pelo Realtime Broadcast (mais rápido, sem gravar
-- linha por linha no banco).

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  room text not null,
  player_id uuid not null,
  name text not null,
  time_ms integer not null,
  created_at timestamptz not null default now()
);

alter table public.results enable row level security;

-- RLS de propósito bem aberta: é um evento único, sem login de aluno.
-- Depois da apresentação, pause ou apague o projeto Supabase (free tier)
-- pra não deixar isso exposto indefinidamente.
create policy "Permitir tudo (evento único, sem auth)"
  on public.results
  for all
  using (true)
  with check (true);
