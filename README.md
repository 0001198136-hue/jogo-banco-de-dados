<<<<<<< HEAD
# Conecta MongoDB — jogo ao vivo
=======
# Conecta Ideias
>>>>>>> 45d970c53b621152da7a21b047a05516c3d5fad2

Jogo de arrastar fio pra ligar pergunta e resposta, sobre o conteúdo do slide de
MongoDB/NoSQL. Feito pra 15–20 pessoas jogando ao mesmo tempo pelo celular,
competindo por tempo, com pódio no telão.

- `index.html` — página do jogador (celular, via QR code)
- `host.html` — telão/projetor: mostra QR, progresso ao vivo de todos, e o pódio final
- `js/questions.js` — os 10 pares pergunta/resposta (edite aqui se quiser trocar o conteúdo)
- `js/config.js` — URL e chave do Supabase

<<<<<<< HEAD
Sem build step — é HTML/JS puro com `<script type="module">`, dá pra subir
direto na Vercel como site estático.
=======
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
>>>>>>> 45d970c53b621152da7a21b047a05516c3d5fad2

## 1. Criar o backend (Supabase, grátis)

<<<<<<< HEAD
1. Crie um projeto em https://supabase.com (plano free).
2. Vá em **SQL Editor** e rode o conteúdo de `schema.sql`.
3. Vá em **Project Settings > API** e copie a **Project URL** e a **anon public key**.
4. Cole essas duas coisas em `js/config.js`:
   ```js
   export const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJ....";
   ```
5. Confirme que o **Realtime** está habilitado no projeto (vem ligado por padrão).

## 2. Deploy na Vercel

1. Suba essa pasta pra um repositório no GitHub.
2. Em https://vercel.com, **Add New > Project**, importe o repositório.
3. Framework preset: **Other** (é estático, não precisa de build command).
4. Deploy. Pronto — você recebe uma URL tipo `https://seu-projeto.vercel.app`.
=======
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
>>>>>>> 45d970c53b621152da7a21b047a05516c3d5fad2

## 3. No dia da apresentação

<<<<<<< HEAD
1. Abra `https://seu-projeto.vercel.app/host.html` no computador ligado ao projetor.
   Isso já usa a sala padrão `mongodb` (definida em `config.js`). Pra usar outra sala,
   acesse `host.html?room=NOMEDASALA`.
2. Os alunos escaneiam o QR code que aparece no telão — ele já abre `index.html`
   com a sala certa, eles só digitam o nome e "Entrar no jogo".
3. Cada aluno arrasta um fio da pergunta até a resposta certa. Errou, o card pisca
   vermelho e solta; acertou, o fio fica verde e trava.
4. O telão mostra a barra de progresso de todo mundo em tempo real.
5. Quando quiser encerrar (ou quando os primeiros já terminaram), clique
   **"Encerrar e mostrar pódio"** no telão — mostra os 3 primeiros com o tempo de cada um.

## Depois do evento

O Supabase free tier fica público (RLS aberta de propósito, sem login).
Depois da apresentação, pause ou delete o projeto no Supabase pra não deixar
isso exposto à toa.

## Trocar o conteúdo pra outro assunto

Edite só `js/questions.js` — é um array de `{ pair, question, answer }`.
O resto do jogo (drag, timer, ranking, pódio) não precisa mudar.
=======
- **Conexão por toque, não arraste**: arrastar foi tentado e descartado — pra funcionar, precisa travar a rolagem da tela enquanto o dedo arrasta (`touch-action:none`), o que torna impossível alcançar respostas fora da área visível numa lista mais alta que a tela. Tocar numa pergunta e depois na resposta resolve isso sem abrir mão de nada da mecânica.
- **Congelamento ao fim do tempo**: cada celular (e o telão) calcula sozinho, a partir do relógio sincronizado com o servidor, quando o tempo da sessão acaba — não depende de nenhuma mensagem em tempo real chegar. Quem entra ou recarrega a página depois do tempo esgotado já carrega congelado, sem brecha.
- **Reconexão**: se o celular recarregar a página no meio do jogo, o `player_id` salvo no `localStorage` evita duplicar o jogador. Se o aluno já tinha terminado, a tela final aparece direto com o tempo já salvo — sem deixar rejogar e sobrescrever o tempo com um valor pior.
- **Timer**: a sincronização de clock via `now_ms()` degrada de forma silenciosa pra offset zero se a função não existir no banco (por exemplo, se você pular o `schema.sql`) — o jogo não quebra, só perde a correção de drift entre celulares.
>>>>>>> 45d970c53b621152da7a21b047a05516c3d5fad2
