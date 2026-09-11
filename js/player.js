import { supabase } from "./supabaseClient.js";
import { QUESTIONS } from "./questions.js";
import { DEFAULT_ROOM } from "./config.js";

const params = new URLSearchParams(location.search);
const room = params.get("room") || DEFAULT_ROOM;

const setupScreen = document.getElementById("setup-screen");
const gameScreen = document.getElementById("game-screen");
const finishScreen = document.getElementById("finish-screen");
const nameInput = document.getElementById("name-input");
const startBtn = document.getElementById("start-btn");
const colQ = document.getElementById("col-questions");
const colA = document.getElementById("col-answers");
const svg = document.getElementById("wires");
const board = document.getElementById("board");
const timerEl = document.getElementById("timer");
const progressLabel = document.getElementById("progress-label");
const finishTimeEl = document.getElementById("finish-time");

let playerId = localStorage.getItem("quiz_player_id");
if (!playerId) {
  playerId = crypto.randomUUID();
  localStorage.setItem("quiz_player_id", playerId);
}

let channel;
let startTime = 0;
let timerInterval = null;
let correctCount = 0;
const total = QUESTIONS.length;

let dragging = null; // { pair, fromEl, tempLine }

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function svgNS(tag) {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

function dotCenter(dotEl) {
  const r = dotEl.getBoundingClientRect();
  const b = board.getBoundingClientRect();
  return { x: r.left + r.width / 2 - b.left, y: r.top + r.height / 2 - b.top };
}

function drawPermanentLine(fromDot, toDot) {
  const p1 = dotCenter(fromDot);
  const p2 = dotCenter(toDot);
  const line = svgNS("line");
  line.setAttribute("x1", p1.x);
  line.setAttribute("y1", p1.y);
  line.setAttribute("x2", p2.x);
  line.setAttribute("y2", p2.y);
  line.setAttribute("stroke", "#2dd4a7");
  line.setAttribute("stroke-width", "3");
  line.setAttribute("stroke-linecap", "round");
  svg.appendChild(line);
}

function buildBoard() {
  const answersShuffled = shuffled(QUESTIONS);

  QUESTIONS.forEach((q) => {
    const node = document.createElement("div");
    node.className = "node";
    node.dataset.pair = q.pair;
    node.innerHTML = `${q.question}<span class="dot"></span>`;
    colQ.appendChild(node);
  });

  answersShuffled.forEach((q) => {
    const node = document.createElement("div");
    node.className = "node";
    node.dataset.pair = q.pair;
    node.innerHTML = `<span class="dot"></span>${q.answer}`;
    colA.appendChild(node);
  });

  progressLabel.textContent = `0 / ${total} ligados`;
}

function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    const s = (Date.now() - startTime) / 1000;
    timerEl.textContent = `${s.toFixed(1)}s`;
  }, 100);
}

function broadcastProgress() {
  if (!channel) return;
  channel.send({
    type: "broadcast",
    event: "progress",
    payload: { player_id: playerId, name: nameInput.value.trim(), correct: correctCount, total },
  });
}

async function finishGame() {
  clearInterval(timerInterval);
  const timeMs = Date.now() - startTime;
  finishTimeEl.textContent = `${(timeMs / 1000).toFixed(1)}s`;

  if (channel) {
    channel.send({
      type: "broadcast",
      event: "finished",
      payload: { player_id: playerId, name: nameInput.value.trim(), time_ms: timeMs },
    });
  }

  try {
    await supabase.from("results").insert({
      room,
      player_id: playerId,
      name: nameInput.value.trim(),
      time_ms: timeMs,
    });
  } catch (e) {
    console.warn("Não deu pra salvar o resultado:", e);
  }

  gameScreen.classList.add("hidden");
  finishScreen.classList.remove("hidden");
}

function getPointerPos(evt) {
  const b = board.getBoundingClientRect();
  return { x: evt.clientX - b.left, y: evt.clientY - b.top };
}

function onPointerDown(evt) {
  const node = evt.target.closest(".col-q .node");
  if (!node || node.classList.contains("correct")) return;
  evt.preventDefault();

  const dot = node.querySelector(".dot");
  const start = dotCenter(dot);

  const tempLine = svgNS("line");
  tempLine.setAttribute("x1", start.x);
  tempLine.setAttribute("y1", start.y);
  tempLine.setAttribute("x2", start.x);
  tempLine.setAttribute("y2", start.y);
  tempLine.setAttribute("stroke", "#38bdf8");
  tempLine.setAttribute("stroke-width", "3");
  tempLine.setAttribute("stroke-dasharray", "6 4");
  svg.appendChild(tempLine);

  node.classList.add("dragging");
  dragging = { pair: node.dataset.pair, fromNode: node, tempLine };
}

function onPointerMove(evt) {
  if (!dragging) return;
  const pos = getPointerPos(evt);
  dragging.tempLine.setAttribute("x2", pos.x);
  dragging.tempLine.setAttribute("y2", pos.y);
}

function onPointerUp(evt) {
  if (!dragging) return;
  const { pair, fromNode, tempLine } = dragging;

  const el = document.elementFromPoint(evt.clientX, evt.clientY);
  const targetNode = el ? el.closest(".col-a .node") : null;

  fromNode.classList.remove("dragging");
  svg.removeChild(tempLine);

  if (targetNode && !targetNode.classList.contains("correct")) {
    if (targetNode.dataset.pair === pair) {
      fromNode.classList.add("correct");
      targetNode.classList.add("correct");
      drawPermanentLine(fromNode.querySelector(".dot"), targetNode.querySelector(".dot"));
      correctCount++;
      progressLabel.textContent = `${correctCount} / ${total} ligados`;
      broadcastProgress();
      if (correctCount === total) finishGame();
    } else {
      targetNode.classList.add("wrong");
      setTimeout(() => targetNode.classList.remove("wrong"), 400);
    }
  }

  dragging = null;
}

document.addEventListener("pointerdown", onPointerDown);
document.addEventListener("pointermove", onPointerMove);
document.addEventListener("pointerup", onPointerUp);
document.addEventListener("pointercancel", () => { dragging = null; });

startBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }

  channel = supabase.channel(`game:${room}`, { config: { broadcast: { self: false } } });
  await channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      channel.send({ type: "broadcast", event: "join", payload: { player_id: playerId, name } });
    }
  });

  setupScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  buildBoard();
  startTimer();
});
