/**
 * Separately deployable JSON compatibility authority.
 * The full GrudgeBlox client uses the integrated msgpack ECS Streets runtime.
 */
import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";

function readNumber(name, fallback, min, max) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function readBoolean(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function sanitizeText(value, fallback, maxLength) {
  if (typeof value !== "string") return fallback;
  const sanitized = value.replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, maxLength);
  return sanitized || fallback;
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

const PORT = readNumber("PORT", 8001, 1, 65535);
const LISTEN_HOST = sanitizeText(process.env.LISTEN_HOST, "0.0.0.0", 64);
const TICK = readNumber("GAME_TICKRATE", 20, 1, 60);
const DT = 1000 / TICK;
const LOTS = 18;
const MAX_CLIENTS = readNumber("MAX_CLIENTS", 100, 1, 10_000);
const MAX_PAYLOAD_BYTES = readNumber("MAX_PAYLOAD_BYTES", 4096, 256, 1_048_576);
const MAX_MESSAGES_PER_SECOND = readNumber("MAX_MESSAGES_PER_SECOND", 30, 1, 1000);
const ALLOW_CLIENT_HP = readBoolean("ALLOW_CLIENT_HP", true);
const ALLOW_PLOT_CLAIMS = readBoolean("ALLOW_PLOT_CLAIMS", true);
const INSTANCE_ID = sanitizeText(process.env.INSTANCE_ID, "dopebudz-compat", 48);
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const plots = Array.from({ length: LOTS }, (_, idx) => ({ idx, owner: null, ownerId: null }));
const players = new Map();
let ids = 1;

function respondJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function isOriginAllowed(origin) {
  return allowedOrigins.size === 0 || (typeof origin === "string" && allowedOrigins.has(origin));
}

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function sendError(ws, code, message) {
  send(ws, { t: "error", code, message });
}

function publicPlayer(player) {
  return {
    t: "pose",
    id: player.id,
    name: player.name,
    x: player.x,
    y: player.y,
    z: player.z,
    yaw: player.yaw,
    weapon: player.weapon,
    driving: player.driving,
    hp: player.hp,
    city: player.city,
  };
}

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    respondJson(res, 200, {
      ok: true,
      service: "dopebudz-live",
      instance: INSTANCE_ID,
      role: "compatibility",
      players: players.size,
      tick: TICK,
      lots: LOTS,
    });
    return;
  }

  if (req.url === "/meta") {
    respondJson(res, 200, {
      service: "dopebudz-live",
      instance: INSTANCE_ID,
      role: "compatibility",
      protocol: "dopebudz-json-v1",
      primaryRuntime: "grudgeblox-ecs",
      capabilities: ["pose", "shot-relay", "session-plot-claims", "snapshots", "ping"],
      limits: {
        clients: MAX_CLIENTS,
        payloadBytes: MAX_PAYLOAD_BYTES,
        messagesPerSecond: MAX_MESSAGES_PER_SECOND,
      },
    });
    return;
  }

  respondJson(res, 404, { ok: false, error: "not_found" });
});

const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });

server.on("upgrade", (req, socket, head) => {
  if (!isOriginAllowed(req.headers.origin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  if (wss.clients.size >= MAX_CLIENTS) {
    socket.write("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

wss.on("connection", (ws) => {
  const id = `p${ids++}`;
  const player = {
    id,
    name: "Explorer",
    x: 0,
    y: 1.7,
    z: 12,
    yaw: 0,
    weapon: "pistol",
    driving: false,
    hp: 100,
    city: "grove",
    ws,
  };
  const rate = { startedAt: Date.now(), count: 0 };
  ws.isAlive = true;
  players.set(id, player);
  send(ws, {
    t: "welcome",
    id,
    tick: TICK,
    plots,
    role: "compatibility",
    protocol: "dopebudz-json-v1",
  });

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (buffer) => {
    const now = Date.now();
    if (now - rate.startedAt >= 1000) {
      rate.startedAt = now;
      rate.count = 0;
    }
    rate.count += 1;
    if (rate.count > MAX_MESSAGES_PER_SECOND) {
      sendError(ws, "rate_limited", "Too many messages");
      return;
    }

    let message;
    try {
      message = JSON.parse(String(buffer));
    } catch {
      sendError(ws, "invalid_json", "Message must be valid JSON");
      return;
    }
    if (!message || typeof message !== "object" || typeof message.t !== "string") {
      sendError(ws, "invalid_message", "Message type is required");
      return;
    }

    if (message.t === "ping") {
      send(ws, { t: "pong", now });
      return;
    }

    if (message.t === "hello") {
      const previousName = player.name;
      player.name = sanitizeText(message.name, player.name, 18);
      for (const plot of plots) {
        if (plot.ownerId === id && plot.owner === previousName) plot.owner = player.name;
      }
      return;
    }

    if (message.t === "pose") {
      player.x = clampNumber(message.x, player.x, -10_000, 10_000);
      player.y = clampNumber(message.y, player.y, -1000, 10_000);
      player.z = clampNumber(message.z, player.z, -10_000, 10_000);
      player.yaw = clampNumber(message.yaw, player.yaw, -Math.PI * 4, Math.PI * 4);
      player.weapon = sanitizeText(message.weapon, player.weapon, 24);
      player.driving = Boolean(message.driving);
      if (ALLOW_CLIENT_HP) player.hp = clampNumber(message.hp, player.hp, 0, 100);
      player.city = sanitizeText(message.city, player.city, 32);
      return;
    }

    if (message.t === "shot") {
      const coordinates = [message.x, message.y, message.z, message.tx, message.ty, message.tz];
      if (!coordinates.every((coordinate) => Number.isFinite(Number(coordinate)))) {
        sendError(ws, "invalid_shot", "Shot coordinates must be finite numbers");
        return;
      }
      const payload = {
        t: "shot",
        id,
        x: Number(message.x),
        y: Number(message.y),
        z: Number(message.z),
        tx: Number(message.tx),
        ty: Number(message.ty),
        tz: Number(message.tz),
      };
      for (const other of players.values()) {
        if (other.id !== id) send(other.ws, payload);
      }
      return;
    }

    if (message.t === "plot") {
      if (!ALLOW_PLOT_CLAIMS) {
        sendError(ws, "claims_disabled", "Session plot claims are disabled");
        return;
      }
      if (!Number.isInteger(message.idx) || message.idx < 0 || message.idx >= LOTS) {
        sendError(ws, "invalid_plot", "Plot index is invalid");
        return;
      }
      const plot = plots[message.idx];
      if (!plot || plot.ownerId) {
        sendError(ws, "plot_unavailable", "Plot is already claimed");
        return;
      }
      plot.owner = player.name;
      plot.ownerId = id;
      for (const other of players.values()) {
        send(other.ws, { t: "plot", idx: message.idx, owner: player.name, ownerId: id });
      }
      return;
    }

    sendError(ws, "unsupported_message", `Unsupported message type: ${message.t.slice(0, 32)}`);
  });

  ws.on("close", () => {
    players.delete(id);
    for (const plot of plots) {
      if (plot.ownerId === id) {
        plot.owner = null;
        plot.ownerId = null;
      }
    }
  });

  ws.on("error", (error) => {
    console.error(`[dopebudz-live] WebSocket error for ${id}:`, error.message);
  });
});

const snapshotTimer = setInterval(() => {
  const snapshot = JSON.stringify({
    t: "snapshot",
    players: [...players.values()].map(publicPlayer),
    plots,
  });
  for (const player of players.values()) {
    if (player.ws.readyState === WebSocket.OPEN) player.ws.send(snapshot);
  }
}, DT);

const heartbeatTimer = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);

function shutdown(signal) {
  console.log(`[dopebudz-live] ${signal}; closing compatibility instance`);
  clearInterval(snapshotTimer);
  clearInterval(heartbeatTimer);
  for (const ws of wss.clients) ws.close(1001, "Server shutting down");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
server.on("error", (error) => {
  console.error("[dopebudz-live] server error:", error);
  clearInterval(snapshotTimer);
  clearInterval(heartbeatTimer);
  process.exit(1);
});

server.listen(PORT, LISTEN_HOST, () => {
  console.log(
    `[dopebudz-live] JSON compatibility instance ${INSTANCE_ID} at ${TICK}Hz on ${LISTEN_HOST}:${PORT}; primary runtime is GrudgeBlox ECS`,
  );
});
