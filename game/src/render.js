// Rendering: state in, pixels out. Nothing here makes decisions.
//
// The view is a pseudo-3D golden-hour chase frame built on the same 2D
// simulation: a sunset sky with a low sun and a far skyline above the
// horizon, and below it the city in a tilted perspective — the world is
// squashed vertically so the streets run away from the camera. Buildings
// become 3D blocks with roofs, side faces and long sunset shadows; cars get
// roofs and shadows; CONDOR-1 circles overhead with a searchlight whenever
// the heat reaches three stars. The camera tracks the player. The rules
// never see any of this, so the game plays exactly as it would top-down.
//
// The HUD is the face of the game: cash, district and respect, wanted
// stars, health, the clock and weather, a mission tracker naming the job
// and its stage, Milo's dialogue box with his portrait, the police-dispatch
// panel naming every unit on the chase, three crew cards, the radio panel,
// a weapon strip with the inventory, speed and car damage, the off-screen
// objective arrow, and the minimap. Each panel only reads state the world
// already keeps — the HUD shows rules, it adds none.
import { CAR, CREW, DISPATCH_CALLSIGNS, FONT, MISSIONS, MISSION_STAGES, PALETTE, PED, PLAYER, RESPECT_RANKS, VIEW, WEAPON, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

// Sky band height, in view units; the world is painted below the horizon.
const SKY_H = 120;
// How much the world is squashed vertically: the tilt that sends streets
// running away from the camera.
const SQ = 0.62;
// Roof offset, in world units: the sideways shift that gives a block a side face.
const ROOF_SHIFT = 12;

const PANEL = { width: 680, top: 150, line: 32, bottom: 76 };
const MINI = { width: 230, height: 154, margin: 16 };
const DISPATCH = { x: 16, y: 180, width: 308, header: 26, row: 20, pad: 10, maxRows: 4 };
const TRACKER = { width: 560, height: 52, top: 56 };
const WEAPON_STRIP = { width: 230, height: 48, gap: 8 };
const DIALOGUE = { width: 600, top: 116, height: 58 };
const CREW_CARD = { y: 608, width: 156, height: 48, gap: 8 };
const RADIO_PANEL = { width: 230, height: 42 };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// A hex colour scaled brighter (f > 1) or darker (f < 1).
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((n & 255) * f), 0, 255);
  return `rgb(${r},${g},${b})`;
}

// A deterministic hash of a building's position, so its windows never flicker.
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  return ((h * 1274126177) | 0) >>> 0;
}

// Which district the player is standing in, from the city map.
function districtFor(x, y) {
  if (y > WORLD.beachY) return 'THE PIER · BEACHFRONT';
  if (x > 3000 && y < 900) return 'MARINA';
  if (x < 1400 && y < 1100) return 'OLD TOWN';
  if (x >= 1760 && x <= 2080 && y >= 1120 && y <= 1440) return 'PARKSIDE';
  if (y < 1400) return 'DOWNTOWN';
  return 'SOUTHSIDE';
}

// The in-game clock: golden hour opens at 18:00 and runs half a minute per second.
function clockString(time) {
  const total = 18 * 60 + Math.floor(time * 0.5);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// Where CONDOR-1 circles while the heat is on: above the player, as a ground position.
function heliGroundPos(state) {
  const p = state.player;
  return {
    x: p.x + Math.cos(state.time * 0.6) * 230,
    y: p.y + Math.sin(state.time * 0.6) * 170,
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const camera = { x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align) {
    const key = `${size}`;
    if (!fonts.has(key)) fonts.set(key, `${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  // World-space text, drawn undistorted: the vertical squash is undone for glyphs.
  function worldText(value, x, y, size, color, align) {
    context.save();
    context.translate(x, y);
    context.scale(1, 1 / SQ);
    const key = `w${size}`;
    if (!fonts.has(key)) fonts.set(key, `${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'center';
    context.textBaseline = 'middle';
    context.fillText(value, 0, 0);
    context.restore();
    context.textBaseline = 'alphabetic';
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  // The golden-hour sky: gradient, low sun, clouds, a distant skyline on the horizon.
  function drawSky() {
    const grad = context.createLinearGradient(0, 0, 0, SKY_H);
    grad.addColorStop(0, '#ff7a3c');
    grad.addColorStop(0.55, '#ffb347');
    grad.addColorStop(1, '#ffe3a3');
    context.fillStyle = grad;
    context.fillRect(0, 0, VIEW.width, SKY_H);
    // The sun, low over the bay, with a glow around it.
    const halo = context.createRadialGradient(1005, 52, 4, 1005, 52, 70);
    halo.addColorStop(0, 'rgba(255, 246, 200, 0.95)');
    halo.addColorStop(1, 'rgba(255, 246, 200, 0)');
    context.fillStyle = halo;
    context.fillRect(935, -18, 140, 140);
    context.fillStyle = '#fff3c4';
    context.beginPath();
    context.arc(1005, 52, 24, 0, Math.PI * 2);
    context.fill();
    // Clouds drifting across the sunset.
    context.fillStyle = 'rgba(255, 255, 255, 0.5)';
    const clouds = [[180, 36, 70, 10], [420, 62, 90, 12], [700, 28, 60, 9], [1150, 30, 66, 10], [60, 74, 56, 9]];
    for (const [cx, cy, rx, ry] of clouds) {
      context.beginPath();
      context.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      context.fill();
    }
    // The far skyline, dark against the sunset, windows lit.
    for (let i = 0; i < 24; i += 1) {
      const h = hash(i * 53, 7);
      const w = 30 + (h % 22);
      const bh = 18 + (h % 46);
      const x = i * 54 + ((h >> 5) % 12);
      context.fillStyle = 'rgba(90, 61, 110, 0.85)';
      context.fillRect(x, SKY_H - bh, w, bh);
      context.fillStyle = 'rgba(255, 210, 63, 0.8)';
      for (let wy = SKY_H - bh + 6; wy < SKY_H - 4; wy += 12) {
        if ((h >> ((wy / 12) % 24)) & 1) context.fillRect(x + 6 + ((h >> 3) % Math.max(1, w - 12)), wy, 3, 4);
      }
    }
    context.fillStyle = 'rgba(90, 61, 110, 0.9)';
    context.fillRect(0, SKY_H - 2, VIEW.width, 2);
  }

  function drawCity(state) {
    // Ground: grass, then sand and sea along the south edge.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, WORLD.beachY, WORLD.width, WORLD.height - WORLD.beachY);
    context.fillStyle = PALETTE.sea;
    context.fillRect(0, WORLD.seaY, WORLD.width, WORLD.height - WORLD.seaY);
    context.fillStyle = '#7fb3d5';
    context.fillRect(0, WORLD.seaY, WORLD.width, 6);
    // The pier: planks running out into the sea at the south end.
    context.fillStyle = '#8a6f4d';
    context.fillRect(1900, 2320, 40, 130);
    context.fillStyle = '#a8875f';
    for (let y = 2320; y < 2450; y += 12) context.fillRect(1892, y, 56, 6);

    // Roads: asphalt with a dashed centre line and sidewalks along the edges.
    for (let x = 160; x < WORLD.width; x += WORLD.roadGap) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(x - WORLD.roadWidth / 2 - WORLD.sidewalk, 0, WORLD.roadWidth + WORLD.sidewalk * 2, WORLD.height);
      context.fillStyle = PALETTE.road;
      context.fillRect(x - WORLD.roadWidth / 2, 0, WORLD.roadWidth, WORLD.height);
      context.fillStyle = PALETTE.roadLine;
      for (let y = 0; y < WORLD.height; y += 48) context.fillRect(x - 2, y, 4, 24);
    }
    for (let y = 160; y < WORLD.height; y += WORLD.roadGap) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(0, y - WORLD.roadWidth / 2 - WORLD.sidewalk, WORLD.width, WORLD.roadWidth + WORLD.sidewalk * 2);
      context.fillStyle = PALETTE.road;
      context.fillRect(0, y - WORLD.roadWidth / 2, WORLD.width, WORLD.roadWidth);
      context.fillStyle = PALETTE.roadLine;
      for (let x = 0; x < WORLD.width; x += 48) context.fillRect(x, y - 2, 24, 4);
    }

    // The park: green lawn with trees.
    for (const park of state.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.w, park.h);
      const h = hash(park.x, park.y);
      for (let i = 0; i < 9; i += 1) {
        const tx = park.x + 20 + ((h >> (i * 3)) % 100) / 100 * (park.w - 40);
        const ty = park.y + 20 + ((h >> (i * 5 + 1)) % 100) / 100 * (park.h - 40);
        context.fillStyle = '#2f5230';
        context.beginPath();
        context.arc(tx, ty, 14, 0, Math.PI * 2);
        context.fill();
      }
    }

    // Named places: Milo's garage and the Marina safehouse.
    const places = state.places;
    context.fillStyle = '#e5534b';
    context.fillRect(places.GARAGE.x - 40, places.GARAGE.y - 26, 80, 52);
    worldText('GARAGE', places.GARAGE.x, places.GARAGE.y, 15, PALETTE.text);
    context.fillStyle = '#3f6fd8';
    context.fillRect(places.SAFEHOUSE.x - 44, places.SAFEHOUSE.y - 26, 88, 52);
    worldText('SAFEHOUSE', places.SAFEHOUSE.x, places.SAFEHOUSE.y, 15, PALETTE.text);
  }

  // A single building as a 3D block: long sunset shadow, south face, east
  // face, roof with rooftop boxes, lit windows on the south face.
  function drawBuilding(b) {
    const h = hash(Math.round(b.x), Math.round(b.y));
    const tall = 46 + (h % 64);
    // Long shadow, thrown west by the low sun.
    context.fillStyle = 'rgba(20, 10, 0, 0.28)';
    context.fillRect(b.x - 26, b.y + 10, b.w, b.h);
    // East face, darker.
    context.fillStyle = shade(b.color, 0.62);
    context.beginPath();
    context.moveTo(b.x + b.w, b.y);
    context.lineTo(b.x + b.w + ROOF_SHIFT, b.y - tall);
    context.lineTo(b.x + b.w + ROOF_SHIFT, b.y + b.h - tall);
    context.lineTo(b.x + b.w, b.y + b.h);
    context.closePath();
    context.fill();
    // South face, with lit windows.
    context.fillStyle = b.color;
    context.beginPath();
    context.moveTo(b.x, b.y + b.h);
    context.lineTo(b.x + b.w, b.y + b.h);
    context.lineTo(b.x + b.w + ROOF_SHIFT, b.y + b.h - tall);
    context.lineTo(b.x + ROOF_SHIFT, b.y + b.h - tall);
    context.closePath();
    context.fill();
    context.fillStyle = '#ffd23f';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor((tall - 16) / 24));
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        if ((h >> ((cx * 3 + cy * 7) % 24)) & 1) {
          context.fillRect(b.x + 12 + cx * 26, b.y + b.h - tall + 8 + cy * 24, 10, 10);
        }
      }
    }
    // Roof, shifted up and east, with a darker core and rooftop boxes.
    context.fillStyle = '#4b5160';
    context.fillRect(b.x + ROOF_SHIFT, b.y - tall, b.w, b.h);
    context.fillStyle = PALETTE.buildingRoof;
    context.fillRect(b.x + ROOF_SHIFT + 8, b.y - tall + 8, b.w - 16, b.h - 16);
    context.fillStyle = '#6b7280';
    context.fillRect(b.x + ROOF_SHIFT + 14, b.y - tall + 14, 18, 14);
    if (b.w > 90) context.fillRect(b.x + ROOF_SHIFT + b.w - 40, b.y - tall + b.h - 34, 20, 16);
  }

  function drawCarShape(x, y, angle, length, width, body, outline, isPlayer, damage, time) {
    // Long shadow on the asphalt.
    context.fillStyle = 'rgba(0, 0, 0, 0.3)';
    context.beginPath();
    context.ellipse(x + 8, y + 10, length * 0.55, width * 0.55, 0, 0, Math.PI * 2);
    context.fill();
    // A wrecked car smokes from under the hood.
    if (damage > 50) {
      const wobble = Math.sin(time * 6 + x) * 4;
      context.fillStyle = 'rgba(140, 140, 140, 0.35)';
      context.beginPath();
      context.arc(x - Math.cos(angle) * length * 0.7 + wobble, y - Math.sin(angle) * length * 0.7, 9, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(x - Math.cos(angle) * length * 0.85, y - Math.sin(angle) * length * 0.85 - 6, 6, 0, Math.PI * 2);
      context.fill();
    }
    // The player's car gets a pulsing gold ring, so the eye finds it at once.
    if (isPlayer) {
      context.strokeStyle = `rgba(242, 201, 76, ${0.5 + 0.3 * Math.sin(time * 4)})`;
      context.lineWidth = 3;
      context.beginPath();
      context.ellipse(x, y, length * 0.72, width * 0.95, 0, 0, Math.PI * 2);
      context.stroke();
    }
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = outline || '#11141b';
    roundRect(-length / 2 - 2, -width / 2 - 2, length + 4, width + 4, 8);
    context.fill();
    context.fillStyle = body;
    roundRect(-length / 2, -width / 2, length, width, 6);
    context.fill();
    // Windshield and rear window.
    context.fillStyle = '#1b2a3a';
    context.fillRect(length * 0.08, -width / 2 + 3, length * 0.16, width - 6);
    context.fillRect(-length * 0.32, -width / 2 + 3, length * 0.12, width - 6);
    // Headlights.
    context.fillStyle = '#ffe9a3';
    context.fillRect(length / 2 - 3, -width / 2 + 3, 3, 5);
    context.fillRect(length / 2 - 3, width / 2 - 8, 3, 5);
    context.restore();
    // Roof, shifted up-screen so the car reads as a solid body, not a flat card.
    context.save();
    context.translate(x, y - 9);
    context.rotate(angle);
    context.fillStyle = shade(body, 1.28);
    roundRect(-length * 0.28, -width * 0.32, length * 0.56, width * 0.64, 5);
    context.fill();
    context.fillStyle = '#1b2a3a';
    context.fillRect(length * 0.12, -width * 0.32 + 2, length * 0.12, width * 0.64 - 4);
    context.restore();
    // Cop light bar, flashing red and blue.
    if (body === '#3f6fd8') {
      context.save();
      context.translate(x, y);
      context.rotate(angle);
      context.fillStyle = Math.floor(time * 4) % 2 === 0 ? '#ff4b4b' : '#4b7dff';
      context.fillRect(-4, -width / 2 - 2, 8, 5);
      context.restore();
    }
  }

  function drawPickups(state) {
    for (const pk of state.pickups) {
      if (!pk.active) continue;
      const bob = Math.sin(state.time * 4 + pk.x) * 3;
      if (pk.kind === 'crew') {
        const member = CREW[pk.crewIndex];
        context.fillStyle = '#2dd4bf';
        context.beginPath();
        context.arc(pk.x, pk.y + bob, 16, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#0d0f14';
        context.lineWidth = 3;
        context.beginPath();
        context.arc(pk.x, pk.y + bob, 16, 0, Math.PI * 2);
        context.stroke();
        worldText(member ? member.name[0] : '?', pk.x, pk.y + bob, 16, '#0d0f14');
        worldText(member ? member.name : 'CREW', pk.x, pk.y + bob + 30, 12, '#2dd4bf');
        continue;
      }
      context.fillStyle = pk.kind === 'drop' ? PALETTE.cash : '#f2c94c';
      context.beginPath();
      context.arc(pk.x, pk.y + bob, 13, 0, Math.PI * 2);
      context.fill();
      worldText('$', pk.x, pk.y + bob, 16, '#0d0f14');
    }
  }

  function drawEntities(state) {
    // Painter's algorithm: everything sorted by its south edge, so nearer
    // things cover farther ones and the 3D blocks read as solid.
    const items = [];
    for (const b of state.buildings) items.push({ key: b.y + b.h, draw: () => drawBuilding(b) });
    for (const car of state.cars) {
      if (!car.active) continue;
      const isPlayer = car === state.player.inCar;
      items.push({
        key: car.y,
        draw: () => drawCarShape(car.x, car.y, car.angle, CAR.length, CAR.width, car.color, isPlayer ? PALETTE.player : '#11141b', isPlayer, car.damage || 0, state.time),
      });
    }
    for (const ped of state.peds) {
      if (!ped.active) continue;
      items.push({
        key: ped.y,
        draw: () => {
          context.fillStyle = 'rgba(0, 0, 0, 0.3)';
          context.beginPath();
          context.ellipse(ped.x + 3, ped.y + 5, 10, 5, 0, 0, Math.PI * 2);
          context.fill();
          if (ped.down) {
            context.fillStyle = ped.color;
            context.beginPath();
            context.ellipse(ped.x, ped.y, 13, 6, ped.angle, 0, Math.PI * 2);
            context.fill();
            return;
          }
          context.fillStyle = ped.color;
          context.beginPath();
          context.arc(ped.x, ped.y, PED.radius, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = '#11141b';
          context.beginPath();
          context.arc(ped.x + Math.cos(ped.angle) * 6, ped.y + Math.sin(ped.angle) * 6, 3, 0, Math.PI * 2);
          context.fill();
        },
      });
    }
    for (const cop of state.cops) {
      if (!cop.active || cop.inCar) continue; // the cop car is drawn with the cars
      items.push({
        key: cop.y,
        draw: () => {
          context.fillStyle = 'rgba(0, 0, 0, 0.3)';
          context.beginPath();
          context.ellipse(cop.x + 3, cop.y + 5, 11, 5, 0, 0, Math.PI * 2);
          context.fill();
          if (cop.down) {
            context.fillStyle = '#3f6fd8';
            context.beginPath();
            context.ellipse(cop.x, cop.y, 14, 6, cop.angle, 0, Math.PI * 2);
            context.fill();
            return;
          }
          context.fillStyle = PALETTE.cop;
          context.beginPath();
          context.arc(cop.x, cop.y, 13, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = '#fff';
          context.fillRect(cop.x - 6, cop.y - 3, 12, 6);
        },
      });
    }
    const p = state.player;
    if (p.onFoot) {
      items.push({
        key: p.y,
        draw: () => {
          context.fillStyle = 'rgba(0, 0, 0, 0.3)';
          context.beginPath();
          context.ellipse(p.x + 3, p.y + 5, 13, 6, 0, 0, Math.PI * 2);
          context.fill();
          context.strokeStyle = `rgba(242, 201, 76, ${0.5 + 0.3 * Math.sin(state.time * 4)})`;
          context.lineWidth = 3;
          context.beginPath();
          context.ellipse(p.x, p.y, 20, 13, 0, 0, Math.PI * 2);
          context.stroke();
          context.fillStyle = PALETTE.player;
          context.beginPath();
          context.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = '#11141b';
          context.beginPath();
          context.arc(p.x + Math.cos(p.angle) * 8, p.y + Math.sin(p.angle) * 8, 4, 0, Math.PI * 2);
          context.fill();
          if (p.punchCooldown > 0.25) {
            context.fillStyle = PALETTE.player;
            context.beginPath();
            context.arc(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, 6, 0, Math.PI * 2);
            context.fill();
          }
        },
      });
    }
    items.sort((a, b) => a.key - b.key);
    for (const item of items) item.draw();
  }

  function drawMarker(state) {
    const t = state.missionTarget;
    if (!t) return;
    const pulse = 1 + Math.sin(state.time * 5) * 0.15;
    context.save();
    context.translate(t.x, t.y);
    context.scale(pulse, pulse);
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.moveTo(0, -22);
    context.lineTo(16, 0);
    context.lineTo(0, 22);
    context.lineTo(-16, 0);
    context.closePath();
    context.fill();
    context.restore();
    context.fillStyle = 'rgba(255, 95, 162, 0.25)';
    context.beginPath();
    context.arc(t.x, t.y, 34 + Math.sin(state.time * 5) * 6, 0, Math.PI * 2);
    context.fill();
  }

  // CONDOR-1, the police helicopter: it circles the player with a searchlight.
  function drawHeli(state) {
    if (state.wanted < 3) return;
    const p = state.player;
    const heli = heliGroundPos(state);
    // Searchlight cone down to the player, and the bright pool around them.
    context.fillStyle = 'rgba(255, 230, 140, 0.16)';
    context.beginPath();
    context.moveTo(heli.x - 14, heli.y - 64);
    context.lineTo(p.x - 24, p.y);
    context.lineTo(p.x + 24, p.y);
    context.closePath();
    context.fill();
    context.fillStyle = 'rgba(255, 230, 140, 0.22)';
    context.beginPath();
    context.arc(p.x, p.y, 30, 0, Math.PI * 2);
    context.fill();
    // Ground shadow.
    context.fillStyle = 'rgba(0, 0, 0, 0.3)';
    context.beginPath();
    context.ellipse(heli.x, heli.y + 8, 30, 12, 0, 0, Math.PI * 2);
    context.fill();
    // Body, hovering 64 world units above its shadow.
    const by = heli.y - 64;
    context.fillStyle = '#3a4252';
    context.beginPath();
    context.ellipse(heli.x, by, 26, 11, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#9fd8ff';
    context.beginPath();
    context.ellipse(heli.x + 13, by - 2, 8, 6, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#3a4252';
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(heli.x - 24, by);
    context.lineTo(heli.x - 52, by - 8);
    context.stroke();
    // Spinning rotor.
    const rotor = state.time * 9;
    context.strokeStyle = 'rgba(20, 24, 32, 0.85)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(heli.x - Math.cos(rotor) * 40, by - 12 - Math.sin(rotor) * 4);
    context.lineTo(heli.x + Math.cos(rotor) * 40, by - 12 + Math.sin(rotor) * 4);
    context.stroke();
    worldText('CONDOR-1', heli.x, by - 26, 12, PALETTE.star);
  }

  // Police dispatch: every active unit on the chase, named, with its
  // distance in metres and what it is doing — read straight from the cops
  // the world keeps.
  function drawDispatch(state) {
    const p = state.player;
    const units = [];
    for (let i = 0; i < state.cops.length; i += 1) {
      const cop = state.cops[i];
      if (!cop.active) continue;
      const d = Math.hypot(cop.x - p.x, cop.y - p.y);
      const metres = Math.max(1, Math.round(d * 0.06));
      let tactic = 'PURSUIT';
      if (cop.down) tactic = 'DOWN';
      else if (cop.inCar) tactic = d < 150 ? 'RAMMING' : 'PURSUIT';
      else tactic = cop.arrest > 0 ? 'HOLDING' : 'ON FOOT';
      units.push({ name: DISPATCH_CALLSIGNS[i], metres, tactic });
      if (units.length >= DISPATCH.maxRows) break;
    }
    if (state.wanted >= 3) units.push({ name: 'CONDOR-1', metres: 180, tactic: 'SEARCH' });
    if (units.length === 0) return;
    const height = DISPATCH.header + units.length * DISPATCH.row + DISPATCH.pad;
    context.fillStyle = 'rgba(13, 15, 20, 0.78)';
    context.fillRect(DISPATCH.x, DISPATCH.y, DISPATCH.width, height);
    context.fillStyle = '#4b7dff';
    context.fillRect(DISPATCH.x, DISPATCH.y, 4, height);
    text('SOLMAR PD — DISPATCH', DISPATCH.x + 14, DISPATCH.y + 6, 14, '#8fb0ff', 'left');
    for (let i = 0; i < units.length; i += 1) {
      const u = units[i];
      const y = DISPATCH.y + DISPATCH.header + i * DISPATCH.row;
      text(u.name, DISPATCH.x + 14, y, 15, PALETTE.text, 'left');
      text(`${u.metres} m`, DISPATCH.x + 158, y, 15, PALETTE.muted, 'left');
      text(u.tactic, DISPATCH.x + DISPATCH.width - 12, y, 15, u.tactic === 'RAMMING' ? '#ff6b6b' : PALETTE.star, 'right');
    }
  }

  // Mission tracker: which job of the story, its name, and the stage the
  // player is on — the stage line comes from the world's mission index and stage.
  function drawMissionTracker(state) {
    const index = state.missionIndex;
    const mission = MISSIONS[index];
    let stage = (MISSION_STAGES[index] && MISSION_STAGES[index][state.missionStage]) || '';
    if (index === 3 && state.missionStage === 0) {
      let left = 0;
      for (const pk of state.pickups) if (pk.active && pk.kind === 'drop') left += 1;
      const t = Math.max(0, Math.ceil(state.missionTimer));
      stage = `Grab the drops: ${left} left · ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} on the clock`;
    }
    if (index === 4) {
      stage = `Crew: ${state.crew.length}/3 — find DANA · RICO · LENA`;
    }
    if (index === 5) {
      const t = Math.max(0, Math.ceil(state.missionTimer));
      stage = `Vault cash to the garage — ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} left, PD on your tail`;
    }
    if (index === 7 && state.missionStage === 0) {
      let left = 0;
      for (const pk of state.pickups) if (pk.active && pk.kind === 'drop') left += 1;
      const t = Math.max(0, Math.ceil(state.missionTimer));
      stage = `Grab the drops: ${left} left · ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} on the clock`;
    }
    const cx = VIEW.width / 2;
    const y = TRACKER.top;
    context.fillStyle = 'rgba(13, 15, 20, 0.72)';
    context.fillRect(cx - TRACKER.width / 2, y, TRACKER.width, TRACKER.height);
    text(`JOB ${index + 1}/${MISSIONS.length} · ${mission.name}`, cx, y + 8, 16, PALETTE.star, 'center');
    if (stage) text(stage, cx, y + 30, 15, PALETTE.text, 'center');
  }

  // Milo's dialogue box, with his portrait: the story speaks while you drive.
  function drawDialogue(state) {
    if (!state.dialogue || state.dialogueT <= 0) return;
    const d = state.dialogue;
    const x = (VIEW.width - DIALOGUE.width) / 2;
    const y = DIALOGUE.top;
    context.fillStyle = 'rgba(13, 15, 20, 0.82)';
    context.fillRect(x, y, DIALOGUE.width, DIALOGUE.height);
    context.fillStyle = PALETTE.star;
    context.fillRect(x, y, 4, DIALOGUE.height);
    // Milo: face, flat cap, eyes, smile.
    const px = x + 34;
    const py = y + DIALOGUE.height / 2;
    context.fillStyle = '#e8b98a';
    context.beginPath();
    context.arc(px, py, 19, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#a33a3a';
    context.beginPath();
    context.arc(px, py - 4, 19, Math.PI, 0);
    context.fill();
    context.fillRect(px - 19, py - 6, 38, 5);
    context.fillStyle = '#11141b';
    context.beginPath();
    context.arc(px - 7, py + 2, 2.5, 0, Math.PI * 2);
    context.arc(px + 7, py + 2, 2.5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#11141b';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(px, py + 7, 6, 0.15 * Math.PI, 0.85 * Math.PI);
    context.stroke();
    // The line, wrapped to two rows.
    const words = d.text.split(' ');
    const lines = ['', ''];
    let li = 0;
    context.font = `15px ${FONT}`;
    for (const word of words) {
      const trial = lines[li] ? `${lines[li]} ${word}` : word;
      if (context.measureText(trial).width > 470 && lines[li]) {
        li += 1;
        if (li > 1) break;
        lines[li] = word;
      } else lines[li] = trial;
    }
    const tx = x + 64;
    const speaker = `${d.speaker}: `;
    context.font = `15px ${FONT}`;
    const sw = context.measureText(speaker).width;
    text(speaker, tx, y + 12, 15, PALETTE.star, 'left');
    text(lines[0], tx + sw, y + 12, 15, PALETTE.text, 'left');
    if (lines[1]) text(lines[1], tx, y + 32, 15, PALETTE.text, 'left');
  }

  // The crew cards: who rides with you, their role and their perk.
  function drawCrewCards(state) {
    for (let i = 0; i < CREW.length; i += 1) {
      const member = CREW[i];
      const recruited = state.crew.indexOf(member.name) !== -1;
      const x = 16 + i * (CREW_CARD.width + CREW_CARD.gap);
      const y = CREW_CARD.y;
      context.fillStyle = recruited ? 'rgba(13, 15, 20, 0.78)' : 'rgba(13, 15, 20, 0.45)';
      context.fillRect(x, y, CREW_CARD.width, CREW_CARD.height);
      context.strokeStyle = recruited ? PALETTE.star : '#3a3f4a';
      context.lineWidth = recruited ? 2 : 1;
      context.strokeRect(x, y, CREW_CARD.width, CREW_CARD.height);
      text(`${member.name} · ${member.role}`, x + 10, y + 8, 13, recruited ? PALETTE.text : PALETTE.muted, 'left');
      text(recruited ? member.perk : 'NOT RECRUITED', x + 10, y + 28, 11, recruited ? '#7ee2a8' : PALETTE.muted, 'left');
    }
  }

  // Radio: the station on air and the show, with the key that changes it.
  function drawRadio(extra) {
    const station = (extra && extra.station) || 'SOLMAR FM 88.5 — SUNSET DRIVE';
    const parts = station.split(' — ');
    const x = VIEW.width - RADIO_PANEL.width - MINI.margin;
    const y = VIEW.height - MINI.height - MINI.margin - WEAPON_STRIP.gap - WEAPON_STRIP.height - 6 - RADIO_PANEL.height;
    context.fillStyle = 'rgba(13, 15, 20, 0.78)';
    context.fillRect(x, y, RADIO_PANEL.width, RADIO_PANEL.height);
    text(`RADIO · ${parts[0] || station}`, x + 10, y + 6, 13, PALETTE.text, 'left');
    text(`${parts[1] || ''} · R = change station`, x + 10, y + 24, 11, PALETTE.muted, 'left');
  }

  // Weapon strip: the player's fists and whether the next punch is ready,
  // from the punch cooldown the world already tracks — plus what is being carried.
  function drawWeaponStrip(state) {
    const p = state.player;
    const w = WEAPON_STRIP.width;
    const x = VIEW.width - w - MINI.margin;
    const y = VIEW.height - MINI.height - MINI.margin - WEAPON_STRIP.gap - WEAPON_STRIP.height;
    const ready = p.punchCooldown <= 0;
    const frac = Math.max(0, Math.min(1, 1 - p.punchCooldown / PLAYER.punchCooldown));
    context.fillStyle = 'rgba(13, 15, 20, 0.78)';
    context.fillRect(x, y, w, WEAPON_STRIP.height);
    text(`WEAPON · ${WEAPON.key}`, x + 12, y + 6, 12, PALETTE.muted, 'left');
    text(WEAPON.name, x + 12, y + 20, 17, PALETTE.text, 'left');
    text(ready ? 'READY' : 'COOLING', x + w - 12, y + 6, 12, ready ? PALETTE.health : PALETTE.muted, 'right');
    // Inventory: the package, or the drops collected on a drops job.
    let carry = null;
    if (state.carrying) carry = `CARRYING: ${state.carrying}`;
    else if ((state.missionIndex === 3 || state.missionIndex === 7) && state.missionStage === 0) {
      let total = 0;
      let left = 0;
      for (const pk of state.pickups) {
        if (pk.kind === 'drop') {
          total += 1;
          if (pk.active) left += 1;
        }
      }
      if (total > 0) carry = `DROPS ${total - left}/${total}`;
    }
    if (carry) text(carry, x + w - 12, y + 20, 12, PALETTE.star, 'right');
    const bw = w - 24;
    context.fillStyle = '#11141b';
    context.fillRect(x + 12, y + WEAPON_STRIP.height - 8, bw, 6);
    context.fillStyle = ready ? PALETTE.health : PALETTE.star;
    context.fillRect(x + 12, y + WEAPON_STRIP.height - 8, bw * frac, 6);
  }

  function drawHud(state, extra) {
    const p = state.player;
    context.textBaseline = 'top';
    // Backing panels: the sky behind the top corners is bright orange, so
    // the cash/district/respect and the clock sit on dark glass, not on the sunset.
    context.fillStyle = 'rgba(13, 15, 20, 0.6)';
    context.fillRect(12, 8, 264, 88);
    context.fillRect(VIEW.width - 356, 44, 344, 26);
    text(`$${p.cash.toLocaleString('en-US')}`, 20, 16, 30, PALETTE.text, 'left');
    text(districtFor(p.x, p.y), 20, 54, 15, PALETTE.muted, 'left');
    const respect = RESPECT_RANKS[state.storyComplete ? 8 : state.missionIndex] || 'STREET';
    text(`RESPECT · ${respect}`, 20, 74, 15, PALETTE.star, 'left');
    // Wanted stars, top centre.
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
    text(stars, VIEW.width / 2, 14, 32, PALETTE.star, 'center');
    // Health bar, top right.
    const bw = 180;
    const bx = VIEW.width - bw - 20;
    context.fillStyle = '#11141b';
    context.fillRect(bx - 4, 14, bw + 8, 26);
    context.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.healthLow;
    context.fillRect(bx, 18, bw * Math.max(0, p.health / 100), 18);
    text('HP', bx - 10, 16, 22, PALETTE.text, 'right');
    // Clock and weather, under the health bar.
    text(`${clockString(state.time)} · GOLDEN HOUR · CLEAR 28°C`, VIEW.width - 20, 52, 15, PALETTE.muted, 'right');
    // Mission line, bottom left.
    if (state.missionText) {
      context.fillStyle = 'rgba(13, 15, 20, 0.75)';
      context.fillRect(16, VIEW.height - 56, 740, 44);
      text(state.missionText, 28, VIEW.height - 46, 17, PALETTE.text, 'left');
    }
    // Speed and car damage, bottom centre-right, while driving.
    if (!p.onFoot && p.inCar) {
      const mph = Math.round(Math.abs(p.inCar.speed) * 0.14);
      text(`${mph} mph`, VIEW.width / 2 + 80, VIEW.height - 124, 26, PALETTE.text, 'center');
      const damage = p.inCar.damage || 0;
      const dbx = VIEW.width / 2 - 20;
      const dby = VIEW.height - 90;
      text('DAMAGE', dbx - 8, dby - 2, 11, PALETTE.muted, 'right');
      context.fillStyle = '#11141b';
      context.fillRect(dbx, dby, 200, 8);
      context.fillStyle = damage < 40 ? PALETTE.health : damage < 70 ? PALETTE.star : PALETTE.healthLow;
      context.fillRect(dbx, dby, 200 * Math.max(0, Math.min(1, damage / 100)), 8);
    }
    // Off-screen mission arrow.
    const t = state.missionTarget;
    if (t) {
      const sx = t.x - camera.x;
      const sy = SKY_H + (t.y - camera.y) * SQ;
      if (sx < 0 || sx > VIEW.width || sy < SKY_H || sy > VIEW.height) {
        const cx = Math.max(60, Math.min(VIEW.width - 60, sx));
        const cy = Math.max(SKY_H + 40, Math.min(VIEW.height - 60, sy));
        const a = Math.atan2(sy - cy, sx - cx);
        context.save();
        context.translate(cx, cy);
        context.rotate(a);
        context.fillStyle = PALETTE.marker;
        context.beginPath();
        context.moveTo(18, 0);
        context.lineTo(-10, -12);
        context.lineTo(-10, 12);
        context.closePath();
        context.fill();
        context.restore();
      }
    }
    drawDispatch(state);
    drawMissionTracker(state);
    drawDialogue(state);
    drawCrewCards(state);
    drawRadio(extra);
    drawWeaponStrip(state);
    drawMinimap(state);
  }

  function drawMinimap(state) {
    const mx = VIEW.width - MINI.width - MINI.margin;
    const my = VIEW.height - MINI.height - MINI.margin;
    const sx = MINI.width / WORLD.width;
    const sy = MINI.height / WORLD.height;
    context.fillStyle = 'rgba(13, 15, 20, 0.8)';
    context.fillRect(mx - 4, my - 4, MINI.width + 8, MINI.height + 8);
    context.fillStyle = PALETTE.grass;
    context.fillRect(mx, my, MINI.width, MINI.height);
    context.fillStyle = PALETTE.sea;
    context.fillRect(mx, my + WORLD.seaY * sy, MINI.width, MINI.height - WORLD.seaY * sy);
    context.fillStyle = PALETTE.road;
    for (let x = 160; x < WORLD.width; x += WORLD.roadGap) context.fillRect(mx + x * sx - 1, my, 2, MINI.height);
    for (let y = 160; y < WORLD.height; y += WORLD.roadGap) context.fillRect(mx, my + y * sy - 1, MINI.width, 2);
    const t = state.missionTarget;
    if (t) {
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(mx + t.x * sx, my + t.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const cop of state.cops) {
      if (!cop.active) continue;
      context.fillStyle = '#4b7dff';
      context.fillRect(mx + cop.x * sx - 2, my + cop.y * sy - 2, 4, 4);
    }
    if (state.wanted >= 3) {
      const heli = heliGroundPos(state);
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(mx + heli.x * sx, my + heli.y * sy, 4, 0, Math.PI * 2);
      context.fill();
    }
    const p = state.player;
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(mx + p.x * sx, my + p.y * sy, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.player;
    context.beginPath();
    context.moveTo(mx + p.x * sx, my + p.y * sy);
    context.lineTo(mx + (p.x + Math.cos(p.angle) * 220) * sx, my + (p.y + Math.sin(p.angle) * 220) * sy);
    context.stroke();
  }

  function drawPanel(title, lines, prompt, accentFirst, width) {
    const w = width || PANEL.width;
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, w, height);
    context.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      const color = accentFirst && index === 0 ? PALETTE.star : PALETTE.muted;
      text(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 20, color, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 38, 22, PALETTE.star, 'center');
  }

  // Paint one frame: sky, then the city through the chase camera, then the HUD or a panel.
  function draw(state, screen, best, extra) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const p = state.player;
    const visibleHeight = (VIEW.height - SKY_H) / SQ;
    camera.x = clamp(p.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    camera.y = clamp(p.y - visibleHeight * 0.55, 0, WORLD.height - visibleHeight);
    // Sky, in screen space.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawSky();
    // The world, tilted: x straight, y squashed, the ground running up to
    // the horizon line and no farther — the clip is what makes the horizon.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.save();
    context.beginPath();
    context.rect(0, SKY_H, VIEW.width, VIEW.height - SKY_H);
    context.clip();
    context.setTransform(view.scale, 0, 0, view.scale * SQ, view.x - camera.x * view.scale, view.y + (SKY_H - camera.y * SQ) * view.scale);
    drawCity(state);
    drawMarker(state);
    drawPickups(state);
    drawEntities(state);
    drawHeli(state);
    context.restore();
    // Golden-hour grade over the world, under the HUD.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const grade = context.createLinearGradient(0, SKY_H, 0, VIEW.height);
    grade.addColorStop(0, 'rgba(255, 120, 40, 0.05)');
    grade.addColorStop(1, 'rgba(255, 90, 20, 0.11)');
    context.fillStyle = grade;
    context.fillRect(0, SKY_H, VIEW.width, VIEW.height - SKY_H);
    if (screen === SCREEN_TITLE) {
      const save = extra && extra.save;
      const progress = save && (save.cash > 0 || save.missionIndex > 0 || (save.crew && save.crew.length > 0))
        ? (save.storyComplete
          ? 'STORY COMPLETE — Solmar is yours. Free roam, or start over.'
          : `CONTINUE — JOB ${(save.missionIndex || 0) + 1}/8 · $${(save.cash || 0).toLocaleString('en-US')} · CREW ${(save.crew || []).length}/3`)
        : `Best cash: $${(best || 0).toLocaleString('en-US')}`;
      drawPanel('SOLMAR HEAT', [
        '8 STORY JOBS · CREW OF 3 · SAVES · RADIO · 5-STAR PD CHASE',
        'Steal cars, run Milo\u2019s eight jobs, build your crew,',
        'outrun the Solmar PD from zero to five stars —',
        'and take the payday. Golden hour over Solmar Bay.',
        progress,
        'Move: WASD or arrows · Run: Shift · Steal / get out: E',
        'Punch: Space or F · Radio: R · Pause: P · Mute: M',
      ], 'Press Enter or click to start', true);
      return;
    }
    drawHud(state, extra);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for no one — except now.'], 'Press P to keep driving', false, 600);
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', [`The Solmar PD caught you. Cash kept: $${p.cash.toLocaleString('en-US')}.`, `Best cash: $${(best || 0).toLocaleString('en-US')}.`], 'Press Enter to try again', false, 600);
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', [`Solmar got the better of you. Cash kept: $${p.cash.toLocaleString('en-US')}.`, `Best cash: $${(best || 0).toLocaleString('en-US')}.`], 'Press Enter to try again', false, 600);
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel('STORY COMPLETE', [`Every job done. Payday: $${p.cash.toLocaleString('en-US')}.`, 'Solmar is yours — keep driving, the city is still open.'], 'Press Enter to keep playing', false, 600);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
