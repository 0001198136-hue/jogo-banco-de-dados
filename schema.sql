-- ==========================================================
-- Conecta Ideias — schema Supabase
-- Rode tudo isso no SQL Editor do projeto, de uma vez.
-- É seguro rodar mais de uma vez (não duplica nada nem quebra
-- se algumas partes já existirem).
-- ==========================================================

create extension if not exists pgcrypto;

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  started_at timestamptz,               -- null até o apresentador clicar "iniciar"
  duration_seconds int not null default 600,
  active boolean not null default true
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  nome text not null,
  tempo_final numeric,
  erros integer not null default 0,
  finalizado boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, nome)             -- evita nomes duplicados na mesma sessão
);

alter table sessions enable row level security;
alter table players enable row level security;

-- RLS permissiva de propósito: é um evento único, sem autenticação de
-- aluno. A proteção real é apagar/pausar o projeto Supabase depois do
-- evento (ver checklist no README). `drop policy if exists` antes de
-- cada `create policy` deixa o script seguro pra rodar de novo.

drop policy if exists "sessions_select" on sessions;
create policy "sessions_select" on sessions for select using (true);

drop policy if exists "sessions_insert" on sessions;
create policy "sessions_insert" on sessions for insert with check (true);

drop policy if exists "sessions_update" on sessions;
create policy "sessions_update" on sessions for update using (true) with check (true);

drop policy if exists "players_select" on players;
create policy "players_select" on players for select using (true);

drop policy if exists "players_insert" on players;
create policy "players_insert" on players for insert with check (true);

drop policy if exists "players_update" on players;
create policy "players_update" on players for update using (true) with check (true);

-- sessions e players precisam estar na publicação de Realtime pra
-- postgres_changes funcionar (o broadcast usado pro progresso ao vivo
-- não depende disso, mas o ranking do projetor usa postgres_changes
-- como fonte de verdade). O bloco abaixo só adiciona a tabela se ela
-- ainda não estiver lá — `alter publication ... add table` dá erro se
-- rodado duas vezes sem essa checagem.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sessions'
  ) then
    alter publication supabase_realtime add table sessions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'players'
  ) then
    alter publication supabase_realtime add table players;
  end if;
end $$;

-- Usada pra sincronizar o relógio de cada celular com o do servidor
-- (corrige celular com hora errada / drift entre devices).
create or replace function now_ms()
returns bigint
language sql
stable
as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;
