-- ==========================================================
-- Quiz Cérebro — schema Supabase
-- Rodar tudo isso no SQL Editor do projeto, na ordem.
-- ==========================================================

create table sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),   -- adicionado ao schema original: precisa pra achar "a sessão mais recente"
  started_at timestamptz,                 -- null até o apresentador clicar "iniciar"
  duration_seconds int default 600,
  active boolean default true
);

create table players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) not null,
  nome text not null,
  tempo_final numeric,
  erros integer default 0,
  finalizado boolean default false,
  created_at timestamptz default now(),
  unique (session_id, nome)      -- evita nomes duplicados na mesma sessão
);

-- RLS — permissiva de propósito (evento único, sem auth). Ver nota no README:
-- a proteção real é apagar/pausar o projeto Supabase depois do evento.
alter table sessions enable row level security;
alter table players enable row level security;

create policy "leitura publica sessions" on sessions
  for select using (true);

create policy "insert publico sessions" on sessions
  for insert with check (true);

create policy "update publico sessions" on sessions
  for update using (true);

create policy "leitura publica players" on players
  for select using (true);

create policy "insert publico players" on players
  for insert with check (true);

create policy "update publico players" on players
  for update using (true);

-- Sessões e players precisam estar na publicação de Realtime pra
-- postgres_changes funcionar (broadcast não precisa disso).
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table players;

-- Função usada pelo timer.js pra sincronizar o relógio de cada celular
-- com o relógio do servidor (corrige drift de clock do device).
create or replace function now_ms()
returns bigint
language sql
stable
as $$
  select (extract(epoch from now()) * 1000)::bigint;
$$;
