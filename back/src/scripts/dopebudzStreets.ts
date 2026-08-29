/**
 * Dope Budz Streets — GrudgeBlox GTA lobby script.
 * Set GAME_SCRIPT=dopebudzStreets.ts on the live server (port 8001 / Railway).
 *
 * Districts match Dope Budz hubs: Grove, Harbor, Neon, Mesa, Fogtown, Little Beach.
 * 18 deed pads (BUDZ / SOL), growhouse benches, mission terminals, Motor Row cars,
 * highway traffic cubes, combat-yard thugs. ProximityPrompt + NetworkComponent.
 */
import Rapier from "../physics/rapier.js";
import { EventSystem } from "@shared/system/EventSystem.js";
import { ColorComponent } from "@shared/component/ColorComponent.js";
import { PlayerComponent } from "@shared/component/PlayerComponent.js";
import { ProximityPromptComponent } from "@shared/component/ProximityPromptComponent.js";
import { TextComponent } from "@shared/component/TextComponent.js";
import { DynamicRigidBodyComponent } from "../ecs/component/physics/DynamicRigidBodyComponent.js";
import { ColliderPropertiesComponent } from "../ecs/component/physics/ColliderPropertiesComponent.js";
import { ColorEvent } from "../ecs/component/events/ColorEvent.js";
import { SpawnPositionComponent } from "../ecs/component/SpawnPositionComponent.js";
import { ZombieComponent } from "../ecs/component/ZombieComponent.js";
import { Car } from "../ecs/entity/Car.js";
import { Cube } from "../ecs/entity/Cube.js";
import { MapWorld } from "../ecs/entity/MapWorld.js";
import { Mesh } from "../ecs/entity/Mesh.js";
import { TriggerCube } from "../ecs/entity/TriggerCube.js";
import { DopeBudzRuntime } from "./dopebudzRuntime.js";

const ASSETS =
  process.env.DOPEBUDZ_ASSETS_URL ||
  "https://notbloxo.fra1.cdn.digitaloceanspaces.com/Notblox-Assets";
const runtime = new DopeBudzRuntime();

const skipExternalAssets = ["1", "true", "yes", "on"].includes(
  (process.env.DOPEBUDZ_SKIP_EXTERNAL_ASSETS || "").trim().toLowerCase(),
);
const skipExternalMap = skipExternalAssets || ["1", "true", "yes", "on"].includes(
  (process.env.DOPEBUDZ_SKIP_EXTERNAL_MAP || "").trim().toLowerCase(),
);

function createOfflineMarker(params: {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  color: string;
  label?: string;
}): TriggerCube {
  const marker = new TriggerCube(
    params.x,
    params.y,
    params.z,
    params.width,
    params.height,
    params.depth,
    () => {},
    () => {},
    true,
  );
  const markerColor = marker.entity.getComponent(ColorComponent);
  if (markerColor) markerColor.color = params.color;
  if (params.label) {
    marker.entity.addNetworkComponent(new TextComponent(marker.entity.id, params.label, 0, 2.2, 0, 22));
  }
  return marker;
}

if (skipExternalMap) {
  const ground = createOfflineMarker({
    x: 0,
    y: -0.25,
    z: 0,
    width: 240,
    height: 0.5,
    depth: 240,
    color: "#1f2620",
  });
  const groundCollider = ground.entity.getComponent(ColliderPropertiesComponent);
  if (groundCollider) groundCollider.data.isSensor = false;
  console.log("[dopebudzStreets] external map skipped; using local flat fallback");
} else {
  new MapWorld(`${ASSETS}/world/FlatMap.glb`);
}

const DISTRICTS = [
  { name: "GROVE CITY · HQ", x: 0, z: 0, color: "#9db59a" },
  { name: "HARBOR HEIGHTS", x: 0, z: -80, color: "#78b5ff" },
  { name: "NEON STRIP", x: 80, z: 0, color: "#ff6ad5" },
  { name: "MESA FLATS", x: -80, z: 0, color: "#c4a15a" },
  { name: "FOGTOWN", x: 0, z: 80, color: "#a78bfa" },
  { name: "LITTLE BEACH", x: 80, z: 80, color: "#e8c46a" },
];

for (const d of DISTRICTS) {
  const pad = new Cube({
    position: { x: d.x, y: 0.5, z: d.z },
    size: { width: 10, height: 1, depth: 10 },
    color: d.color,
  });
  pad.entity.addNetworkComponent(new TextComponent(pad.entity.id, d.name, 0, 4, 0, 40));

  for (const [dx, dz] of [
    [14, 14],
    [-14, 14],
    [14, -14],
    [-14, -14],
  ] as const) {
    new Cube({
      position: { x: d.x + dx, y: 4, z: d.z + dz },
      size: { width: 8, height: 8, depth: 8 },
      color: d.color,
    });
  }
}

const HIGHWAYS: Array<{ x: number; z: number; w: number; d: number }> = [
  { x: 0, z: -40, w: 12, d: 80 },
  { x: 0, z: 40, w: 12, d: 80 },
  { x: -40, z: 0, w: 80, d: 12 },
  { x: 40, z: 0, w: 80, d: 12 },
  { x: 80, z: 40, w: 12, d: 80 },
  { x: 40, z: 80, w: 80, d: 12 },
];
for (const h of HIGHWAYS) {
  new Cube({
    position: { x: h.x, y: 0.15, z: h.z },
    size: { width: h.w, height: 0.3, depth: h.d },
    color: "#2a2c28",
  });
}

let lot = 0;
for (const d of DISTRICTS) {
  for (let i = 0; i < 3; i++) {
    const idx = lot++;
    const sol = idx % 3 === 0;
    const x = d.x + 22 + i * 8;
    const z = d.z + 26;
    const pad = new Cube({
      position: { x, y: 0.2, z },
      size: { width: 6, height: 0.4, depth: 6 },
      color: sol ? "#c4a15a" : "#3a5a32",
    });
    const currency = sol ? "SOL" : "BUDZ";
    const price = sol ? 0.28 + i * 0.07 : 160 + idx * 18;
    const formattedPrice = currency === "SOL" ? `${price.toFixed(2)} SOL` : `${price} BUDZ`;
    const prompt = new ProximityPromptComponent(pad.entity.id, {
      text: `E · Deed ${idx + 1} · ${formattedPrice}`,
      onInteract: (player) => runtime.interactWithLot(idx, player),
      maxInteractDistance: 8,
      interactionCooldown: 400,
      holdDuration: 0,
    });
    const label = new TextComponent(pad.entity.id, `LOT ${idx + 1}`, 0, 2.2, 0, 22);
    pad.entity.addNetworkComponent(prompt);
    pad.entity.addNetworkComponent(label);
    runtime.registerLot({
      index: idx,
      district: d.name,
      currency,
      price,
      baseColor: sol ? "#c4a15a" : "#3a5a32",
      entity: pad.entity,
      prompt,
      label,
    });
  }
}

let benchId = 0;
for (const d of DISTRICTS) {
  for (let i = 0; i < 2; i++) {
    const id = benchId++;
    const bench = new Cube({
      position: { x: d.x - 10 + i * 5, y: 1, z: d.z - 6 },
      size: { width: 2, height: 1.2, depth: 2 },
      color: "#3d4a38",
    });
    const prompt = new ProximityPromptComponent(bench.entity.id, {
      text: "E · Plant crop",
      onInteract: (player) => runtime.interactWithBench(id, player),
      maxInteractDistance: 7,
      interactionCooldown: 300,
      holdDuration: 0,
    });
    bench.entity.addNetworkComponent(prompt);
    runtime.registerBench({
      id,
      district: d.name,
      entity: bench.entity,
      prompt,
      phase: "empty",
    });
  }
}

const TERMS = [
  { title: "Alley Drop", x: -16, z: -16, color: "#c4a15a" },
  { title: "Corner Sale", x: 16, z: -16, color: "#6dce5a" },
  { title: "Stash Job", x: 8, z: 88, color: "#e0553a" },
  { title: "Dock Courier", x: 0, z: -96, color: "#78b5ff" },
  { title: "Night Window", x: 96, z: -16, color: "#ff6ad5" },
  { title: "Lot Raid", x: -96, z: 16, color: "#c4a15a" },
  { title: "Boardwalk Cut", x: 96, z: 96, color: "#e8c46a" },
  { title: "Yard Relay", x: -16, z: 96, color: "#a78bfa" },
];
for (const [id, t] of TERMS.entries()) {
  const k = new Cube({
    position: { x: t.x, y: 1.4, z: t.z },
    size: { width: 1.4, height: 2.4, depth: 1.4 },
    color: t.color,
  });
    const prompt = new ProximityPromptComponent(k.entity.id, {
      text: `E · ${t.title}`,
      onInteract: (player) => {
        EventSystem.addEvent(new ColorEvent(k.entity.id, "#e8c46a"));
        runtime.interactWithTerminal(id, player);
      },
    maxInteractDistance: 8,
    interactionCooldown: 500,
    holdDuration: 0,
  });
  k.entity.addNetworkComponent(prompt);
  k.entity.addNetworkComponent(new TextComponent(k.entity.id, t.title, 0, 2.6, 0, 24));
  runtime.registerTerminal({ id, title: t.title, reward: 60 + id * 10 });
}

const carSpawns = [
  { x: -70, z: 30, name: "City Cruiser", color: "#9db59a" },
  { x: -80, z: 40, name: "Night Runner", color: "#222222" },
  { x: -90, z: 50, name: "Taxi", color: "#f0c000" },
  { x: -100, z: 35, name: "Muscle", color: "#e0553a" },
  { x: -75, z: 55, name: "Brawler Van", color: "#4a5568" },
  { x: -85, z: 25, name: "Lowrider", color: "#a78bfa" },
  { x: 70, z: 8, name: "Neon Coupe", color: "#ff6ad5" },
  { x: 8, z: 70, name: "Fog Hauler", color: "#6a7068" },
];
if (skipExternalAssets) {
  for (const c of carSpawns) {
    createOfflineMarker({
      x: c.x,
      y: 1.5,
      z: c.z,
      width: 5,
      height: 3,
      depth: 9,
      color: c.color,
      label: `${c.name} (offline marker)`,
    });
  }

  for (let i = 0; i < 6; i++) {
    const thug = createOfflineMarker({
      x: 70 + (i % 2) * 12,
      y: 2,
      z: -50 + Math.floor(i / 2) * 14,
      width: 2,
      height: 4,
      depth: 2,
      color: i % 2 ? "#6a4032" : "#4a3a48",
      label: `Street crew ${i + 1} (offline marker)`,
    });
    thug.entity.addComponent(new ZombieComponent(thug.entity.id));
  }
  console.log("[dopebudzStreets] external vehicle and character meshes skipped; using local markers");
} else {
  for (const c of carSpawns) {
    const car = new Car({
      position: { x: c.x, y: 4, z: c.z },
      name: c.name,
      meshUrl: `${ASSETS}/vehicle/EzCar.glb`,
      color: c.color,
    });
    car.entity.addComponent(new SpawnPositionComponent(car.entity.id, c.x, 4, c.z));
    car.entity.addNetworkComponent(new TextComponent(car.entity.id, `DRIVE ${c.name}`, 0, 2.2, 0, 22));
  }

  for (let i = 0; i < 6; i++) {
    const thug = new Mesh({
      position: { x: 70 + (i % 2) * 12, y: 8, z: -50 + Math.floor(i / 2) * 14 },
      meshUrl: `${ASSETS}/character/MiniCharacter.glb`,
      physicsProperties: { mass: 1, angularDamping: 0.5, enableCcd: true },
      colliderProperties: { restitution: 0.4 },
    });
    thug.entity.addNetworkComponent(new ColorComponent(thug.entity.id, i % 2 ? "#6a4032" : "#4a3a48"));
    thug.entity.addComponent(new ZombieComponent(thug.entity.id));
    thug.entity.addNetworkComponent(new TextComponent(thug.entity.id, `Street crew ${i + 1}`, 0, 2, 0));
  }
}

new TriggerCube(
  0,
  -2,
  12,
  10,
  4,
  10,
  (entity) => {
    if (entity.getComponent(PlayerComponent)) {
      entity.getComponent(DynamicRigidBodyComponent)!.body!.applyImpulse(new Rapier.Vector3(0, 7000, 0), true);
    }
  },
  () => {},
  false,
);
const jumpPadMarker = new Cube({
  position: { x: 0, y: 0.15, z: 12 },
  size: { width: 10, height: 0.3, depth: 10 },
  color: "#6dce5a",
});
jumpPadMarker.entity.addNetworkComponent(
  new TextComponent(jumpPadMarker.entity.id, "JUMP PAD", 0, 2, 0, 24),
);

const gate = new Cube({
  position: { x: 0, y: 3, z: -20 },
  size: { width: 14, height: 6, depth: 1 },
  color: "#1a1a2e",
});
gate.entity.addNetworkComponent(
  new TextComponent(gate.entity.id, "DOPE BUDZ STREETS · E cars/deeds · 1-4 kits", 0, 5, 0, 48),
);

runtime.install();

console.log(
  "[dopebudzStreets] integrated ECS authority ready: 6 districts, 18 claimable lots, grow cycles, terminal routes, cars",
);
