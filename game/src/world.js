// world.js — one job: build Solmar and keep its traffic and people moving.
// A seeded grid city: roads every CFG.roadGap, blocks full of extruded
// buildings, palms, a beach along the west edge, named places for jobs,
// traffic cars looping the roads and pedestrians on the sidewalks.
import { CFG, DISTRICTS, CARS } from './config.js';
import { makeRng, range, pick, intRange } from './random.js';

export const PLACES = {
  garage: { name: 'JUNO\'S GARAGE', x: 1350, y: 1350 },
  pier: { name: 'OLD PIER', x: 450, y: 3150 },
  hotel: { name: 'HOTEL MIRAMAR', x: 3150, y: 900 },
  vault: { name: 'HARBOUR VAULT', x: 3150, y: 2700 },
  docks: { name: 'DOCKSIDE', x: 3150, y: 3150 },
  airfield: { name: 'SKYHOOK FIELD', x: 1800, y: 450 },
  startLine: { name: 'SUNSET START', x: 900, y: 2700 },
  casino: { name: 'CASINO SOL', x: 2250, y: 2250 },
  plaza: { name: 'PALM PLAZA', x: 1800, y: 1800 },
};

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const palms = [];
  const roads = [];
  for (let gx = 0; gx <= CFG.worldW; gx += CFG.roadGap) roads.push({ axis: 'v', at: gx });
  for (let gy = 0; gy <= CFG.worldH; gy += CFG.roadGap) roads.push({ axis: 'h', at: gy });
  for (let bx = 0; bx < CFG.worldW; bx += CFG.roadGap) {
    for (let by = 0; by < CFG.worldH; by += CFG.roadGap) {
      const cx = bx + CFG.roadGap / 2;
      const cy = by + CFG.roadGap / 2;
      if (cx < 500 && cy > 2400) continue; // pier water, no buildings
      const count = intRange(rng, 1, 3);
      for (let i = 0; i < count; i++) {
        const w = range(rng, 90, 170);
        const h = range(rng, 90, 170);
        const x = cx + range(rng, -90, 90) - w / 2;
        const y = cy + range(rng, -90, 90) - h / 2;
        buildings.push({
          x, y, w, h,
          z: range(rng, 26, 110),
          wall: pick(rng, ['wallA', 'wallB', 'wallC']),
          roof: pick(rng, ['roofA', 'roofB', 'roofC']),
        });
      }
      if (rng() < 0.6) {
        palms.push({ x: cx + range(rng, -140, 140), y: cy + range(rng, -140, 140) });
      }
    }
  }
  const traffic = [];
  for (let i = 0; i < 26; i++) {
    const vertical = rng() < 0.5;
    const road = intRange(rng, 0, 8) * CFG.roadGap;
    traffic.push(makeTrafficCar(rng, vertical, road));
  }
  const peds = [];
  for (let i = 0; i < 34; i++) {
    peds.push({
      x: range(rng, 200, CFG.worldW - 200),
      y: range(rng, 200, CFG.worldH - 200),
      angle: range(rng, 0, Math.PI * 2),
      speed: range(rng, 22, 48),
      hue: intRange(rng, 0, 360),
      t: range(rng, 0, 10),
    });
  }
  return { buildings, palms, roads, traffic, peds, seed };
}

function makeTrafficCar(rng, vertical, road) {
  const along = range(rng, 0, CFG.worldW);
  return {
    model: pick(rng, CARS),
    x: vertical ? road : along,
    y: vertical ? along : road,
    angle: vertical ? Math.PI / 2 : 0,
    dir: rng() < 0.5 ? 1 : -1,
    speed: range(rng, 90, 150),
    vertical,
    color: pick(rng, CARS).color,
    wreck: false,
    smoke: 0,
  };
}

export function updateTraffic(world, dt, player) {
  for (const c of world.traffic) {
    if (c.wreck) continue;
    const step = c.speed * c.dir * dt;
    if (c.vertical) c.y += step;
    else c.x += step;
    if (c.x < 0) c.x = CFG.worldW;
    if (c.x > CFG.worldW) c.x = 0;
    if (c.y < 0) c.y = CFG.worldH;
    if (c.y > CFG.worldH) c.y = 0;
    c.angle = c.vertical ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
  }
  for (const p of world.peds) {
    p.t += dt;
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
    if (p.x < 150 || p.x > CFG.worldW - 150 || p.y < 150 || p.y > CFG.worldH - 150) p.angle += Math.PI;
    if (Math.random() < dt * 0.05) p.angle += (Math.random() - 0.5) * 1.6;
  }
}

export function buildingAt(world, x, y, pad) {
  for (const b of world.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

export function nearestTrafficCar(world, x, y, maxD) {
  let best = null;
  let bestD = maxD;
  for (const c of world.traffic) {
    if (c.wreck) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function districtAt(x, y) {
  let best = DISTRICTS[2];
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const dd = Math.hypot(d.x - x, d.y - y);
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

export function onRoad(x, y) {
  const gx = x % CFG.roadGap;
  const gy = y % CFG.roadGap;
  return gx < CFG.roadW || gx > CFG.roadGap - CFG.roadW || gy < CFG.roadW || gy > CFG.roadGap - CFG.roadW;
}
