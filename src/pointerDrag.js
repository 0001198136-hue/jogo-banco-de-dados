/**
 * Sistema de drag do fio, usando Pointer Events (cobre mouse E touch com a
 * mesma API — o erro mais comum aqui é implementar só com mouse* e o drag
 * simplesmente não disparar no celular).
 *
 * O SVG não usa viewBox: mede em pixels reais do container a cada frame,
 * então funciona igual em qualquer tamanho de tela sem conta de escala.
 */
export function criarSistemaDrag({ container, svg, onConectar, estaCongelado }) {
  let origem = null;
  let pathAtivo = null;

  function coordsRelativas(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function centroDoNo(el) {
    const rect = el.getBoundingClientRect();
    return coordsRelativas(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function criarPathTemporario() {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'fio fio-arrastando');
    svg.appendChild(path);
    return path;
  }

  function atualizarPath(path, from, to) {
    const midX = (from.x + to.x) / 2;
    path.setAttribute('d', `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`);
  }

  function limparArraste() {
    pathAtivo?.remove();
    pathAtivo = null;
    origem = null;
  }

  /** Retorna o handler de pointerdown pra um nó de "pergunta" específico. */
  function iniciar(el, id) {
    return (ev) => {
      if (estaCongelado()) return;
      if (el.dataset.conectado === '1') return; // já resolvido, não reabre
      ev.preventDefault();
      origem = { id, el, ...centroDoNo(el) };
      pathAtivo = criarPathTemporario();
      el.setPointerCapture?.(ev.pointerId);
    };
  }

  function mover(ev) {
    if (!origem || !pathAtivo) return;
    atualizarPath(pathAtivo, origem, coordsRelativas(ev.clientX, ev.clientY));
  }

  function soltar(ev) {
    if (!origem) return;
    const alvoEl = document
      .elementFromPoint(ev.clientX, ev.clientY)
      ?.closest('.neuronio[data-role="resposta"]');

    const origemSalva = origem;
    limparArraste();

    if (alvoEl) {
      onConectar(origemSalva.id, alvoEl.dataset.id, origemSalva.el, alvoEl);
    }
  }

  container.addEventListener('pointermove', mover);
  container.addEventListener('pointerup', soltar);
  container.addEventListener('pointercancel', limparArraste);

  return { iniciar };
}
