/**
 * Dope Budz Streets live server — GrudgeBlox-style 20Hz authoritative tick.
 * Deploy on Railway. Clients connect with WebSocket and send pose / shot / plot.
 *
 * Protocol (JSON):
 *   client { t: 'hello', name }
 *   client { t: 'pose', x, y, z, yaw, weapon, driving, hp, city }
 *   client { t: 'shot', x, y, z, tx, ty, tz }
 *   client { t: 'plot', idx }
 *   server { t: 'welcome', id, tick }
 *   server { t: 'snapshot', players, plots }
 *   server { t: 'shot', ... }
 */
import http from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8001);
const TICK = Number(process.env.GAME_TICKRATE || 20);
const DT = 1000 / TICK;
const LOTS = 18;

const plots = Array.from({ length: LOTS }, (_, i) => ({ idx: i, owner: null }));
const players = new Map();
let ids = 1;

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "dopebudz-live", players: players.size, tick: TICK, lots: LOTS }));
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

const wss = new WebSocketServer({ server });

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

wss.on("connection", (ws) => {
  const id = `p${ids++}`;
  const rec = { id, name: "Explorer", x: 0, y: 1.7, z: 12, yaw: 0, weapon: "pistol", driving: false, hp: 100, city: "grove", ws };
  players.set(id, rec);
  send(ws, { t: "welcome", id, tick: TICK, plots });

  ws.on("message", (buf) => {
    let msg;
    try {
      msg = JSON.parse(String(buf));
    } catch {
      return;
    }
    if (msg.t === "hello" && typeof msg.name === "string") rec.name = String(msg.name).slice(0, 18);
    if (msg.t === "pose") {
      rec.x = +msg.x || rec.x;
      rec.y = +msg.y || rec.y;
      rec.z = +msg.z || rec.z;
      rec.yaw = +msg.yaw || rec.yaw;
      rec.weapon = msg.weapon || rec.weapon;
      rec.driving = !!msg.driving;
      rec.hp = +msg.hp || rec.hp;
      rec.city = msg.city || rec.city;
    }
    if (msg.t === "shot") {
      const payload = { t: "shot", id, x: msg.x, y: msg.y, z: msg.z, tx: msg.tx, ty: msg.ty, tz: msg.tz };
      for (const p of players.values()) {
        if (p.id !== id) send(p.ws, payload);
      }
    }
    if (msg.t === "plot" && Number.isInteger(msg.idx) && msg.idx >= 0 && msg.idx < LOTS) {
      const plot = plots[msg.idx];
      if (plot && !plot.owner) {
        plot.owner = rec.name;
        for (const p of players.values()) send(p.ws, { t: "plot", idx: msg.idx, owner: rec.name });
      }
    }
  });

  ws.on("close", () => {
    players.delete(id);
  });
});

setInterval(() => {
  const list = [...players.values()].map((p) => ({
    t: "pose",
    id: p.id,
    name: p.name,
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw,
    weapon: p.weapon,
    driving: p.driving,
    hp: p.hp,
    city: p.city,
  }));
  const snap = JSON.stringify({ t: "snapshot", players: list, plots });
  for (const p of players.values()) {
    if (p.ws.readyState === 1) p.ws.send(snap);
  }
}, DT);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[dopebudz-live] ${TICK}Hz on :${PORT}`);
});
