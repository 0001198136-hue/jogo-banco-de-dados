import { supabase, buscarSessaoAtiva } from './supabaseClient.js';
import {
  criarCanalSessao,
  inscreverCanal,
  enviarProgresso,
  enviarFinalizado,
  onFreeze,
} from './realtime.js';
import {
  calcularOffset,
  criarCountdownSessao,
  criarCronometroJogador,
  formatarMMSS,
} from './timer.js';
const $ = (sel) => document.querySelector(sel);

const telas = {
  carregando: $('#tela-carregando'),
  nome: $('#tela-nome'),
  aguardando: $('#tela-aguardando'),
  jogo: $('#tela-jogo'),
  fim: $('#tela-fim'),
};

function mostrarTela(nome) {
  Object.entries(telas).forEach(([k, el]) => el?.classList.toggle('ativa', k === nome));
}

function embaralhar(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function montarPool(perguntas, decoys) {
  const respostas = perguntas.map((p) => ({ id: `r-${p.id}`, texto: p.correta, perguntaId: p.id }));
  const decoyNodes = decoys.map((texto, i) => ({ id: `d-${i}`, texto, perguntaId: null }));
  return embaralhar([...respostas, ...decoyNodes]);
}

async function pedirWakeLock() {
  if (!('wakeLock' in navigator)) return null;
  try {
    return await navigator.wakeLock.request('screen');
  } catch {
    return null; // não crítico — se falhar (ex.: aba em background), o jogo continua
  }
}

function chaveLocalStorage(sessionId) {
  return `quiz-cerebro:${sessionId}`;
}

async function obterOuCriarPlayer(session) {
  const chave = chaveLocalStorage(session.id);
  const salvo = JSON.parse(localStorage.getItem(chave) || 'null');

  if (salvo?.playerId) {
    const { data } = await supabase.from('players').select('*').eq('id', salvo.playerId).maybeSingle();
    if (data) return data; // reconexão: mesmo player, sem duplicar
  }

  return new Promise((resolve) => {
    mostrarTela('nome');
    const form = $('#form-nome');
    const input = $('#input-nome');
    const erro = $('#erro-nome');

    form.onsubmit = async (ev) => {
      ev.preventDefault();
      erro.textContent = '';
      const nome = input.value.trim();
      if (!nome) return;

      const { data, error } = await supabase
        .from('players')
        .insert({ session_id: session.id, nome })
        .select()
        .single();

      if (error) {
        erro.textContent = error.code === '23505'
          ? 'Esse nome já foi usado nessa sessão — tenta outro.'
          : 'Não deu pra entrar, tenta de novo.';
        return;
      }

      localStorage.setItem(chave, JSON.stringify({ playerId: data.id }));
      resolve(data);
    };
  });
}

async function esperarSessaoComecar(sessionId) {
  return new Promise((resolve) => {
    mostrarTela('aguardando');
    const intervalId = setInterval(async () => {
      const { data } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
      if (data?.started_at) {
        clearInterval(intervalId);
        resolve(data);
      }
    }, 2000);
  });
}

// Perguntas na coluna da esquerda, respostas (certas + decoys) na da
// direita — cada uma no seu "hemisfério" do cérebro. Cada coluna é fluxo
// normal de CSS (sem position:absolute nem conta de ângulo/elipse): o
// balão fica do tamanho que o texto pedir, sem truncar, e a lista cresce
// pra baixo naturalmente — nada de posição calculada em JS.
function renderizarMundo({ perguntas, pool }) {
  const chao = $('#mundo-chao');
  chao.innerHTML = '';

  const colunaPerguntas = document.createElement('div');
  colunaPerguntas.className = 'coluna-neuronios coluna-perguntas';
  const colunaRespostas = document.createElement('div');
  colunaRespostas.className = 'coluna-neuronios coluna-respostas';

  embaralhar(perguntas).forEach((p) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'neuronio';
    el.dataset.id = p.id;
    el.dataset.role = 'pergunta';
    el.textContent = p.conceito;
    colunaPerguntas.appendChild(el);
  });

  embaralhar(pool).forEach((r) => {
    const el = document.createElement('div');
    el.className = 'neuronio';
    el.dataset.id = r.id;
    el.dataset.role = 'resposta';
    el.textContent = r.texto;
    colunaRespostas.appendChild(el);
  });

  chao.append(colunaPerguntas, colunaRespostas);
}

export async function iniciarJogo() {
  mostrarTela('carregando');

  const [{ perguntas, decoys }, session] = await Promise.all([
    fetch('/perguntas.json').then((r) => r.json()),
    buscarSessaoAtiva(),
  ]);

  if (!session) {
    telas.carregando.textContent = 'Nenhuma sessão criada ainda. Fala com quem tá apresentando.';
    return;
  }

  const player = await obterOuCriarPlayer(session);
  const sessaoIniciada = session.started_at ? session : await esperarSessaoComecar(session.id);

  const offset = await calcularOffset();
  const startedAtMs = new Date(sessaoIniciada.started_at).getTime();

  // onFreeze precisa ser registrado ANTES de inscreverCanal — ver nota em realtime.js
  const channel = criarCanalSessao(session.id);
  let congelado = false;
  onFreeze(channel, () => { congelado = true; });
  inscreverCanal(channel);

  await pedirWakeLock();
  mostrarTela('jogo');

  const pool = montarPool(perguntas, decoys);
  renderizarMundo({ perguntas, pool });
  const poolPorId = new Map(pool.map((r) => [r.id, r]));

  const svg = $('#svg-fios');
  const mundoEl = $('#mundo');
  const mascoteEl = $('#mascote');
  const cerebroEl = $('.cerebro-fundo');
  const dicaEl = $('#dica-mundo');

  function esconderDica() { dicaEl?.classList.add('escondida'); }
  setTimeout(esconderDica, 6000);

  function acenderCerebro(fracao) {
    cerebroEl?.style.setProperty('--progresso', String(fracao));
  }

  function pingCerebro() {
    const ping = document.createElement('div');
    ping.className = 'sinapse-ping';
    mundoEl.appendChild(ping);
    ping.addEventListener('animationend', () => ping.remove());
  }

  // Troca a pose do mascote por um tempo e volta pra "parado" sozinho.
  function mostrarMascote(estado, duracaoMs) {
    if (!mascoteEl) return;
    mascoteEl.dataset.estado = estado;
    clearTimeout(mostrarMascote._timeoutId);
    mostrarMascote._timeoutId = setTimeout(() => {
      mascoteEl.dataset.estado = 'parado';
    }, duracaoMs);
  }

  let erros = 0;
  let conectados = 0;
  const total = perguntas.length;

  const cronometro = criarCronometroJogador({
    startedAtMs,
    offset,
    onTick: (seg) => { $('#cronometro-pessoal').textContent = formatarMMSS(seg); },
  });

  criarCountdownSessao({
    startedAtMs,
    durationSeconds: sessaoIniciada.duration_seconds,
    offset,
    onTick: (seg) => { $('#countdown-sessao').textContent = formatarMMSS(seg); },
    onFim: () => { congelado = true; },
  });

  function atualizarProgresso() {
    const progresso = Math.round((conectados / total) * 100);
    $('#barra-progresso').style.width = `${progresso}%`;
    acenderCerebro(conectados / total);
    enviarProgresso(channel, player.id, progresso);
  }

  function desenharFioPermanente(origemEl, alvoEl, classe) {
    const rectSvg = svg.getBoundingClientRect();
    const a = origemEl.getBoundingClientRect();
    const b = alvoEl.getBoundingClientRect();
    const from = { x: a.left + a.width / 2 - rectSvg.left, y: a.top + a.height / 2 - rectSvg.top };
    const to = { x: b.left + b.width / 2 - rectSvg.left, y: b.top + b.height / 2 - rectSvg.top };
    const midX = (from.x + to.x) / 2;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', `fio ${classe}`);
    path.setAttribute('d', `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`);
    svg.appendChild(path);
    return path;
  }

  async function finalizarJogador() {
    const tempoFinal = cronometro.parar();
    await supabase
      .from('players')
      .update({ tempo_final: tempoFinal, finalizado: true, erros })
      .eq('id', player.id);
    enviarFinalizado(channel, player.id, tempoFinal);
    $('#tempo-final-texto').textContent = formatarMMSS(tempoFinal);
    cerebroEl?.classList.add('cerebro-completo');
    mostrarTela('fim');
  }

  function onConectar(perguntaId, respostaId, perguntaEl, respostaEl) {
    const resposta = poolPorId.get(respostaId);
    const acertou = resposta?.perguntaId === perguntaId;

    if (acertou) {
      perguntaEl.dataset.conectado = '1';
      respostaEl.dataset.conectado = '1';
      perguntaEl.classList.add('neuronio-aceso');
      respostaEl.classList.add('neuronio-aceso');
      desenharFioPermanente(perguntaEl, respostaEl, 'fio-certo');
      conectados += 1;
      atualizarProgresso();
      pingCerebro();
      mostrarMascote('acerto', 650);
      if (conectados === total) finalizarJogador();
    } else {
      erros += 1;
      cronometro.adicionarPenalidade(3);
      const fioErrado = desenharFioPermanente(perguntaEl, respostaEl, 'fio-errado');
      perguntaEl.classList.add('neuronio-erro');
      respostaEl.classList.add('neuronio-erro');
      mostrarMascote('erro', 1600);
      setTimeout(() => {
        fioErrado.remove();
        perguntaEl.classList.remove('neuronio-erro');
        respostaEl.classList.remove('neuronio-erro');
      }, 500);
    }
  }

  // Conexão por toque: escolhe uma pergunta, depois toca na resposta pra
  // ligar. É o único método de conexão agora — o arraste (pointerDrag.js)
  // foi desativado porque dependia de touch-action:none na pergunta, o que
  // travava a rolagem da tela inteira enquanto o dedo ficava em contato.
  // Com duas colunas mais altas que a tela, isso tornava impossível chegar
  // em respostas fora da área visível: dava pra segurar o fio ou rolar a
  // tela, nunca as duas coisas ao mesmo tempo. Tocar em vez de arrastar
  // não tem esse problema, porque nada trava a rolagem entre um toque e
  // outro.
  let selecionada = null;

  function limparSelecao() {
    selecionada?.el.classList.remove('neuronio-selecionado');
    selecionada = null;
  }

  function onTocarNeuronio(el) {
    if (congelado) return;
    if (el.dataset.conectado === '1') return;
    esconderDica();

    if (el.dataset.role === 'pergunta') {
      if (selecionada?.el === el) { limparSelecao(); return; } // toca de novo = desmarca
      limparSelecao();
      selecionada = { id: el.dataset.id, el };
      el.classList.add('neuronio-selecionado');
      return;
    }

    if (!selecionada) return; // precisa escolher a pergunta primeiro
    const perguntaSalva = selecionada;
    limparSelecao();
    onConectar(perguntaSalva.id, el.dataset.id, perguntaSalva.el, el);
  }

  $('#mundo-chao').querySelectorAll('.neuronio').forEach((el) => {
    el.addEventListener('click', () => onTocarNeuronio(el));
  });
}