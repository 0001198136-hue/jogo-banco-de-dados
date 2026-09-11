# Conecta Ideias

Jogo web ao vivo de "conectar fios" (pergunta → resposta certa) pra até ~20 alunos
no celular, com telão ao vivo. Vite + JS puro + Supabase Realtime. Grátis, sem
servidor próprio.

## Deploy

1. `npm install`
2. Criar projeto em [supabase.com](https://supabase.com) → pegar `Project URL` e `anon key` (Settings → API).
3. Rodar **schema.sql** inteiro no SQL Editor do projeto (schema + RLS + função `now_ms()`). Pode rodar de novo sem medo se precisar.
4. Copiar `.env.example` pra `.env` e preencher com a URL/key do passo 2.
5. `npm run dev` pra testar local (abra `/`, `/admin.html` e `/projetor.html`).
6. `git init && git add . && git commit -m "primeira versão"` e subir pro GitHub.
7. Importar o repo na Vercel (zero config, ela detecta o Vite sozinha via `vercel.json`).
8. Na Vercel: Settings → Environment Variables → adicionar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, depois fazer um redeploy (env var nova só entra em builds novos).
9. Abrir `/admin.html` no seu próprio celular/notebook — é a única página que você acessa. Ela mostra o QR code pra `/` (a página do jogador).
10. Projetar `/projetor.html` no telão.

## Editar as perguntas

Edite `public/perguntas.json`: cada item de `perguntas` tem `conceito` (a pergunta) e
`correta` (a resposta certa). `decoys` é uma lista de respostas erradas extras
que aparecem misturadas no pool pra não ficar óbvio. Não precisa mexer em mais nada.

## Como funciona por dentro

- **`index.html` / `src/jogador.js`** — tela do aluno: nome → aguarda o admin iniciar → conecta pergunta com resposta tocando (não arrastando) → tela final com o tempo.
- **`admin.html` / `src/admin.js`** — cria a sessão, mostra o QR code, conta jogadores conectados, tem o botão "Iniciar sessão".
- **`projetor.html` / `src/projetor.js`** — telão: countdown da sessão, mini-cérebro de progresso por aluno e ranking ao vivo.
- **`src/supabase.js`** — cliente Supabase + todas as queries.
- **`src/realtime.js`** — canal de broadcast (progresso ao vivo) + `postgres_changes`/polling como rede de segurança pro ranking.
- **`src/tempo.js`** — sincronização de relógio com o servidor, countdown da sessão e cronômetro pessoal.

## Checklist antes do evento

- [ ] Testar com pelo menos 1 iPhone real (a tela sempre ligada — wake lock — é o ponto cego de sempre no Safari).
- [ ] Testar o Wi-Fi do local com 5+ devices simultâneos antes do dia.
- [ ] Abrir os links 5–10min antes pra "aquecer" o cold start do free tier da Vercel/Supabase.
- [ ] Confirmar no `/projetor.html` que o ranking segue atualizando mesmo desligando o Wi-Fi de um celular no meio (testa o fallback de polling).
- [ ] Depois do evento: apagar ou pausar o projeto Supabase. A RLS aqui é de propósito permissiva — a proteção real é essa.

## Decisões e limitações conhecidas

- **Conexão por toque, não arraste**: arrastar foi tentado e descartado — pra funcionar, precisa travar a rolagem da tela enquanto o dedo arrasta (`touch-action:none`), o que torna impossível alcançar respostas fora da área visível numa lista mais alta que a tela. Tocar numa pergunta e depois na resposta resolve isso sem abrir mão de nada da mecânica.
- **Congelamento ao fim do tempo**: cada celular (e o telão) calcula sozinho, a partir do relógio sincronizado com o servidor, quando o tempo da sessão acaba — não depende de nenhuma mensagem em tempo real chegar. Quem entra ou recarrega a página depois do tempo esgotado já carrega congelado, sem brecha.
- **Reconexão**: se o celular recarregar a página no meio do jogo, o `player_id` salvo no `localStorage` evita duplicar o jogador. Se o aluno já tinha terminado, a tela final aparece direto com o tempo já salvo — sem deixar rejogar e sobrescrever o tempo com um valor pior.
- **Timer**: a sincronização de clock via `now_ms()` degrada de forma silenciosa pra offset zero se a função não existir no banco (por exemplo, se você pular o `schema.sql`) — o jogo não quebra, só perde a correção de drift entre celulares.
