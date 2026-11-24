// police.js — one job: the Solmar PD heat system.
// Wanted stars 0-5, named dispatch units with role + distance + tactic,
// cruiser pursuit, roadblocks at 3+ stars, and the CONDOR air unit with
// its searchlight at 4+ stars. Heat decays when the player stays unseen.
import { CFG } from './config.js';

const UNIT_NAMES = [
  { call: 'SOL-11', role: 'PURSUIT' },
  { call: 'SOL-24', role: 'RAMMING' },
  { call: 'SOL-07', role: 'ROADBLOCK' },
  { call: 'SOL-33', role: 'INTERCEPT' },
  { call: 'SOL-52', role: 'PIT UNIT' },
  { call: 'SOL-90', role: 'K9 BACKUP' },
];

const TACTICS = ['CLOSING IN', 'CUTTING OFF', 'HOLDING THE LINE', 'FLANKING', 'SPOTTING FROM ABOVE', 'STAGING AHEAD'];

export class Police {
  constructor() {
    this.wanted = 0;
    this.heat = 0; // 0..100, stars derive from it
    this.cruisers = [];
    this.roadblocks = [];
    this.heli = { x: 0, y: 0, active: false, sweep: 0 };
    this.unseen = 0;
    this.spawnT = 0;
  }

  addHeat(amount) {
    this.heat = Math.min(100, this.heat + amount);
    this.recalc();
    this.unseen = 0;
  }

  recalc() {
    this.wanted = Math.min(CFG.wantedMax, Math.floor(this.heat / 20));
  }

  airActive() {
    return this.heli.active;
  }

  stars() {
    return this.wanted;
  }

  update(dt, player, world) {
    // Heat bleeds off while the player keeps out of sight.
    if (this.wanted > 0) {
      this.unseen += dt;
      if (this.unseen > 6) {
        this.heat = Math.max(0, this.heat - dt * 2.2);
        this.recalc();
      }
    }
    const wantCruisers = Math.min(this.wanted + 1, 5);
    this.spawnT -= dt;
    if (this.wanted > 0 && this.cruisers.length < wantCruisers && this.spawnT <= 0) {
      this.spawnT = 1.6;
      const a = Math.random() * Math.PI * 2;
      this.cruisers.push({
        x: player.x + Math.cos(a) * 700,
        y: player.y + Math.sin(a) * 700,
        angle: 0, speed: 0, hp: 100,
      });
    }
    for (const c of this.cruisers) {
      const dx = player.x - c.x;
      const dy = player.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      const want = Math.atan2(dy, dx);
      let diff = want - c.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      c.speed = Math.min(330 + this.wanted * 18, c.speed + 240 * dt);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      if (d < 55 && player.inCar) {
        player.speed *= 0.985;
        if (player.car) player.car.condition = Math.max(0, player.car.condition - dt * 3);
      }
    }
    if (this.wanted >= 3 && this.roadblocks.length < 2) {
      this.roadblocks.push({
        x: player.x + (Math.random() < 0.5 ? 420 : -420),
        y: player.y + (Math.random() < 0.5 ? 260 : -260),
      });
    }
    if (this.wanted < 3) this.roadblocks.length = 0;
    // CONDOR air unit.
    this.heli.active = this.wanted >= 4;
    if (this.heli.active) {
      this.heli.sweep += dt;
      const tx = player.x + Math.sin(this.heli.sweep * 0.6) * 90;
      const ty = player.y - 260 + Math.cos(this.heli.sweep * 0.5) * 60;
      this.heli.x += (tx - this.heli.x) * Math.min(1, dt * 1.4);
      this.heli.y += (ty - this.heli.y) * Math.min(1, dt * 1.4);
    }
  }

  // Six dispatch rows for the HUD panel: call sign, role, distance, tactic.
  dispatchRows(player) {
    const rows = [];
    for (let i = 0; i < 6; i++) {
      const u = UNIT_NAMES[i];
      const d = Math.round(40 + ((i * 137 + player.x * 0.13 + player.y * 0.07) % 420));
      rows.push({ call: u.call, role: u.role, dist: Math.abs(d), tactic: TACTICS[i] });
    }
    return rows;
  }

  clear() {
    this.wanted = 0;
    this.heat = 0;
    this.cruisers.length = 0;
    this.roadblocks.length = 0;
    this.heli.active = false;
  }
}
