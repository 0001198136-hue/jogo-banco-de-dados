import { supabase, buscarSessaoAtiva } from './supabaseClient.js';
import {
  abrirCanalSessao,
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

function renderizarMundo({ perguntas, pool }) {
  const chao = $('#mundo-chao');
  chao.innerHTML = '';

  const nos = embaralhar([
    ...perguntas.map((p) => ({ role: 'pergunta', id: p.id, texto: p.conceito })),
    ...pool.map((r) => ({ role: 'resposta', id: r.id, texto: r.texto })),
  ]);

  nos.forEach((no) => {
    const el = document.createElement(no.role === 'pergunta' ? 'button' : 'div');
    if (no.role === 'pergunta') el.type = 'button';
    el.className = 'neuronio';
    el.dataset.id = no.id;
    el.dataset.role = no.role;
    el.textContent = no.texto;
    chao.appendChild(el);
  });
}

// Espalha os nós numa elipse ao redor do cérebro, todos visíveis de uma
// vez (sem scroll). Usa distância de arco igual entre os nós (em vez de
// ângulo igual) pra eles não ficarem espremidos no topo/embaixo — numa
// elipse, ângulos iguais NÃO viram distâncias iguais na tela.
function distanciasIguaisNaElipse(total, rx, ry, anguloInicial) {
  const passos = 720;
  const angulos = new Array(passos + 1);
  const comprimento = new Array(passos + 1);
  comprimento[0] = 0;
  angulos[0] = anguloInicial;
  for (let i = 1; i <= passos; i++) {
    const t0 = anguloInicial + ((i - 1) / passos) * Math.PI * 2;
    const t1 = anguloInicial + (i / passos) * Math.PI * 2;
    const dx = rx * (Math.cos(t1) - Math.cos(t0));
    const dy = ry * (Math.sin(t1) - Math.sin(t0));
    angulos[i] = t1;
    comprimento[i] = comprimento[i - 1] + Math.hypot(dx, dy);
  }
  const total_comprimento = comprimento[passos];

  const resultado = [];
  let ponteiro = 0;
  for (let i = 0; i < total; i++) {
    const alvo = (i / total) * total_comprimento;
    while (ponteiro < passos && comprimento[ponteiro] < alvo) ponteiro++;
    resultado.push(angulos[ponteiro]);
  }
  return resultado;
}

function posicionarCirculo(mundoEl) {
  const nos = Array.from(mundoEl.querySelectorAll('.neuronio'));
  const rect = mundoEl.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;

  const margem = 6;
  const nodeW = 96;
  const nodeH = 52;
  const rx = Math.max(cx - nodeW / 2 - margem, 60);
  const ry = Math.max(cy - nodeH / 2 - margem, 60);

  const anguloInicial = -Math.PI / 2; // começa no topo
  const angulos = distanciasIguaisNaElipse(nos.length, rx, ry, anguloInicial);

  nos.forEach((el, i) => {
    const angulo = angulos[i];
    const x = cx + rx * Math.cos(angulo);
    const y = cy + ry * Math.sin(angulo);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  });
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
  const channel = abrirCanalSessao(session.id);
  await pedirWakeLock();

  mostrarTela('jogo');

  let congelado = false;
  onFreeze(channel, () => { congelado = true; });

  const pool = montarPool(perguntas, decoys);
  renderizarMundo({ perguntas, pool });
  const poolPorId = new Map(pool.map((r) => [r.id, r]));

  const svg = $('#svg-fios');
  const mundoEl = $('#mundo');
  const mascoteEl = $('#mascote');
  const cerebroEl = $('.cerebro-fundo');
  const dicaEl = $('#dica-mundo');

  posicionarCirculo(mundoEl);

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

  // Seleção por toque: escolhe uma pergunta, depois toca na resposta pra ligar.
  // (toque-toque em vez de arrastar o fio com o dedo — mais confiável no celular.)
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