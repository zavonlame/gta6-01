// render.js — one job: paint everything the player sees.
// Golden-hour sky and skyline, the isometric city with extruded
// buildings, traffic, people, police, helicopter and smoke, then the
// whole HUD: mission tracker, dispatch board, crew cards, minimap,
// weapon slots, radio line, speed, health and armour, dialogue, toasts
// and the title screen. All canvas, so screenshots capture the game.
import { CFG, PAL, DISTRICTS, WEAPONS, respectRank } from './config.js';
import { districtAt, PLACES } from './world.js';
import { missionAt, stageAt, nextObjective } from './missions.js';
import { CREW } from './crew.js';

// Isometric 2:1 projection. wz lifts things off the ground (buildings,
// the helicopter, the objective beacon).
export function project(wx, wy, wz) {
  return { x: (wx - wy) * 0.5, y: (wx + wy) * 0.25 - (wz || 0) };
}

function camProject(state) {
  return project(state.player.x, state.player.y, 0);
}

export function draw(ctx, state) {
  const W = CFG.canvasW;
  const H = CFG.canvasH;
  if (state.mode === 'title') { drawTitle(ctx, state); return; }
  drawSky(ctx, state);
  drawGround(ctx, state);
  drawWorld(ctx, state);
  drawEntities(ctx, state);
  drawEffects(ctx, state);
  drawHud(ctx, state);
  if (state.paused) drawPaused(ctx);
  if (state.banner) drawBanner(ctx, state);
}

function drawSky(ctx, state) {
  const W = CFG.canvasW;
  const g = ctx.createLinearGradient(0, 0, 0, 300);
  g.addColorStop(0, PAL.skyTop);
  g.addColorStop(0.55, PAL.skyMid);
  g.addColorStop(1, PAL.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 300);
  // Low sun, upper right.
  ctx.fillStyle = PAL.sun;
  ctx.beginPath();
  ctx.arc(W - 210, 108, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,217,138,0.25)';
  ctx.beginPath();
  ctx.arc(W - 210, 108, 74, 0, Math.PI * 2);
  ctx.fill();
  // Skyline silhouettes.
  ctx.fillStyle = 'rgba(46,32,58,0.85)';
  let x = 0;
  let i = 0;
  while (x < W) {
    const bw = 46 + ((i * 53) % 60);
    const bh = 60 + ((i * 37) % 90);
    ctx.fillRect(x, 300 - bh, bw, bh);
    x += bw + 8;
    i++;
  }
  ctx.fillStyle = 'rgba(46,32,58,0.55)';
  ctx.fillRect(0, 296, W, 6);
}

function drawGround(ctx, state) {
  const W = CFG.canvasW;
  const H = CFG.canvasH;
  const cam = camProject(state);
  const cx = W / 2 - cam.x;
  const cy = 300 - cam.y + 130;
  ctx.save();
  ctx.fillStyle = '#6d8a4a';
  ctx.fillRect(0, 300, W, H - 300);
  // Everything flat on the ground stays below the horizon line, so no
  // road ever floats up into the sky.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 298, W, H - 298);
  ctx.clip();
  // Beach along the west edge (world x small).
  const b0 = project(0, 0, 0);
  const b1 = project(0, CFG.worldH, 0);
  const b2 = project(360, CFG.worldH, 0);
  const b3 = project(360, 0, 0);
  ctx.fillStyle = PAL.sand;
  ctx.beginPath();
  ctx.moveTo(cx + b0.x, cy + b0.y);
  ctx.lineTo(cx + b1.x, cy + b1.y);
  ctx.lineTo(cx + b2.x, cy + b2.y);
  ctx.lineTo(cx + b3.x, cy + b3.y);
  ctx.closePath();
  ctx.fill();
  // Sea beyond the beach.
  ctx.fillStyle = PAL.sea;
  ctx.beginPath();
  ctx.moveTo(cx + b0.x, cy + b0.y);
  ctx.lineTo(cx + b1.x, cy + b1.y);
  ctx.lineTo(cx + b1.x - 400, cy + b1.y + 200);
  ctx.lineTo(cx + b0.x - 400, cy + b0.y - 200);
  ctx.closePath();
  ctx.fill();
  // Roads: dark quads along each grid line.
  ctx.fillStyle = PAL.road;
  for (let gx = 0; gx <= CFG.worldW; gx += CFG.roadGap) {
    roadQuad(ctx, cx, cy, gx, 0, gx, CFG.worldH, CFG.roadW);
  }
  for (let gy = 0; gy <= CFG.worldH; gy += CFG.roadGap) {
    roadQuad(ctx, cx, cy, 0, gy, CFG.worldW, gy, CFG.roadW);
  }
  // Centre dashes.
  ctx.strokeStyle = PAL.roadLine;
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 18]);
  for (let gx = 0; gx <= CFG.worldW; gx += CFG.roadGap) {
    const a = project(gx, 0, 0);
    const b = project(gx, CFG.worldH, 0);
    ctx.beginPath();
    ctx.moveTo(cx + a.x, cy + a.y);
    ctx.lineTo(cx + b.x, cy + b.y);
    ctx.stroke();
  }
  for (let gy = 0; gy <= CFG.worldH; gy += CFG.roadGap) {
    const a = project(0, gy, 0);
    const b = project(CFG.worldW, gy, 0);
    ctx.beginPath();
    ctx.moveTo(cx + a.x, cy + a.y);
    ctx.lineTo(cx + b.x, cy + b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
  ctx.restore();
  state._screen = { cx, cy };
}

function roadQuad(ctx, cx, cy, x0, y0, x1, y1, w) {
  const p0 = project(x0, y0, 0);
  const p1 = project(x1, y1, 0);
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w / 2);
  const ny = (dx / len) * (w / 2);
  ctx.beginPath();
  ctx.moveTo(cx + p0.x + nx, cy + p0.y + ny);
  ctx.lineTo(cx + p1.x + nx, cy + p1.y + ny);
  ctx.lineTo(cx + p1.x - nx, cy + p1.y - ny);
  ctx.lineTo(cx + p0.x - nx, cy + p0.y - ny);
  ctx.closePath();
  ctx.fill();
}

function toScreen(state, wx, wy, wz) {
  const s = state._screen || { cx: 640, cy: 300 };
  const p = project(wx, wy, wz || 0);
  return { x: s.cx + p.x, y: s.cy + p.y };
}

function drawWorld(ctx, state) {
  const world = state.world;
  const items = [];
  for (const b of world.buildings) items.push({ k: b.x + b.y, b });
  items.sort((a, b2) => a.k - b2.k);
  for (const { b } of items) drawBuilding(ctx, state, b);
  for (const p of world.palms) drawPalm(ctx, state, p);
}

function drawBuilding(ctx, state, b) {
  const base = toScreen(state, b.x, b.y, 0);
  const p1 = toScreen(state, b.x + b.w, b.y, 0);
  const p2 = toScreen(state, b.x + b.w, b.y + b.h, 0);
  const p3 = toScreen(state, b.x, b.y + b.h, 0);
  const z = b.z;
  // Walls: two visible faces, then the roof on top.
  ctx.fillStyle = PAL[b.wall];
  ctx.beginPath();
  ctx.moveTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p3.x, p3.y - z);
  ctx.lineTo(p2.x, p2.y - z);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(PAL[b.wall], -18);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p2.x, p2.y - z);
  ctx.lineTo(p1.x, p1.y - z);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAL[b.roof];
  ctx.beginPath();
  ctx.moveTo(base.x, base.y - z);
  ctx.lineTo(p1.x, p1.y - z);
  ctx.lineTo(p2.x, p2.y - z);
  ctx.lineTo(p3.x, p3.y - z);
  ctx.closePath();
  ctx.fill();
  // Windows on the tall face.
  ctx.fillStyle = 'rgba(255,220,140,0.75)';
  const rows = Math.max(1, Math.floor(z / 26));
  for (let r = 0; r < rows; r++) {
    const wy = p2.y - 12 - r * 24;
    ctx.fillRect(p2.x - 14, wy, 5, 8);
    ctx.fillRect(p2.x - 26, wy, 5, 8);
  }
}

function drawPalm(ctx, state, p) {
  const s = toScreen(state, p.x, p.y, 0);
  ctx.strokeStyle = '#7a5a34';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(s.x + 2, s.y - 26);
  ctx.stroke();
  ctx.fillStyle = PAL.palm;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(s.x + 2 + Math.cos(a) * 10, s.y - 28 + Math.sin(a) * 5, 11, 4, a, 0, Math.PI * 2);
    ctx.fill();
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function drawCarShape(ctx, s, angle, color, wreck) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(angle * 0.5 + Math.PI / 4);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-16, -8, 34, 18);
  ctx.fillStyle = wreck ? '#3a3a3a' : color;
  ctx.fillRect(-16, -9, 32, 18);
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.fillRect(-2, -7, 8, 14);
  ctx.fillStyle = wreck ? '#ff7a2a' : '#ffd23e';
  ctx.fillRect(14, -7, 3, 4);
  ctx.fillRect(14, 3, 3, 4);
  ctx.restore();
}

function drawEntities(ctx, state) {
  const world = state.world;
  const p = state.player;
  // Objective beacon.
  const mission = missionAt(state.missionIndex);
  const stage = stageAt(mission, state.stageIndex);
  if (stage && stage.x !== undefined) {
    const s = toScreen(state, stage.x, stage.y, 0);
    const bob = Math.sin(state.time * 3) * 6;
    ctx.fillStyle = 'rgba(247,183,51,0.25)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, 26, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.hudEdge;
    ctx.fillRect(s.x - 3, s.y - 90 + bob, 6, 70);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 96 + bob);
    ctx.lineTo(s.x - 10, s.y - 78 + bob);
    ctx.lineTo(s.x + 10, s.y - 78 + bob);
    ctx.closePath();
    ctx.fill();
  }
  for (const c of world.traffic) {
    if (c.wreck) continue;
    drawCarShape(ctx, toScreen(state, c.x, c.y, 0), c.angle, c.color, false);
  }
  // Named-place labels so the city reads as places, not just blocks.
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(PLACES)) {
    const pl = PLACES[key];
    const s = toScreen(state, pl.x, pl.y, 0);
    if (s.x < -40 || s.x > CFG.canvasW + 40 || s.y < 300 || s.y > CFG.canvasH) continue;
    ctx.fillStyle = 'rgba(12,14,22,0.7)';
    const w = ctx.measureText(pl.name).width + 12;
    ctx.fillRect(s.x - w / 2, s.y - 26, w, 16);
    ctx.fillStyle = '#ffd98a';
    ctx.fillText(pl.name, s.x, s.y - 22);
  }
  ctx.textAlign = 'left';
  for (const ped of world.peds) {
    const s = toScreen(state, ped.x, ped.y, 0);
    ctx.fillStyle = 'hsl(' + ped.hue + ',60%,55%)';
    ctx.beginPath();
    ctx.arc(s.x, s.y - 8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(s.x - 3, s.y - 5, 6, 8);
  }
  for (const rb of state.police.roadblocks) {
    const s = toScreen(state, rb.x, rb.y, 0);
    ctx.fillStyle = '#ff5a4e';
    ctx.fillRect(s.x - 22, s.y - 6, 44, 8);
    ctx.fillStyle = '#fff';
    ctx.fillRect(s.x - 22, s.y - 6, 8, 8);
    ctx.fillRect(s.x - 6, s.y - 6, 8, 8);
    ctx.fillRect(s.x + 10, s.y - 6, 8, 8);
  }
  for (const c of state.police.cruisers) {
    drawCarShape(ctx, toScreen(state, c.x, c.y, 0), c.angle, '#20242e', false);
    const s = toScreen(state, c.x, c.y, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(s.x - 8, s.y - 14, 16, 3);
    ctx.fillStyle = (Math.floor(state.time * 4) % 2 === 0) ? '#ff3b30' : '#3b82ff';
    ctx.beginPath();
    ctx.arc(s.x - 6, s.y - 13, 3, 0, Math.PI * 2);
    ctx.arc(s.x + 6, s.y - 13, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Burning wrecks.
  for (const w of state.wrecks) {
    const s = toScreen(state, w.x, w.y, 0);
    drawCarShape(ctx, s, w.angle, '#222', true);
    ctx.fillStyle = 'rgba(255,110,30,0.9)';
    ctx.beginPath();
    ctx.arc(s.x, s.y - 8, 8 + Math.sin(state.time * 9 + w.x) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player: on foot a walker, in a car the car.
  const ps = toScreen(state, p.x, p.y, 0);
  if (p.inCar && p.car) {
    drawCarShape(ctx, ps, p.angle, p.car.color, false);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('YOU', ps.x - 12, ps.y - 20);
  } else {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(ps.x, ps.y - 10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f6fb2';
    ctx.fillRect(ps.x - 4, ps.y - 6, 8, 12);
  }
  // Helicopter with searchlight cone.
  if (state.police.heli.active) {
    const h = toScreen(state, state.police.heli.x, state.police.heli.y, 190);
    const g = toScreen(state, p.x, p.y, 0);
    ctx.fillStyle = 'rgba(255,244,180,0.20)';
    ctx.beginPath();
    ctx.moveTo(h.x - 14, h.y + 8);
    ctx.lineTo(g.x - 70, g.y + 10);
    ctx.lineTo(g.x + 70, g.y + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,244,180,0.5)';
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, 46, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22242e';
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, 26, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#22242e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(h.x - 30, h.y - 2);
    ctx.lineTo(h.x + 30, h.y - 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('CONDOR-1', h.x - 28, h.y - 16);
  }
}

function drawEffects(ctx, state) {
  for (const pt of state.particles) {
    const s = toScreen(state, pt.x, pt.y, pt.z || 0);
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Muzzle flash lines.
  for (const t of state.tracers) {
    const a = toScreen(state, t.x0, t.y0, 0);
    const b = toScreen(state, t.x1, t.y1, 0);
    ctx.strokeStyle = '#ffe98a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

// ---- HUD ----
function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PAL.hud;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PAL.hudEdge;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
}

function drawHud(ctx, state) {
  const W = CFG.canvasW;
  const H = CFG.canvasH;
  const p = state.player;
  const mission = missionAt(state.missionIndex);
  const stage = stageAt(mission, state.stageIndex);
  const district = districtAt(p.x, p.y);
  const rr = respectRank(state.respect);
  ctx.textBaseline = 'top';

  // Top-left: mission tracker.
  panel(ctx, 12, 12, 330, 92);
  ctx.fillStyle = PAL.hudEdge;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('JOB ' + mission.id + '/' + 10 + ' · ' + mission.title, 22, 20);
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.fillText('STAGE ' + (state.stageIndex + 1) + '/' + mission.stages.length, 22, 42);
  ctx.fillStyle = '#ffd98a';
  ctx.fillText('NEXT: ' + nextObjective(mission, state.stageIndex), 22, 60, 310);
  ctx.fillStyle = '#9fb4d8';
  ctx.font = '11px sans-serif';
  ctx.fillText(mission.brief, 22, 82, 310);

  // Top-centre: district, standing, respect.
  panel(ctx, W / 2 - 170, 12, 340, 56);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(district.name + ' · ' + state.standing, W / 2 - 160, 20);
  ctx.fillStyle = PAL.hudEdge;
  ctx.font = '12px sans-serif';
  ctx.fillText('RESPECT: ' + rr.rank.name + ' ' + state.respect + (rr.next ? '/' + rr.next.at : ' MAX'), W / 2 - 160, 42);

  // Top-right: money, wanted stars, air unit.
  panel(ctx, W - 252, 12, 240, state.police.heli.active ? 92 : 72);
  ctx.fillStyle = '#7ddc7d';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('$' + state.money.toLocaleString('en-US'), W - 242, 20);
  ctx.font = '20px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < state.police.wanted ? '★' : '☆';
  ctx.fillStyle = PAL.star;
  ctx.fillText(stars, W - 242, 46);
  if (state.police.heli.active) {
    ctx.fillStyle = '#ff5a4e';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('AIR UNIT DEPLOYED', W - 242, 72);
  }

  // Left-mid: SOLMAR PD dispatch board, six named units.
  const rows = state.police.dispatchRows(p);
  panel(ctx, 12, 150, 300, 30 + rows.length * 20);
  ctx.fillStyle = PAL.hudEdge;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('SOLMAR PD DISPATCH', 22, 158);
  ctx.font = '11px monospace';
  rows.forEach((r, i) => {
    ctx.fillStyle = i < state.police.wanted + 1 ? '#fff' : '#8a93a8';
    ctx.fillText(r.call + ' ' + r.role + ' ' + r.dist + 'm ' + r.tactic, 22, 180 + i * 20);
  });

  // Right-mid: crew ability cards.
  panel(ctx, W - 252, 150, 240, 118);
  ctx.fillStyle = PAL.hudEdge;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('CREW — press 1/2/3', W - 242, 158);
  CREW.forEach((c, i) => {
    const cd = Math.max(0, state.crewCooldown[c.id] || 0);
    const y = 178 + i * 30;
    ctx.fillStyle = c.color;
    ctx.fillRect(W - 242, y, 10, 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(c.name + ' · ' + c.role, W - 228, y - 1);
    ctx.fillStyle = '#c8d0e0';
    ctx.font = '10px sans-serif';
    ctx.fillText(c.ability + ' — ' + c.desc + (cd > 0 ? ' (' + Math.ceil(cd) + 's)' : ' READY'), W - 228, y + 11);
  });

  // Bottom-left: circular minimap.
  const mx = 92;
  const my = H - 92;
  const mr = 72;
  ctx.save();
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#22304a';
  ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
  const scale = (mr * 2) / CFG.worldW;
  ctx.fillStyle = PAL.road;
  for (let gx = 0; gx <= CFG.worldW; gx += CFG.roadGap) {
    ctx.fillRect(mx - mr + gx * scale, my - mr, 3, mr * 2);
    ctx.fillRect(mx - mr, my - mr + gx * scale, mr * 2, 3);
  }
  ctx.fillStyle = PAL.sea;
  ctx.fillRect(mx - mr, my - mr, 8, mr * 2);
  for (const c of state.police.cruisers) {
    ctx.fillStyle = '#ff5a4e';
    ctx.fillRect(mx - mr + c.x * scale - 2, my - mr + c.y * scale - 2, 4, 4);
  }
  if (stage && stage.x !== undefined) {
    ctx.fillStyle = PAL.hudEdge;
    ctx.beginPath();
    ctx.arc(mx - mr + stage.x * scale, my - mr + stage.y * scale, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx - mr + p.x * scale, my - mr + p.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = PAL.hudEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('SOLMAR', mx - 22, my + mr + 6);

  // Bottom-centre: weapon slots strip + radio line.
  const slotW = 58;
  const slotsX = W / 2 - (WEAPONS.length * slotW) / 2;
  const slotsY = H - 64;
  WEAPONS.forEach((w, i) => {
    const x = slotsX + i * slotW;
    const selected = state.weapon === i;
    ctx.fillStyle = selected ? 'rgba(247,183,51,0.85)' : PAL.hud;
    ctx.fillRect(x, slotsY, slotW - 4, 34);
    ctx.strokeStyle = selected ? '#fff' : '#5a6378';
    ctx.strokeRect(x + 0.5, slotsY + 0.5, slotW - 5, 33);
    ctx.fillStyle = w.locked ? '#8a93a8' : '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(w.locked ? 'LOCKED' : w.name, x + 5, slotsY + 8);
    ctx.fillStyle = '#c8d0e0';
    ctx.font = '9px sans-serif';
    ctx.fillText(w.owned ? 'OWNED' : 'SHOP', x + 5, slotsY + 21);
  });
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RADIO: ' + state.radio.shortLine() + '  [R to change]', W / 2, H - 24);
  ctx.textAlign = 'left';

  // Bottom-right: speed, car, condition, health, armour.
  panel(ctx, W - 252, H - 118, 240, 106);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(Math.round(Math.abs(p.speed || 0) * 2.2) + ' km/h', W - 242, H - 110);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#ffd98a';
  ctx.fillText(p.inCar && p.car ? p.car.name : 'ON FOOT', W - 242, H - 82);
  if (p.inCar && p.car) {
    const cond = Math.round(p.car.condition);
    ctx.fillStyle = cond > 50 ? '#7ddc7d' : '#ff5a4e';
    ctx.fillText('CONDITION ' + cond + '%', W - 242, H - 64);
    bar(ctx, W - 242, H - 48, 220, 6, cond / 100, cond > 50 ? '#7ddc7d' : '#ff5a4e');
  }
  ctx.fillStyle = '#fff';
  ctx.font = '11px sans-serif';
  ctx.fillText('HEALTH', W - 242, H - 34);
  bar(ctx, W - 182, H - 34, 160, 8, p.hp / 100, '#7ddc7d');
  ctx.fillText('ARMOUR', W - 242, H - 20);
  bar(ctx, W - 182, H - 20, 160, 8, p.armour / 100, '#7ab8ff');

  // Dialogue box with portrait.
  if (state.dialogue) {
    const dx = W / 2 - 260;
    const dy = H - 168;
    panel(ctx, dx, dy, 520, 92);
    ctx.fillStyle = state.dialogue.color || PAL.hudEdge;
    ctx.beginPath();
    ctx.arc(dx + 42, dy + 46, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((state.dialogue.name || 'C')[0], dx + 42, dy + 38);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(state.dialogue.name + ' — ' + (state.dialogue.role || ''), dx + 86, dy + 14);
    ctx.fillStyle = '#e8ecf4';
    ctx.font = '13px sans-serif';
    wrapText(ctx, state.dialogue.text, dx + 86, dy + 36, 420, 17);
  }

  // Toast line under the district panel.
  if (state.toast) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.toast, W / 2, 82);
    ctx.textAlign = 'left';
  }

  // Controls hint, bottom edge left of minimap.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '11px sans-serif';
  ctx.fillText('WASD drive/walk · E enter car · F fire · R radio · G garage · Q race · 1/2/3 crew · P pause', 180, H - 8);
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawBanner(ctx, state) {
  const W = CFG.canvasW;
  ctx.fillStyle = 'rgba(12,14,22,0.85)';
  ctx.fillRect(W / 2 - 260, 120, 520, 64);
  ctx.strokeStyle = PAL.hudEdge;
  ctx.strokeRect(W / 2 - 260, 120, 520, 64);
  ctx.fillStyle = PAL.hudEdge;
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(state.banner, W / 2, 138);
  ctx.textAlign = 'left';
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(10,10,16,0.6)';
  ctx.fillRect(0, 0, CFG.canvasW, CFG.canvasH);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', CFG.canvasW / 2, CFG.canvasH / 2 - 10);
  ctx.font = '15px sans-serif';
  ctx.fillText('Press P to keep playing', CFG.canvasW / 2, CFG.canvasH / 2 + 24);
  ctx.textAlign = 'left';
}

function drawTitle(ctx, state) {
  const W = CFG.canvasW;
  const H = CFG.canvasH;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1c2450');
  g.addColorStop(0.5, '#c65a2e');
  g.addColorStop(1, '#f7b733');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(20,16,40,0.55)';
  ctx.fillRect(0, H - 190, W, 190);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 74px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR HEAT', W / 2, 150);
  ctx.fillStyle = PAL.hudEdge;
  ctx.font = 'bold 19px sans-serif';
  ctx.fillText('10 STORY JOBS · CREW OF 3 · SAVES · RADIO · RACES · GARAGE · 5-STAR PD CHASE', W / 2, 190);
  ctx.fillStyle = '#ffe9b0';
  ctx.font = '15px sans-serif';
  ctx.fillText('A sun-soaked open-world crime game in the fictional coastal city of Solmar.', W / 2, 224);
  ctx.fillText('Fixer Cassia Voss has ten jobs for you. The Solmar PD has other plans.', W / 2, 248);
  // Save slots.
  const slots = state.slots || [];
  for (let i = 0; i < 3; i++) {
    const x = W / 2 - 330 + i * 226;
    panel(ctx, x, 300, 210, 96);
    ctx.fillStyle = PAL.hudEdge;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SAVE SLOT ' + (i + 1), x + 12, 312);
    const s = slots[i];
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    if (s) {
      ctx.fillText('$' + s.money.toLocaleString('en-US'), x + 12, 336);
      ctx.fillText('Job ' + (s.missionIndex + 1) + ' of 10', x + 12, 356);
      ctx.fillText('Respect ' + s.respect, x + 12, 376);
    } else {
      ctx.fillText('— EMPTY —', x + 12, 336);
      ctx.fillText('A fresh start in Solmar.', x + 12, 356);
    }
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(state.slots && state.slots.some(Boolean) ? 'PRESS ENTER — CONTINUE  ·  N — NEW GAME' : 'PRESS ENTER — NEW GAME', W / 2, 440);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#ffe9b0';
  ctx.fillText('WASD move / drive · E steal & enter cars · F fire · R radio · G garage · Q street race · 1/2/3 crew abilities · P pause', W / 2, 480);
  ctx.fillText('Saves live in your browser (localStorage). Money, respect and district standing carry across jobs.', W / 2, 506);
  ctx.textAlign = 'left';
  // Mini skyline along the bottom.
  ctx.fillStyle = 'rgba(30,20,50,0.8)';
  let x = 0;
  let i = 0;
  while (x < W) {
    const bw = 40 + ((i * 41) % 70);
    const bh = 50 + ((i * 29) % 80);
    ctx.fillRect(x, H - bh, bw, bh);
    x += bw + 6;
    i++;
  }
}
