# Conecta Ideias / Cérebro

Jogo web ao vivo de "conectar fios" (pergunta → resposta certa) pra até ~20 alunos
no celular, com telão ao vivo. Vite + JS puro + Supabase Realtime. Grátis, sem
servidor próprio.

## Deploy

1. `npm install`
2. Criar projeto em [supabase.com](https://supabase.com) → pegar `Project URL` e `anon key` (Settings → API).
3. Rodar **schema.sql** inteiro no SQL Editor do projeto (schema + RLS + função `now_ms()`).
4. Copiar `.env.example` pra `.env` e preencher com a URL/key do passo 2.
5. `npm run dev` pra testar local (abra `/`, `/admin.html` e `/projetor.html`).
6. `git push` pro GitHub, importar o repo na Vercel (zero config, detecta Vite).
7. Na Vercel: Settings → Environment Variables → adicionar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (a anon key é segura pra expor no client, é só isso que a RLS existe pra limitar).
8. Abrir `/admin.html` no seu próprio celular/notebook — é a única página que você acessa. Ela mostra o QR code pra `/` (a página do jogador).
9. Projetar `/projetor.html` no telão.

## Editar as perguntas

Edite `perguntas.json`: cada item de `perguntas` tem `conceito` (a pergunta) e
`correta` (a resposta certa). `decoys` é uma lista de respostas erradas extras
que aparecem misturadas no pool pra não ficar óbvio. Não precisa mexer em mais nada.

## Checklist antes do evento

- [ ] Testar com pelo menos 1 iPhone real (drag + wake lock são os pontos cegos de sempre).
- [ ] Testar o Wi-Fi do local com 5+ devices simultâneos antes do dia.
- [ ] Abrir os links 5–10min antes pra "aquecer" o cold start do free tier da Vercel/Supabase.
- [ ] Confirmar no `/projetor.html` que o ranking segue atualizando mesmo desligando o Wi-Fi de um celular no meio (testa o fallback de polling).
- [ ] Depois do evento: apagar ou pausar o projeto Supabase. A RLS aqui é de propósito permissiva — a proteção real é essa.

## Decisões e limitações conhecidas

- **Schema**: adicionei `created_at` em `sessions` (não estava no schema original) — é o que permite achar "a sessão ativa mais recente" sem precisar passar ID por query string.
- **`perguntas.json`**: troquei o formato de "múltipla escolha por pergunta" (`opcoes` + `correta` por item) pra um pool compartilhado de respostas + `decoys` globais, porque a mecânica descrita é de arrastar fio pra um pool de neurônios, não escolher entre alternativas por pergunta.
- **Reconexão**: se o celular recarregar a página no meio do jogo, o `player_id` salvo no `localStorage` evita duplicar o jogador e o cronômetro pessoal continua certo (ele é calculado a partir do `started_at` do servidor, não de um valor salvo local). O que **não** persiste são as conexões já feitas — o aluno recomeça o puzzle do zero, só sem perder o lugar na fila nem duplicar linha no banco. Pra um evento de 10min isso raramente é um problema prático (poucas pessoas recarregam no meio).
- **Timer**: a sincronização de clock via `now_ms()` degrada de forma silenciosa pra offset zero se a função não existir no banco (por exemplo, se você pular o `schema.sql`) — o jogo não quebra, só perde a correção de drift entre celulares.
