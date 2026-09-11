import { supabase, configurado, buscarSessaoAtiva, buscarSessaoPorId, criarPlayer, finalizarPlayer } from './supabase.js';
import { criarCanalSessao, inscreverCanal, enviarProgresso, enviarFinalizado } from './realtime.js';
import { calcularOffset, criarCountdown, criarCronometro, formatarTempo } from './tempo.js';

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

function mostrarErroCarregamento(mensagem) {
  mostrarTela('carregando');
  telas.carregando.innerHTML = `<p class="marca">${mensagem}</p>`;
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

let wakeLock = null;
async function pedirWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch {
    wakeLock = null; // não crítico — se falhar (ex.: aba em background), o jogo continua normalmente
  }
}
// iOS/Android liberam o wake lock sozinhos quando a aba vai pro background.
// Sem isso, quem troca de app 5 segundos e volta perde a tela sempre ligada
// pelo resto da partida.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeLock === null && telas.jogo.classList.contains('ativa')) {
    pedirWakeLock();
  }
});

function chaveLocalStorage(sessionId) {
  return `conecta-ideias:${sessionId}`;
}

async function obterOuCriarPlayer(session) {
  const chave = chaveLocalStorage(session.id);
  let salvo = null;
  try { salvo = JSON.parse(localStorage.getItem(chave) || 'null'); } catch { salvo = null; }

  if (salvo?.playerId) {
    const { data } = await supabase.from('players').select('*').eq('id', salvo.playerId).maybeSingle();
    if (data) return data; // reconexão: mesmo player, sem duplicar linha nem perder progresso salvo
  }

  return new Promise((resolve) => {
    mostrarTela('nome');
    const form = $('#form-nome');
    const input = $('#input-nome');
    const botao = form.querySelector('button');
    const erro = $('#erro-nome');

    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const nome = input.value.trim();
      if (!nome || botao.disabled) return;

      erro.textContent = '';
      botao.disabled = true;
      input.disabled = true;

      const { data, error } = await criarPlayer(session.id, nome);

      if (error) {
        erro.textContent = error.code === '23505'
          ? 'Esse nome já foi usado nessa sessão — tenta outro.'
          : 'Não deu pra entrar, tenta de novo.';
        botao.disabled = false;
        input.disabled = false;
        input.focus();
        return;
      }

      localStorage.setItem(chave, JSON.stringify({ playerId: data.id }));
      resolve(data);
    };
  });
}

async function esperarSessaoComecar(sessionId) {
  mostrarTela('aguardando');
  return new Promise((resolve) => {
    const intervalId = setInterval(async () => {
      const sessao = await buscarSessaoPorId(sessionId);
      if (sessao?.started_at) {
        clearInterval(intervalId);
        resolve(sessao);
      }
    }, 2000);
  });
}

function mostrarTelaFim(tempoFinal) {
  $('#tempo-final-texto').textContent = formatarTempo(tempoFinal);
  mostrarTela('fim');
}

// Perguntas numa coluna, respostas (certas + decoys) na outra — cada
// balão fica do tamanho que o texto pedir e a lista cresce pra baixo
// naturalmente. Testado em celular real: nada de posição calculada em
// JS, então não tem risco de balão sobrepondo balão.
function renderizarTabuleiro({ perguntas, pool }) {
  const chao = $('#tabuleiro-chao');
  const colunaPerguntas = document.createElement('div');
  colunaPerguntas.className = 'coluna coluna-perguntas';
  const colunaRespostas = document.createElement('div');
  colunaRespostas.className = 'coluna coluna-respostas';

  embaralhar(perguntas).forEach((p) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'no';
    el.dataset.id = p.id;
    el.dataset.tipo = 'pergunta';
    el.textContent = p.conceito;
    colunaPerguntas.appendChild(el);
  });

  embaralhar(pool).forEach((r) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'no';
    el.dataset.id = r.id;
    el.dataset.tipo = 'resposta';
    el.textContent = r.texto;
    colunaRespostas.appendChild(el);
  });

  chao.append(colunaPerguntas, colunaRespostas);
}

export async function iniciarJogo() {
  mostrarTela('carregando');

  if (!configurado) {
    mostrarErroCarregamento('Configuração do Supabase ausente. Fala com quem montou o jogo.');
    return;
  }

  let perguntas, decoys, session;
  try {
    const [dadosPerguntas, sessaoAtiva] = await Promise.all([
      fetch('/perguntas.json').then((r) => {
        if (!r.ok) throw new Error('perguntas.json não encontrado');
        return r.json();
      }),
      buscarSessaoAtiva(),
    ]);
    perguntas = dadosPerguntas.perguntas;
    decoys = dadosPerguntas.decoys;
    session = sessaoAtiva;
  } catch (err) {
    console.error(err);
    mostrarErroCarregamento('Não deu pra carregar o jogo. Confere sua internet e recarrega a página.');
    return;
  }

  if (!session) {
    mostrarErroCarregamento('Nenhuma sessão criada ainda. Fala com quem tá apresentando.');
    return;
  }

  const player = await obterOuCriarPlayer(session);

  // Aluno que já terminou e recarregou a página: mostra a tela final
  // direto com o tempo já salvo, sem deixar rejogar. Sem essa checagem,
  // o cronômetro reiniciaria a partir do started_at da sessão e, ao
  // terminar de novo, sobrescreveria o tempo_final no banco com um valor
  // maior (pior) do que o registrado da primeira vez — derrubando o
  // aluno no ranking por ter simplesmente atualizado a página.
  if (player.finalizado) {
    mostrarTelaFim(player.tempo_final ?? 0);
    return;
  }

  const sessaoIniciada = session.started_at ? session : await esperarSessaoComecar(session.id);
  const offset = await calcularOffset();
  const startedAtMs = new Date(sessaoIniciada.started_at).getTime();

  const channel = criarCanalSessao(session.id);
  inscreverCanal(channel);

  await pedirWakeLock();
  mostrarTela('jogo');

  const pool = montarPool(perguntas, decoys);
  renderizarTabuleiro({ perguntas, pool });
  const poolPorId = new Map(pool.map((r) => [r.id, r]));

  const svg = $('#svg-fios');
  const tabuleiroEl = $('#tabuleiro');
  const mascoteEl = $('#mascote');
  const cerebroEl = $('.cerebro-fundo');
  const dicaEl = $('#dica-mundo');

  function esconderDica() { dicaEl?.classList.add('escondida'); }
  const timeoutDica = setTimeout(esconderDica, 6000);

  function acenderCerebro(fracao) {
    cerebroEl?.style.setProperty('--progresso', String(fracao));
  }

  function pingCerebro() {
    const ping = document.createElement('div');
    ping.className = 'sinapse-ping';
    tabuleiroEl.appendChild(ping);
    ping.addEventListener('animationend', () => ping.remove());
  }

  function mostrarMascote(estado, duracaoMs) {
    if (!mascoteEl) return;
    mascoteEl.dataset.estado = estado;
    clearTimeout(mostrarMascote._timeoutId);
    mostrarMascote._timeoutId = setTimeout(() => { mascoteEl.dataset.estado = 'parado'; }, duracaoMs);
  }

  let erros = 0;
  let conectados = 0;
  const total = perguntas.length;
  const fiosPermanentes = []; // { origemEl, alvoEl, path } — redesenhados se a tela girar/redimensionar

  const cronometro = criarCronometro({
    startedAtMs,
    offsetMs: offset,
    onTick: (seg) => { $('#cronometro-pessoal').textContent = formatarTempo(seg); },
  });

  const pararCountdown = criarCountdown({
    startedAtMs,
    duracaoSegundos: sessaoIniciada.duration_seconds,
    offsetMs: offset,
    onTick: (seg) => { $('#countdown-sessao').textContent = formatarTempo(seg); },
    onFim: () => { congelarPorTempo(); },
  });

  function atualizarProgresso() {
    const progresso = Math.round((conectados / total) * 100);
    $('#barra-progresso').style.width = `${progresso}%`;
    acenderCerebro(conectados / total);
    enviarProgresso(channel, player.id, progresso);
  }

  function pontoCentral(el) {
    const rectSvg = svg.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - rectSvg.left, y: r.top + r.height / 2 - rectSvg.top };
  }

  function caminhoEntre(from, to) {
    const midX = (from.x + to.x) / 2;
    return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
  }

  function desenharFio(origemEl, alvoEl, classe) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', `fio ${classe}`);
    path.setAttribute('d', caminhoEntre(pontoCentral(origemEl), pontoCentral(alvoEl)));
    svg.appendChild(path);
    return path;
  }

  // Se o celular girar (ou o teclado abrir/fechar) depois de algumas
  // conexões já feitas, os fios permanentes recalculam a posição em vez
  // de ficar apontando pro lugar errado.
  function redesenharFiosPermanentes() {
    fiosPermanentes.forEach(({ origemEl, alvoEl, path }) => {
      path.setAttribute('d', caminhoEntre(pontoCentral(origemEl), pontoCentral(alvoEl)));
    });
  }
  window.addEventListener('resize', redesenharFiosPermanentes);
  window.addEventListener('orientationchange', redesenharFiosPermanentes);

  async function finalizarJogador() {
    clearTimeout(timeoutDica);
    pararCountdown();
    const tempoFinal = cronometro.parar();
    try {
      await finalizarPlayer(player.id, { tempoFinal, erros });
    } catch (err) {
      console.error('[jogador] falha ao salvar resultado final, tentando de novo em 2s', err);
      setTimeout(() => finalizarPlayer(player.id, { tempoFinal, erros }).catch(() => {}), 2000);
    }
    enviarFinalizado(channel, player.id, tempoFinal);
    cerebroEl?.classList.add('cerebro-completo');
    mostrarTelaFim(tempoFinal);
  }

  let congelado = false;
  function congelarPorTempo() {
    if (congelado) return;
    congelado = true;
    cronometro.pausarExibicao();
    limparSelecao();
    if (dicaEl) {
      dicaEl.textContent = 'Tempo esgotado — confere o ranking no telão';
      dicaEl.classList.remove('escondida');
    }
  }

  function onConectar(perguntaId, respostaId, perguntaEl, respostaEl) {
    const resposta = poolPorId.get(respostaId);
    const acertou = resposta?.perguntaId === perguntaId;

    if (acertou) {
      perguntaEl.dataset.conectado = '1';
      respostaEl.dataset.conectado = '1';
      perguntaEl.classList.add('no-aceso');
      respostaEl.classList.add('no-aceso');
      const path = desenharFio(perguntaEl, respostaEl, 'fio-certo');
      fiosPermanentes.push({ origemEl: perguntaEl, alvoEl: respostaEl, path });
      conectados += 1;
      atualizarProgresso();
      pingCerebro();
      mostrarMascote('acerto', 650);
      if (conectados === total) finalizarJogador();
    } else {
      erros += 1;
      cronometro.adicionarPenalidade(3);
      const fioErrado = desenharFio(perguntaEl, respostaEl, 'fio-errado');
      perguntaEl.classList.add('no-erro');
      respostaEl.classList.add('no-erro');
      mostrarMascote('erro', 1600);
      setTimeout(() => {
        fioErrado.remove();
        perguntaEl.classList.remove('no-erro');
        respostaEl.classList.remove('no-erro');
      }, 500);
    }
  }

  // Conexão por toque: toca numa pergunta pra selecionar, depois na
  // resposta certa pra ligar. É o único método de conexão — arrastar foi
  // testado e descartado porque, pra funcionar, o dedo precisa travar a
  // rolagem da tela (touch-action:none) enquanto arrasta; com duas
  // colunas mais altas que a tela isso torna impossível alcançar
  // respostas fora da área visível. Tocar não trava nada entre um toque
  // e outro, então a rolagem normal do navegador continua livre.
  let selecionada = null;

  function limparSelecao() {
    selecionada?.el.classList.remove('no-selecionado');
    selecionada = null;
  }

  function onTocarNo(el) {
    if (congelado) return;
    if (el.dataset.conectado === '1') return;
    esconderDica();

    if (el.dataset.tipo === 'pergunta') {
      if (selecionada?.el === el) { limparSelecao(); return; } // toca de novo = desmarca
      limparSelecao();
      selecionada = { id: el.dataset.id, el };
      el.classList.add('no-selecionado');
      return;
    }

    if (!selecionada) return; // precisa escolher a pergunta primeiro
    const perguntaSalva = selecionada;
    limparSelecao();
    onConectar(perguntaSalva.id, el.dataset.id, perguntaSalva.el, el);
  }

  // Um listener só no container (delegação de evento) em vez de um por
  // nó: funciona igual mesmo se o tabuleiro for re-renderizado no futuro,
  // sem depender da ordem entre "renderizar" e "escutar".
  $('#tabuleiro-chao').addEventListener('click', (ev) => {
    const el = ev.target.closest('.no');
    if (el) onTocarNo(el);
  });
}
