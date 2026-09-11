import { supabase } from "./supabaseClient.js";
import { QUESTIONS } from "./questions.js";
import { DEFAULT_ROOM } from "./config.js";

const params = new URLSearchParams(location.search);
const room = params.get("room") || DEFAULT_ROOM;
const total = QUESTIONS.length;

const grid = document.getElementById("grid");
const roomLabel = document.getElementById("room-label");
const endBtn = document.getElementById("end-btn");
const liveScreen = document.getElementById("live-screen");
const podiumScreen = document.getElementById("podium-screen");
const podiumEl = document.getElementById("podium");
const restListEl = document.getElementById("rest-list");

const players = new Map(); // player_id -> { name, correct, finished, timeMs }
const finishedOrder = []; // [{ player_id, name, timeMs }] em ordem de chegada

// --- QR code ---
const joinUrl = `${location.origin}${location.pathname.replace("host.html", "index.html")}?room=${room}`;
roomLabel.textContent = `Sala: ${room} — ${joinUrl}`;
// eslint-disable-next-line no-undef
new QRCode(document.getElementById("qr-code"), { text: joinUrl, width: 160, height: 160 });

// --- render grid ---
function render() {
  grid.innerHTML = "";
  const sorted = [...players.entries()].sort((a, b) => {
    if (a[1].finished !== b[1].finished) return a[1].finished ? -1 : 1;
    if (a[1].finished) return a[1].timeMs - b[1].timeMs;
    return b[1].correct - a[1].correct;
  });

  for (const [id, p] of sorted) {
    const pct = Math.round((p.correct / total) * 100);
    const card = document.createElement("div");
    card.className = "player-card" + (p.finished ? " done" : "");
    card.innerHTML = `
      <div class="pname">${p.name}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div class="bar-label">${p.finished ? `Terminou em ${(p.timeMs / 1000).toFixed(1)}s` : `${p.correct} / ${total}`}</div>
    `;
    grid.appendChild(card);
  }
}

function upsertPlayer(id, patch) {
  const current = players.get(id) || { name: "Jogador", correct: 0, finished: false, timeMs: null };
  players.set(id, { ...current, ...patch });
  render();
}

const channel = supabase.channel(`game:${room}`, { config: { broadcast: { self: false } } });

channel
  .on("broadcast", { event: "join" }, ({ payload }) => {
    upsertPlayer(payload.player_id, { name: payload.name });
  })
  .on("broadcast", { event: "progress" }, ({ payload }) => {
    upsertPlayer(payload.player_id, { name: payload.name, correct: payload.correct });
  })
  .on("broadcast", { event: "finished" }, ({ payload }) => {
    upsertPlayer(payload.player_id, { name: payload.name, correct: total, finished: true, timeMs: payload.time_ms });
    if (!finishedOrder.find((f) => f.player_id === payload.player_id)) {
      finishedOrder.push({ player_id: payload.player_id, name: payload.name, timeMs: payload.time_ms });
    }
  })
  .subscribe();

// --- pódio ---
function showPodium() {
  const ranked = [...finishedOrder].sort((a, b) => a.timeMs - b.timeMs);
  const [first, second, third, ...rest] = ranked;

  podiumEl.innerHTML = "";
  const steps = [
    { p: second, cls: "silver", medal: "🥈" },
    { p: first, cls: "gold", medal: "🥇" },
    { p: third, cls: "bronze", medal: "🥉" },
  ];
  for (const s of steps) {
    if (!s.p) continue;
    const div = document.createElement("div");
    div.className = `step ${s.cls}`;
    div.innerHTML = `
      <div class="medal">${s.medal}</div>
      <div class="pname">${s.p.name}</div>
      <div class="ptime">${(s.p.timeMs / 1000).toFixed(1)}s</div>
    `;
    podiumEl.appendChild(div);
  }

  restListEl.innerHTML = rest.length
    ? "<h3>Também terminaram</h3>" + rest.map((r, i) => `<div>${i + 4}º — ${r.name} (${(r.timeMs / 1000).toFixed(1)}s)</div>`).join("")
    : "";

  liveScreen.style.display = "none";
  podiumScreen.classList.add("show");
}

endBtn.addEventListener("click", showPodium);

render();
