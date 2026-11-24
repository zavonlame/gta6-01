// SOLMAR HEAT — the rules and the state, with no drawing and no browser
// in it: the city, the player on foot and by car, traffic, pedestrians,
// police, the wanted level, combat, missions with a story, cash and saves.
//
// step() advances one fixed tick and returns what happened as bit flags,
// so the caller can react without the world knowing about screens or
// sound. After createWorld returns, nothing here allocates.
import { CAR, CASH, COP, CREW, CREW_SPOTS, DROPS7, MISSIONS, PED, PLAYER, WANTED, WORLD } from './config.js';

export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;
export const EVENT_MISSION = 4;
export const EVENT_CASH = 8;
export const EVENT_CRIME = 16;
export const EVENT_PUNCH = 32;

// Street centrelines, built once from the world size and road spacing.
const STREETS_X = [];
for (let x = 160; x < WORLD.width; x += WORLD.roadGap) STREETS_X.push(x);
const STREETS_Y = [];
for (let y = 160; y < WORLD.height; y += WORLD.roadGap) STREETS_Y.push(y);

// Named places: Milo's garage fronts the street in Old Town, the pier drop
// sits on the beach road, the safehouse is in Marina, the player starts
// downtown on foot.
const GARAGE = { x: 800, y: 640 };
const PIER = { x: 1920, y: 2360 };
const SAFEHOUSE = { x: 3360, y: 480 };
const START = { x: 640, y: 720 };
// The three cash drops of job 4 (PAYDAY RUN).
const DROPS = [
  { x: 1120, y: 1760 },
  { x: 2880, y: 1120 },
  { x: 2080, y: 400 },
];

function circleHitsRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function pushOutOfRect(pos, r, rect) {
  const nx = Math.max(rect.x, Math.min(pos.x, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(pos.y, rect.y + rect.h));
  let dx = pos.x - nx;
  let dy = pos.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r || d2 === 0) {
    // Centre inside the rectangle: leave along the smallest penetration.
    const left = pos.x - rect.x;
    const right = rect.x + rect.w - pos.x;
    const top = pos.y - rect.y;
    const bottom = rect.y + rect.h - pos.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) pos.x = rect.x - r;
    else if (m === right) pos.x = rect.x + rect.w + r;
    else if (m === top) pos.y = rect.y - r;
    else pos.y = rect.y + rect.h + r;
    return;
  }
  const d = Math.sqrt(d2);
  dx /= d;
  dy /= d;
  pos.x = nx + dx * r;
  pos.y = ny + dy * r;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function createWorld(random) {
  // ---- the city: deterministic from the seed --------------------------------
  const buildings = [];
  const parks = [];
  const BUILDING_COLORS = ['#7a6a58', '#5d6b7a', '#8a5f56', '#6b7a5d', '#746a80'];
  for (let col = 0; col < STREETS_X.length - 1; col += 1) {
    for (let row = 0; row < STREETS_Y.length - 1; row += 1) {
      const bx = STREETS_X[col] + WORLD.roadWidth / 2 + WORLD.sidewalk;
      const by = STREETS_Y[row] + WORLD.roadWidth / 2 + WORLD.sidewalk;
      const bw = WORLD.roadGap - WORLD.roadWidth - WORLD.sidewalk * 2;
      const bh = WORLD.roadGap - WORLD.roadWidth - WORLD.sidewalk * 2;
      if (by + bh > WORLD.beachY) continue; // the beach has no buildings
      if (col === 5 && row === 3) {
        parks.push({ x: bx, y: by, w: bw, h: bh });
        continue;
      }
      const count = 1 + Math.floor(random() * 3);
      for (let n = 0; n < count; n += 1) {
        const w = 60 + random() * 90;
        const h = 60 + random() * 90;
        const x = bx + random() * Math.max(1, bw - w);
        const y = by + random() * Math.max(1, bh - h);
        buildings.push({ x, y, w, h, color: BUILDING_COLORS[Math.floor(random() * BUILDING_COLORS.length)] });
      }
    }
  }

  // ---- entities: fixed pools, reused for the whole run ----------------------
  const player = {
    x: START.x, y: START.y, angle: 0, health: PLAYER.health, cash: 0,
    inCar: null, punchCooldown: 0, invulnerable: 0, onFoot: true,
  };
  const cars = [];
  for (let i = 0; i < 40; i += 1) {
    cars.push({ active: false, x: 0, y: 0, angle: 0, speed: 0, parked: true, owned: false, traffic: false, axis: 'h', dir: 1, color: '#7fb3d5', hitCooldown: 0, damage: 0 });
  }
  const peds = [];
  for (let i = 0; i < 40; i += 1) {
    peds.push({ active: false, x: 0, y: 0, angle: 0, speed: 0, state: 'walk', tx: 0, ty: 0, down: 0, downTimer: 0, hitCooldown: 0, color: '#c9c2b4' });
  }
  const cops = [];
  for (let i = 0; i < 12; i += 1) {
    cops.push({ active: false, x: 0, y: 0, angle: 0, speed: 0, inCar: false, car: null, health: 100, arrest: 0, attackTimer: 0, down: 0, downTimer: 0 });
  }
  const pickups = [];
  for (let i = 0; i < 8; i += 1) pickups.push({ active: false, x: 0, y: 0, kind: 'cash', amount: 0, crewIndex: -1 });

  const state = {
    player, cars, peds, cops, pickups, buildings, parks,
    places: { GARAGE, PIER, SAFEHOUSE, START },
    wanted: 0, time: 0, missionIndex: 0, missionStage: 0, missionTimer: 0,
    missionTarget: null, missionText: MISSIONS[0].brief, storyComplete: false,
    crimeTimer: 0, wantedTimer: 0, trafficTimer: 0, pedTimer: 0,
    crew: [], dialogue: null, dialogueT: 0, carrying: null,
  };

  // ---- small lookups ---------------------------------------------------------
  function nearestRoadX(x) {
    let best = STREETS_X[0];
    for (const s of STREETS_X) if (Math.abs(s - x) < Math.abs(best - x)) best = s;
    return best;
  }
  function nearestRoadY(y) {
    let best = STREETS_Y[0];
    for (const s of STREETS_Y) if (Math.abs(s - y) < Math.abs(best - y)) best = s;
    return best;
  }
  function onRoad(x, y) {
    return STREETS_X.some((s) => Math.abs(x - s) < WORLD.roadWidth / 2) || STREETS_Y.some((s) => Math.abs(y - s) < WORLD.roadWidth / 2);
  }
  function hitsBuilding(x, y, r) {
    for (const b of buildings) if (circleHitsRect(x, y, r, b)) return b;
    return null;
  }
  function resolveBuildings(pos, r) {
    for (const b of buildings) if (circleHitsRect(pos.x, pos.y, r, b)) pushOutOfRect(pos, r, b);
    pos.x = Math.max(r, Math.min(WORLD.width - r, pos.x));
    pos.y = Math.max(r, Math.min(WORLD.height - r, pos.y));
  }
  function freeCar() {
    for (const c of cars) if (!c.active) return c;
    return null;
  }
  function freePed() {
    for (const p of peds) if (!p.active) return p;
    return null;
  }
  function freeCop() {
    for (const c of cops) if (!c.active) return c;
    return null;
  }
  function freePickup() {
    for (const p of pickups) if (!p.active) return p;
    return null;
  }

  // ---- spawners --------------------------------------------------------------
  function spawnParkedCar() {
    const car = freeCar();
    if (!car) return;
    const horizontal = random() < 0.5;
    const road = horizontal ? STREETS_Y[Math.floor(random() * STREETS_Y.length)] : STREETS_X[Math.floor(random() * STREETS_X.length)];
    const along = 200 + random() * (WORLD.width - 400);
    car.active = true;
    car.parked = true;
    car.traffic = false;
    car.owned = false;
    car.speed = 0;
    car.hitCooldown = 0;
    if (horizontal) {
      car.x = along;
      car.y = road + (random() < 0.5 ? -22 : 22);
      car.angle = random() < 0.5 ? 0 : Math.PI;
    } else {
      car.x = road + (random() < 0.5 ? -22 : 22);
      car.y = along;
      car.angle = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    }
    car.color = random() < 0.5 ? '#7fb3d5' : '#d5a06a';
  }

  function spawnTrafficCar() {
    const car = freeCar();
    if (!car) return;
    const horizontal = random() < 0.5;
    const road = horizontal ? STREETS_Y[Math.floor(random() * STREETS_Y.length)] : STREETS_X[Math.floor(random() * STREETS_X.length)];
    const along = 200 + random() * (WORLD.width - 400);
    car.active = true;
    car.parked = false;
    car.traffic = true;
    car.owned = false;
    car.speed = CAR.trafficSpeed * (0.8 + random() * 0.4);
    car.hitCooldown = 0;
    car.axis = horizontal ? 'h' : 'v';
    car.dir = random() < 0.5 ? 1 : -1;
    if (horizontal) {
      car.x = along;
      car.y = road + (car.dir > 0 ? 18 : -18);
      car.angle = car.dir > 0 ? 0 : Math.PI;
    } else {
      car.x = road + (car.dir > 0 ? -18 : 18);
      car.y = along;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    car.color = random() < 0.5 ? '#7fb3d5' : '#d5a06a';
  }

  function spawnPed(nearX, nearY) {
    const ped = freePed();
    if (!ped) return;
    ped.active = true;
    ped.state = 'walk';
    ped.down = 0;
    ped.downTimer = 0;
    ped.hitCooldown = 0;
    ped.x = Math.max(40, Math.min(WORLD.width - 40, (nearX ?? 200 + random() * (WORLD.width - 400)) + (random() - 0.5) * 300));
    ped.y = Math.max(40, Math.min(WORLD.height - 40, (nearY ?? 200 + random() * (WORLD.height - 500)) + (random() - 0.5) * 300));
    ped.angle = random() * Math.PI * 2;
    ped.speed = PED.speed * (0.8 + random() * 0.4);
    ped.tx = ped.x;
    ped.ty = ped.y;
    ped.color = random() < 0.5 ? '#c9c2b4' : '#9db38a';
  }

  function spawnCop() {
    const cop = freeCop();
    if (!cop) return;
    cop.active = true;
    cop.health = 100;
    cop.arrest = 0;
    cop.attackTimer = 0;
    cop.down = 0;
    cop.downTimer = 0;
    // Appear on a road a short way from the player, so the chase is always on.
    const angle = random() * Math.PI * 2;
    const d = 420 + random() * 260;
    cop.x = Math.max(40, Math.min(WORLD.width - 40, player.x + Math.cos(angle) * d));
    cop.y = Math.max(40, Math.min(WORLD.height - 40, player.y + Math.sin(angle) * d));
    cop.angle = 0;
    cop.speed = 0;
    if (player.inCar) {
      const car = freeCar();
      if (car) {
        car.active = true;
        car.parked = false;
        car.traffic = false;
        car.owned = false;
        car.speed = 0;
        car.axis = 'h';
        car.dir = 1;
        car.x = cop.x;
        car.y = cop.y;
        car.angle = 0;
        car.color = '#3f6fd8';
        car.hitCooldown = 0;
        cop.inCar = true;
        cop.car = car;
      } else cop.inCar = false;
    } else cop.inCar = false;
  }

  function addWanted(n) {
    state.wanted = Math.min(WANTED.max, state.wanted + n);
    state.crimeTimer = 0;
  }

  function hasCrew(name) {
    return state.crew.indexOf(name) !== -1;
  }

  function missionTargetFor(index, stage) {
    if (index === 0) return null; // any car
    if (index === 1) return stage === 0 ? { x: PIER.x, y: PIER.y } : { x: GARAGE.x, y: GARAGE.y };
    if (index === 2) return { x: SAFEHOUSE.x, y: SAFEHOUSE.y };
    if (index === 3) return stage === 0 ? null : { x: GARAGE.x, y: GARAGE.y };
    if (index === 4) return null; // crew spots, shown as pickups
    if (index === 5) return { x: GARAGE.x, y: GARAGE.y };
    if (index === 6) return { x: SAFEHOUSE.x, y: SAFEHOUSE.y };
    if (index === 7) return stage === 0 ? null : { x: GARAGE.x, y: GARAGE.y };
    return null;
  }

  function startMission(index) {
    state.missionIndex = index;
    state.missionStage = 0;
    state.missionTimer = index === 3 ? 120 : index === 5 ? 90 : index === 7 ? 180 : 0;
    state.missionText = MISSIONS[index].brief;
    state.missionTarget = missionTargetFor(index, 0);
    state.carrying = null;
    state.dialogue = { speaker: 'MILO', text: MISSIONS[index].dialogue };
    state.dialogueT = 9;
    if (index === 2) addWanted(3);
    if (index === 3) {
      for (const d of DROPS) {
        const p = freePickup();
        if (p) {
          p.active = true;
          p.x = d.x;
          p.y = d.y;
          p.kind = 'drop';
          p.amount = CASH.drop;
          p.crewIndex = -1;
        }
      }
    }
    if (index === 4) {
      // Crew call: only the members not yet recruited wait on the street.
      for (let i = 0; i < CREW.length; i += 1) {
        if (hasCrew(CREW[i].name)) continue;
        const p = freePickup();
        if (p) {
          p.active = true;
          p.x = CREW_SPOTS[i].x;
          p.y = CREW_SPOTS[i].y;
          p.kind = 'crew';
          p.amount = 0;
          p.crewIndex = i;
        }
      }
    }
    if (index === 5) addWanted(2);
    if (index === 6) { state.wanted = 4; state.crimeTimer = 0; } // the job IS four stars, whatever the heat was
    if (index === 7) {
      for (const d of DROPS7) {
        const p = freePickup();
        if (p) {
          p.active = true;
          p.x = d.x;
          p.y = d.y;
          p.kind = 'drop';
          p.amount = CASH.drop;
          p.crewIndex = -1;
        }
      }
    }
  }

  function completeMission(reward) {
    player.cash += reward;
    state.carrying = null;
    state.missionText = MISSIONS[state.missionIndex].done;
    const next = state.missionIndex + 1;
    if (next >= MISSIONS.length) {
      state.storyComplete = true;
      state.missionTarget = null;
      return EVENT_MISSION;
    }
    startMission(next);
    return EVENT_MISSION;
  }

  function reset() {
    player.x = START.x;
    player.y = START.y;
    player.angle = 0;
    player.health = PLAYER.health;
    player.cash = 0;
    player.inCar = null;
    player.onFoot = true;
    player.punchCooldown = 0;
    player.invulnerable = 0;
    for (const c of cars) c.active = false;
    for (const p of peds) p.active = false;
    for (const c of cops) c.active = false;
    for (const p of pickups) p.active = false;
    state.wanted = 0;
    state.time = 0;
    state.storyComplete = false;
    state.crimeTimer = 0;
    state.wantedTimer = 0;
    state.trafficTimer = 0;
    state.pedTimer = 0;
    state.crew = [];
    state.dialogue = null;
    state.dialogueT = 0;
    state.carrying = null;
    for (let i = 0; i < 10; i += 1) spawnParkedCar();
    for (let i = 0; i < CAR.trafficCount; i += 1) spawnTrafficCar();
    for (let i = 0; i < PED.count; i += 1) spawnPed();
    startMission(0);
  }

  function nearestCar(maxD) {
    let best = null;
    let bestD = maxD;
    for (const c of cars) {
      if (!c.active || c === player.inCar) continue;
      const d = dist(player.x, player.y, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  function enterCar() {
    const car = nearestCar(64);
    if (!car) return false;
    if (!car.owned) {
      addWanted(1);
      car.owned = true;
    }
    car.parked = false;
    car.traffic = false;
    player.inCar = car;
    player.onFoot = false;
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    return true;
  }

  function exitCar() {
    const car = player.inCar;
    if (!car) return;
    car.parked = true;
    car.speed = 0;
    player.inCar = null;
    player.onFoot = true;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    player.angle = car.angle;
    resolveBuildings(player, PLAYER.radius);
  }

  function punch() {
    if (player.punchCooldown > 0 || !player.onFoot) return 0;
    // RICO on the crew: harder punches, faster fists.
    player.punchCooldown = hasCrew('RICO') ? PLAYER.punchCooldown * 0.75 : PLAYER.punchCooldown;
    const punchDamage = hasCrew('RICO') ? PLAYER.punchDamage + 16 : PLAYER.punchDamage;
    const fx = player.x + Math.cos(player.angle) * PLAYER.punchRange;
    const fy = player.y + Math.sin(player.angle) * PLAYER.punchRange;
    let events = EVENT_PUNCH;
    for (const ped of peds) {
      if (ped.active && !ped.down && dist(fx, fy, ped.x, ped.y) < 36) {
        ped.down = 1;
        ped.downTimer = 3;
        ped.state = 'flee';
        addWanted(1);
        events |= EVENT_CRIME;
        const p = freePickup();
        if (p) {
          p.active = true;
          p.x = ped.x;
          p.y = ped.y;
          p.kind = 'cash';
          p.amount = 20;
        }
      }
    }
    for (const cop of cops) {
      if (cop.active && !cop.down && !cop.inCar && dist(fx, fy, cop.x, cop.y) < 40) {
        cop.health -= punchDamage;
        addWanted(2);
        events |= EVENT_CRIME;
        if (cop.health <= 0) {
          cop.down = 1;
          cop.downTimer = 4;
        }
      }
    }
    return events;
  }

  function stepPlayer(dt, move) {
    if (player.punchCooldown > 0) player.punchCooldown -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (player.onFoot) {
      const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      player.x += move.x * speed * dt;
      player.y += move.y * speed * dt;
      if (move.active) player.angle = Math.atan2(move.y, move.x);
      resolveBuildings(player, PLAYER.radius);
    } else {
      const car = player.inCar;
      // A wrecked car (damage 100) is dead: the engine turns over and nothing happens.
      const dead = car.damage >= 100;
      // DANA on the crew: +8% top speed on the getaway.
      const topSpeed = CAR.maxSpeed * (hasCrew('DANA') ? 1.08 : 1);
      // Throttle: up is gas, down is brake/reverse; left/right steer, scaled by speed.
      const steer = move.x;
      if (!dead) {
        if (move.y < 0) car.speed += CAR.accel * dt;
        else if (move.y > 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
        else car.speed -= car.speed * 1.4 * dt; // coast down
      } else car.speed -= car.speed * 2 * dt;
      if (car.speed > topSpeed) car.speed = topSpeed;
      if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
      const steerAmount = steer * CAR.turnRate * Math.min(1, Math.abs(car.speed) / 140) * (car.speed < 0 ? -1 : 1);
      car.angle += steerAmount * dt;
      // Smashing a building at speed wrecks the car (once per half second).
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (Math.abs(car.speed) > 220 && car.hitCooldown <= 0 && hitsBuilding(nx, ny, CAR.width / 2 + 4)) {
        car.damage = Math.min(100, car.damage + 6);
        car.hitCooldown = 0.5;
      }
      if (car.hitCooldown > 0) car.hitCooldown -= dt;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      resolveBuildings(car, CAR.width / 2 + 4);
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      // Ramming a pedestrian is a crime; they go down and get back up fleeing.
      for (const ped of peds) {
        if (!ped.active || ped.down) continue;
        if (Math.abs(car.speed) > 120 && dist(car.x, car.y, ped.x, ped.y) < 34 && ped.hitCooldown <= 0) {
          ped.down = 1;
          ped.downTimer = 2.5;
          ped.state = 'flee';
          ped.hitCooldown = 5;
          addWanted(1);
        }
      }
    }
  }

  function stepTraffic(dt) {
    for (const car of cars) {
      if (!car.active || !car.traffic) continue;
      if (car.axis === 'h') {
        car.x += car.dir * car.speed * dt;
        // At an intersection, sometimes turn onto the cross street.
        for (const sx of STREETS_X) {
          if (Math.abs(car.x - sx) < car.speed * dt && random() < 0.3) {
            car.axis = 'v';
            car.dir = random() < 0.5 ? 1 : -1;
            car.y = nearestRoadY(car.y) + (car.dir > 0 ? -18 : 18);
            car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
            break;
          }
        }
        if (car.x < 180) { car.dir = 1; car.angle = 0; }
        if (car.x > WORLD.width - 180) { car.dir = -1; car.angle = Math.PI; }
        if (car.axis === 'h') car.angle = car.dir > 0 ? 0 : Math.PI;
      } else {
        car.y += car.dir * car.speed * dt;
        for (const sy of STREETS_Y) {
          if (Math.abs(car.y - sy) < car.speed * dt && random() < 0.3) {
            car.axis = 'h';
            car.dir = random() < 0.5 ? 1 : -1;
            car.x = nearestRoadX(car.x) + (car.dir > 0 ? 18 : -18);
            car.angle = car.dir > 0 ? 0 : Math.PI;
            break;
          }
        }
        if (car.y < 180) { car.dir = 1; car.angle = Math.PI / 2; }
        if (car.y > WORLD.height - 180) { car.dir = -1; car.angle = -Math.PI / 2; }
        if (car.axis === 'v') car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      // Keep traffic on the road: nudge back to its lane.
      if (car.axis === 'h') car.y += (nearestRoadY(car.y) + (car.dir > 0 ? 18 : -18) - car.y) * 0.02;
      else car.x += (nearestRoadX(car.x) + (car.dir > 0 ? -18 : 18) - car.x) * 0.02;
      if (car.hitCooldown > 0) car.hitCooldown -= dt;
      // Traffic cars stop for the player's car in front of them: simple bumper check.
      for (const other of cars) {
        if (!other.active || other === car) continue;
        if (dist(car.x, car.y, other.x, other.y) < 52) {
          const push = 52 - dist(car.x, car.y, other.x, other.y);
          const a = Math.atan2(car.y - other.y, car.x - other.x);
          car.x += Math.cos(a) * push * 0.5;
          car.y += Math.sin(a) * push * 0.5;
        }
      }
    }
  }

  function stepPeds(dt) {
    for (const ped of peds) {
      if (!ped.active) continue;
      if (ped.hitCooldown > 0) ped.hitCooldown -= dt;
      if (ped.down) {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) ped.down = 0;
        continue;
      }
      const pd = dist(ped.x, ped.y, player.x, player.y);
      if (pd < 260 && (!player.onFoot || state.wanted > 0)) ped.state = 'flee';
      else if (pd > 500) ped.state = 'walk';
      let tx = ped.tx;
      let ty = ped.ty;
      let speed = ped.speed;
      if (ped.state === 'flee') {
        const a = Math.atan2(ped.y - player.y, ped.x - player.x);
        tx = ped.x + Math.cos(a) * 200;
        ty = ped.y + Math.sin(a) * 200;
        speed = PED.fleeSpeed;
      } else if (dist(ped.x, ped.y, tx, ty) < 20) {
        // Pick a new stroll target on a nearby sidewalk.
        const rx = nearestRoadX(ped.x + (random() - 0.5) * 500);
        const ry = nearestRoadY(ped.y + (random() - 0.5) * 500);
        ped.tx = rx + (random() < 0.5 ? -50 : 50);
        ped.ty = ry + (random() < 0.5 ? -50 : 50);
        tx = ped.tx;
        ty = ped.ty;
      }
      const a = Math.atan2(ty - ped.y, tx - ped.x);
      ped.angle = a;
      ped.x += Math.cos(a) * speed * dt;
      ped.y += Math.sin(a) * speed * dt;
      resolveBuildings(ped, PED.radius);
    }
  }

  function stepCops(dt) {
    // Keep the heat on: one cop per star, up to the pool.
    let active = 0;
    for (const c of cops) if (c.active && !c.down) active += 1;
    if (state.wanted > 0 && active < state.wanted) spawnCop();
    for (const cop of cops) {
      if (!cop.active) continue;
      if (cop.down) {
        cop.downTimer -= dt;
        if (cop.downTimer <= 0) cop.active = false;
        continue;
      }
      if (state.wanted === 0) {
        // Heat's off: the law drives away and the cop leaves.
        cop.active = false;
        if (cop.car) {
          cop.car.active = false;
          cop.car = null;
        }
        continue;
      }
      const d = dist(cop.x, cop.y, player.x, player.y);
      if (cop.inCar && cop.car) {
        const car = cop.car;
        const targetAngle = Math.atan2(player.y - car.y, player.x - car.x);
        let da = targetAngle - car.angle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, da));
        car.speed = Math.min(COP.carSpeed, car.speed + 500 * dt);
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        resolveBuildings(car, CAR.width / 2 + 4);
        cop.x = car.x;
        cop.y = car.y;
        cop.angle = car.angle;
        // Ramming the player's car hurts the player — and wrecks their car.
        if (player.inCar && d < 56) {
          player.health -= COP.ramDamage * dt;
          player.inCar.damage = Math.min(100, player.inCar.damage + 8 * dt);
          const a = Math.atan2(player.y - cop.y, player.x - cop.x);
          player.inCar.x += Math.cos(a) * 60 * dt;
          player.inCar.y += Math.sin(a) * 60 * dt;
        }
      } else {
        // On foot: run the player down, then hold them to make the bust.
        const a = Math.atan2(player.y - cop.y, player.x - cop.x);
        cop.angle = a;
        if (d > 26) {
          cop.x += Math.cos(a) * COP.footSpeed * dt;
          cop.y += Math.sin(a) * COP.footSpeed * dt;
          cop.arrest = 0;
        } else if (player.onFoot) {
          cop.arrest += dt;
          cop.attackTimer -= dt;
          if (cop.attackTimer <= 0) {
            cop.attackTimer = 1;
            player.health -= COP.punchDamage;
          }
        }
        resolveBuildings(cop, COP.radius);
      }
    }
  }

  function stepWanted(dt) {
    if (state.wanted === 0) return;
    state.crimeTimer += dt;
    const nearSafe = dist(player.x, player.y, SAFEHOUSE.x, SAFEHOUSE.y) < 160;
    if (state.crimeTimer > WANTED.decayDelay) {
      state.wantedTimer += dt;
      // LENA on the crew: the heat fades almost twice as fast.
      const stepTime = nearSafe ? 1 : hasCrew('LENA') ? 2.2 : WANTED.decayStep;
      if (state.wantedTimer >= stepTime) {
        state.wantedTimer = 0;
        state.wanted = Math.max(0, state.wanted - 1);
      }
    }
  }

  function stepMissions(dt) {
    const p = player;
    if (state.missionIndex === 0) {
      if (!p.onFoot) return completeMission(CASH.mission1);
      return 0;
    }
    if (state.missionIndex === 1) {
      const t = state.missionTarget;
      if (t && dist(p.x, p.y, t.x, t.y) < 70) {
        if (state.missionStage === 0) {
          state.missionStage = 1;
          state.missionTarget = { x: GARAGE.x, y: GARAGE.y };
          state.missionText = 'Package in hand. Take it to Milo\u2019s garage in Old Town.';
          state.carrying = 'PACKAGE';
          return EVENT_CASH;
        }
        return completeMission(CASH.mission2);
      }
      return 0;
    }
    if (state.missionIndex === 2) {
      const t = state.missionTarget;
      if (t && dist(p.x, p.y, t.x, t.y) < 90 && state.wanted === 0) return completeMission(CASH.mission3);
      return 0;
    }
    if (state.missionIndex === 3) {
      state.missionTimer -= dt;
      if (state.missionStage === 0) {
        let left = 0;
        for (const pk of pickups) if (pk.active && pk.kind === 'drop') left += 1;
        if (left === 0) {
          state.missionStage = 1;
          state.missionTarget = { x: GARAGE.x, y: GARAGE.y };
          state.missionText = 'All three drops collected. Bring the cash to Milo\u2019s garage.';
        } else if (state.missionTimer <= 0) {
          // Out of time: the drops are gone, the job resets with a fresh clock.
          state.missionTimer = 120;
          for (const d of DROPS) {
            const pk = freePickup();
            if (pk) {
              pk.active = true;
              pk.x = d.x;
              pk.y = d.y;
              pk.kind = 'drop';
              pk.amount = CASH.drop;
              pk.crewIndex = -1;
            }
          }
          state.missionText = 'Too slow — the drops moved. Two minutes, from the top.';
        }
      } else {
        const t = state.missionTarget;
        if (t && dist(p.x, p.y, t.x, t.y) < 70) return completeMission(CASH.mission4);
      }
      return 0;
    }
    if (state.missionIndex === 4) {
      // CREW CALL: all three members recruited, job done.
      let left = 0;
      for (const pk of pickups) if (pk.active && pk.kind === 'crew') left += 1;
      if (left === 0 && state.crew.length >= CREW.length) return completeMission(CASH.mission5);
      return 0;
    }
    if (state.missionIndex === 5) {
      // THE VAULT: ninety seconds to reach the garage with the PD on you.
      state.missionTimer -= dt;
      const t = state.missionTarget;
      if (t && dist(p.x, p.y, t.x, t.y) < 70) return completeMission(CASH.mission6);
      if (state.missionTimer <= 0) {
        state.missionTimer = 90;
        addWanted(1);
        state.missionText = 'Too slow — the vault crew is nervous. Ninety seconds, from the top.';
      }
      return 0;
    }
    if (state.missionIndex === 6) {
      // AIR SUPPORT: lose the 4-star heat, then reach the safehouse.
      const t = state.missionTarget;
      if (t && dist(p.x, p.y, t.x, t.y) < 90 && state.wanted === 0) return completeMission(CASH.mission7);
      return 0;
    }
    if (state.missionIndex === 7) {
      // THE BIG SCORE: four drops in three minutes, then to Milo.
      state.missionTimer -= dt;
      if (state.missionStage === 0) {
        let left = 0;
        for (const pk of pickups) if (pk.active && pk.kind === 'drop') left += 1;
        if (left === 0) {
          state.missionStage = 1;
          state.missionTarget = { x: GARAGE.x, y: GARAGE.y };
          state.missionText = 'All four drops collected. Bring the cash to Milo\u2019s garage.';
        } else if (state.missionTimer <= 0) {
          state.missionTimer = 180;
          for (const d of DROPS7) {
            const pk = freePickup();
            if (pk) {
              pk.active = true;
              pk.x = d.x;
              pk.y = d.y;
              pk.kind = 'drop';
              pk.amount = CASH.drop;
              pk.crewIndex = -1;
            }
          }
          state.missionText = 'Too slow — the drops moved. Three minutes, from the top.';
        }
      } else {
        const t = state.missionTarget;
        if (t && dist(p.x, p.y, t.x, t.y) < 70) return completeMission(CASH.mission8);
      }
      return 0;
    }
    return 0;
  }

  // One fixed step. `input` is { move: {x, y, run, active}, enter, punch }.
  // With `harmless` set (the title screen's backdrop) the city lives but
  // nothing touches the player and nothing scores.
  function step(dt, input, harmless) {
    let events = 0;
    state.time += dt;
    if (!harmless) {
      if (input.enter) {
        if (player.onFoot) enterCar();
        else exitCar();
      }
      if (input.punch) events |= punch();
      stepPlayer(dt, input.move);
      // Cash, drops and crew on the ground.
      for (const pk of pickups) {
        if (pk.active && dist(player.x, player.y, pk.x, pk.y) < 44) {
          if (pk.kind === 'crew') {
            pk.active = false;
            const member = CREW[pk.crewIndex];
            if (member && !hasCrew(member.name)) {
              state.crew.push(member.name);
              state.missionText = `${member.name} joined the crew — ${member.role}, ${member.perk}.`;
            }
            events |= EVENT_CASH;
            continue;
          }
          pk.active = false;
          player.cash += pk.amount;
          events |= EVENT_CASH;
        }
      }
      events |= stepMissions(dt);
      // Cops and wanted.
      stepCops(dt);
      stepWanted(dt);
      if (player.health < PLAYER.health && state.wanted === 0) player.health = Math.min(PLAYER.health, player.health + 2 * dt);
      for (const cop of cops) {
        if (cop.active && !cop.down && !cop.inCar && player.onFoot && cop.arrest >= WANTED.arrestTime) {
          events |= EVENT_BUSTED;
          break;
        }
      }
      if (player.health <= 0) events |= EVENT_WASTED;
    } else {
      // Title backdrop: traffic and pedestrians drift, the player idles downtown.
      stepPlayer(dt, { x: 0, y: 0, run: false, active: false });
    }
    stepTraffic(dt);
    stepPeds(dt);
    if (state.dialogueT > 0) state.dialogueT -= dt;
    // Keep the streets busy.
    state.trafficTimer -= dt;
    if (state.trafficTimer <= 0) {
      state.trafficTimer = 2;
      let n = 0;
      for (const c of cars) if (c.active && c.traffic) n += 1;
      if (n < CAR.trafficCount) spawnTrafficCar();
    }
    state.pedTimer -= dt;
    if (state.pedTimer <= 0) {
      state.pedTimer = 3;
      let n = 0;
      for (const p of peds) if (p.active) n += 1;
      if (n < PED.count) spawnPed(player.x, player.y);
    }
    return events;
  }

  function serialize() {
    return { cash: player.cash, missionIndex: state.missionIndex, storyComplete: state.storyComplete, crew: state.crew.slice() };
  }

  function loadSave(data) {
    if (!data) return;
    player.cash = data.cash || 0;
    state.crew = Array.isArray(data.crew) ? data.crew.filter((n) => CREW.some((c) => c.name === n)) : [];
    state.storyComplete = !!data.storyComplete;
    const index = Math.min(data.missionIndex || 0, MISSIONS.length - 1);
    if (state.storyComplete) {
      state.missionIndex = MISSIONS.length - 1;
      state.missionText = 'Story complete — Solmar is yours. Free roam.';
      state.missionTarget = null;
    } else startMission(index);
  }

  // ---- staged scenes for screenshots (deterministic) -------------------------
  function stage(kind) {
    reset();
    if (kind === 'start') {
      // Downtown at dusk-light: player on foot beside a parked car, traffic passing.
      player.x = 640;
      player.y = 720;
      player.angle = -Math.PI / 2;
      return;
    }
    if (kind === 'play' || kind === 'chase') {
      // Mid-mission: player driving to the pier, two stars, cop cars in pursuit.
      const car = nearestCar(100000);
      if (car) {
        car.owned = true;
        car.parked = false;
        car.traffic = false;
        player.inCar = car;
        player.onFoot = false;
        car.x = 1500;
        car.y = 1760;
        car.angle = Math.PI / 2;
        car.speed = 300;
        car.damage = 0;
        player.x = car.x;
        player.y = car.y;
        player.angle = car.angle;
      }
      if (kind === 'chase') {
        // THE BIG SCORE, the final job: full crew aboard, four stars, CONDOR-1
        // overhead, four drops across the city and the clock running.
        startMission(7);
        state.crew = CREW.map((c) => c.name);
        state.wanted = 4;
        state.crimeTimer = 0;
        player.cash = 1250;
        player.health = 82;
        for (let i = 0; i < 4; i += 1) spawnCop();
        return;
      }
      state.missionIndex = 1;
      state.missionStage = 0;
      state.missionText = MISSIONS[1].brief;
      state.missionTarget = { x: PIER.x, y: PIER.y };
      state.dialogue = { speaker: 'MILO', text: MISSIONS[1].dialogue };
      state.dialogueT = 9;
      state.wanted = 2;
      state.crimeTimer = 0;
      for (let i = 0; i < 2; i += 1) spawnCop();
      return;
    }
    if (kind === 'end') {
      // Busted: cops close in on foot downtown.
      player.x = 1120;
      player.y = 1120;
      state.wanted = 3;
      for (let i = 0; i < 3; i += 1) spawnCop();
      let n = 0;
      for (const cop of cops) {
        if (cop.active) {
          cop.x = player.x + 60 + n * 30;
          cop.y = player.y - 40 + n * 40;
          n += 1;
        }
      }
    }
  }

  reset();
  return {
    state, reset, step, stage, serialize, loadSave, addWanted,
    places: { GARAGE, PIER, SAFEHOUSE, START },
  };
}
