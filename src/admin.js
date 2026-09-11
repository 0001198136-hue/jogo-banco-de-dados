import QRCode from 'qrcode';
import { configurado, buscarSessaoAtiva, criarSessao, iniciarSessao, contarPlayers } from './supabase.js';

const $ = (sel) => document.querySelector(sel);
const DURACAO_PADRAO_SEGUNDOS = 600; // 10 minutos — ajuste aqui se a sessão precisar de outro tempo

function formatarHora(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR');
}

async function atualizarContador(sessionId) {
  try {
    const count = await contarPlayers(sessionId);
    $('#contador').textContent = `${count} jogador${count === 1 ? '' : 'es'} conectado${count === 1 ? '' : 's'}`;
  } catch {
    // falha silenciosa aqui não é crítica — o contador só tenta de novo no próximo tick
  }
}

async function main() {
  if (!configurado) {
    $('#status').textContent = 'Configuração do Supabase ausente (env vars VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).';
    return;
  }

  let session;
  try {
    session = await buscarSessaoAtiva();
    if (!session) session = await criarSessao(DURACAO_PADRAO_SEGUNDOS);
  } catch (err) {
    console.error(err);
    $('#status').textContent = 'Não deu pra conectar no Supabase. Confere as env vars e a internet.';
    return;
  }

  const urlJogo = new URL('/', window.location.origin).toString();
  $('#url-jogo').textContent = urlJogo;
  // Gerado localmente como SVG (não canvas.toDataURL): navegadores/extensões
  // de privacidade costumam bloquear extração de canvas sem interação do
  // usuário e devolvem pixels corrompidos em vez de erro — SVG não tem esse risco.
  $('#qr').innerHTML = await QRCode.toString(urlJogo, { type: 'svg', width: 260, margin: 1 });

  const botao = $('#btn-iniciar');
  if (session.started_at) {
    botao.disabled = true;
    botao.textContent = 'Sessão já iniciada';
    $('#status').textContent = `Iniciada às ${formatarHora(session.started_at)}`;
  }

  botao.addEventListener('click', async () => {
    botao.disabled = true;
    try {
      const atualizada = await iniciarSessao(session.id);
      botao.textContent = 'Sessão iniciada';
      $('#status').textContent = `Iniciada às ${formatarHora(atualizada.started_at)}`;
    } catch (err) {
      console.error(err);
      $('#status').textContent = 'Erro ao iniciar — tenta de novo.';
      botao.disabled = false;
    }
  });

  atualizarContador(session.id);
  setInterval(() => atualizarContador(session.id), 2000);
}

main();
