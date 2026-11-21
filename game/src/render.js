// Drawing only: the world's state and the current screen in, pixels out. A camera follows
// the player through the 3840x2560 city and shows a 1280x720 window of it, scaled to fit the
// browser window. Flat shapes and canvas text for the city, the HUD and the panels.
//
// The HUD is the game's face: cash, wanted stars, health, a mission tracker with the job
// and its stage, the objective line, speed, a police-dispatch panel naming the units on
// the chase with their distance and tactic, a weapon strip, the off-screen objective
// arrow, and the minimap. Every panel reads only state the world already keeps —
// the HUD adds no rules, it shows the ones that are running.
import { CAR, DISPATCH_CALLSIGNS, FONT, MISSIONS, MISSION_STAGES, PALETTE, PED, PLAYER, VIEW, WEAPON, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

const PANEL = { width: 680, top: 150, line: 32, bottom: 76 };
const MINI = { width: 230, height: 154, margin: 16 };
const DISPATCH = { x: 16, y: 56, width: 308, header: 26, row: 20, pad: 10, maxRows: 4 };
const TRACKER = { width: 560, height: 52, top: 56 };
const WEAPON_STRIP = { width: 230, height: 48, gap: 8 };

// A stable hash from a building's position, so its windows never flicker.
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  return ((h * 1274126177) | 0) >>> 0;
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

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawCarShape(x, y, angle, length, width, body, outline) {
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
    // The pier: planks out into the sea at the south end.
    context.fillStyle = '#8a6f4d';
    context.fillRect(1900, 2320, 40, 130);
    context.fillStyle = '#a8875f';
    for (let y = 2320; y < 2450; y += 12) context.fillRect(1892, y, 56, 6);

    // Roads: asphalt with a dashed centre line, sidewalks along the edges.
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

    // The park: green with trees.
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

    // Buildings: coloured walls, a darker roof and a few lit windows.
    for (const b of state.buildings) {
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = PALETTE.buildingRoof;
      context.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      const h = hash(Math.round(b.x), Math.round(b.y));
      context.fillStyle = '#ffd23f';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if ((h >> ((cx * 3 + cy * 7) % 24)) & 1) {
            context.fillRect(b.x + 12 + cx * 26, b.y + 12 + cy * 26, 10, 10);
          }
        }
      }
    }

    // Named places: Milo's garage, the Marina safehouse.
    const places = state.places;
    context.fillStyle = '#e5534b';
    context.fillRect(places.GARAGE.x - 40, places.GARAGE.y - 26, 80, 52);
    text('GARAGE', places.GARAGE.x, places.GARAGE.y + 5, 15, PALETTE.text, 'center');
    context.fillStyle = '#3f6fd8';
    context.fillRect(places.SAFEHOUSE.x - 44, places.SAFEHOUSE.y - 26, 88, 52);
    text('SAFEHOUSE', places.SAFEHOUSE.x, places.SAFEHOUSE.y + 5, 15, PALETTE.text, 'center');
  }

  function drawPickups(state) {
    for (const pk of state.pickups) {
      if (!pk.active) continue;
      const bob = Math.sin(state.time * 4 + pk.x) * 3;
      context.fillStyle = pk.kind === 'drop' ? PALETTE.cash : '#f2c94c';
      context.beginPath();
      context.arc(pk.x, pk.y + bob, 13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#0d0f14';
      text('$', pk.x, pk.y + bob + 5, 16, '#0d0f14', 'center');
    }
  }

  function drawEntities(state) {
    for (const car of state.cars) {
      if (!car.active) continue;
      drawCarShape(car.x, car.y, car.angle, CAR.length, CAR.width, car.color, car === state.player.inCar ? PALETTE.player : '#11141b');
      if (car.color === '#3f6fd8') {
        // Cop light bar.
        context.fillStyle = Math.floor(state.time * 4) % 2 === 0 ? '#ff4b4b' : '#4b7dff';
        context.fillRect(car.x - 4, car.y - CAR.width / 2 - 2, 8, 5);
      }
    }
    for (const ped of state.peds) {
      if (!ped.active) continue;
      if (ped.down) {
        context.fillStyle = ped.color;
        context.beginPath();
        context.ellipse(ped.x, ped.y, 13, 6, ped.angle, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      context.fillStyle = ped.color;
      context.beginPath();
      context.arc(ped.x, ped.y, PED.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#11141b';
      context.beginPath();
      context.arc(ped.x + Math.cos(ped.angle) * 6, ped.y + Math.sin(ped.angle) * 6, 3, 0, Math.PI * 2);
      context.fill();
    }
    for (const cop of state.cops) {
      if (!cop.active) continue;
      if (cop.down) {
        context.fillStyle = '#3f6fd8';
        context.beginPath();
        context.ellipse(cop.x, cop.y, 14, 6, cop.angle, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      if (cop.inCar) continue; // the cop car is drawn with the cars
      context.fillStyle = PALETTE.cop;
      context.beginPath();
      context.arc(cop.x, cop.y, 13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff';
      context.fillRect(cop.x - 6, cop.y - 3, 12, 6);
    }
    const p = state.player;
    if (p.onFoot) {
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
    }
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

  /** Police dispatch: every active unit on the chase, named, with its distance in
   * metres and what it is doing — read straight from the cops the world keeps. */
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

  /** Mission tracker: which job of the story, its name, and the stage the player
   * is on — the stage line comes from the world's mission index and stage. */
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
    const cx = VIEW.width / 2;
    const y = TRACKER.top;
    context.fillStyle = 'rgba(13, 15, 20, 0.72)';
    context.fillRect(cx - TRACKER.width / 2, y, TRACKER.width, TRACKER.height);
    text(`JOB ${index + 1}/${MISSIONS.length} · ${mission.name}`, cx, y + 8, 16, PALETTE.star, 'center');
    if (stage) text(stage, cx, y + 30, 15, PALETTE.text, 'center');
  }

  /** Weapon strip: the player's fists and whether the next punch is ready,
   * from the punch cooldown the world already tracks. */
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
    const bw = w - 24;
    context.fillStyle = '#11141b';
    context.fillRect(x + 12, y + WEAPON_STRIP.height - 8, bw, 6);
    context.fillStyle = ready ? PALETTE.health : PALETTE.star;
    context.fillRect(x + 12, y + WEAPON_STRIP.height - 8, bw * frac, 6);
  }

  function drawHud(state) {
    const p = state.player;
    context.textBaseline = 'top';
    text(`$${p.cash.toLocaleString('en-US')}`, 20, 16, 30, PALETTE.text, 'left');
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
    // Mission line, bottom left.
    if (state.missionText) {
      context.fillStyle = 'rgba(13, 15, 20, 0.75)';
      context.fillRect(16, VIEW.height - 64, 740, 48);
      text(state.missionText, 28, VIEW.height - 52, 17, PALETTE.text, 'left');
    }
    // Speed, bottom centre, above the mission line, while driving.
    if (!p.onFoot && p.inCar) {
      const mph = Math.round(Math.abs(p.inCar.speed) * 0.14);
      text(`${mph} mph`, VIEW.width / 2, VIEW.height - 96, 26, PALETTE.text, 'center');
    }
    // Off-screen mission arrow.
    const t = state.missionTarget;
    if (t) {
      const sx = t.x - camera.x;
      const sy = t.y - camera.y;
      if (sx < 0 || sx > VIEW.width || sy < 0 || sy > VIEW.height) {
        const cx = Math.max(60, Math.min(VIEW.width - 60, sx));
        const cy = Math.max(60, Math.min(VIEW.height - 60, sy));
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

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 38, 22, PALETTE.star, 'center');
  }

  /** Paint one frame: the city through the camera, then the HUD or a panel. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const p = state.player;
    camera.x = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, p.x)) - VIEW.width / 2;
    camera.y = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, p.y)) - VIEW.height / 2;
    context.setTransform(view.scale, 0, 0, view.scale, view.x - camera.x * view.scale, view.y - camera.y * view.scale);
    drawCity(state);
    drawMarker(state);
    drawPickups(state);
    drawEntities(state);
    // HUD and panels live in screen space, not world space.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawPanel('SOLMAR HEAT', [
        'A top-down open-world crime game. Steal a car, run Milo\u2019s jobs,',
        'lose the Solmar PD, and take the payday — all before they take you.',
        `Best cash: $${(best || 0).toLocaleString('en-US')}`,
        'Move: WASD or arrows · Run: Shift · Steal / get out: E',
        'Punch: Space or F · Pause: P · Mute: M',
      ], 'Press Enter or click to start');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for no one — except now.'], 'Press P to keep driving');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', [`The Solmar PD caught you. Cash kept: $${p.cash.toLocaleString('en-US')}.`, `Best cash: $${(best || 0).toLocaleString('en-US')}.`], 'Press Enter to try again');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', [`Solmar got the better of you. Cash kept: $${p.cash.toLocaleString('en-US')}.`, `Best cash: $${(best || 0).toLocaleString('en-US')}.`], 'Press Enter to try again');
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel('STORY COMPLETE', [`Every job done. Payday: $${p.cash.toLocaleString('en-US')}.`, 'Solmar is yours — keep driving, the city is still open.'], 'Press Enter to keep playing');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
