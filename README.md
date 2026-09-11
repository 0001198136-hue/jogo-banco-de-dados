# Conecta MongoDB — jogo ao vivo

Jogo de arrastar fio pra ligar pergunta e resposta, sobre o conteúdo do slide de
MongoDB/NoSQL. Feito pra 15–20 pessoas jogando ao mesmo tempo pelo celular,
competindo por tempo, com pódio no telão.

- `index.html` — página do jogador (celular, via QR code)
- `host.html` — telão/projetor: mostra QR, progresso ao vivo de todos, e o pódio final
- `js/questions.js` — os 10 pares pergunta/resposta (edite aqui se quiser trocar o conteúdo)
- `js/config.js` — URL e chave do Supabase

Sem build step — é HTML/JS puro com `<script type="module">`, dá pra subir
direto na Vercel como site estático.

## 1. Criar o backend (Supabase, grátis)

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

## 3. No dia da apresentação

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
