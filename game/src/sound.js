// sound.js — one job: every sound, synthesised, no audio files.
// WebAudio oscillators only: engine hum, siren wail, radio blips,
// gunshots, pickup chimes and the mission-complete sting. Created lazily
// on the first key press so browsers allow it; silent until then.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
  }

  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.engineGain) this.engineGain.gain.value = 0;
    return this.muted;
  }

  engine(speedRatio) {
    if (!this.ctx || this.muted || !this.engineOsc) return;
    this.engineOsc.frequency.value = 50 + speedRatio * 130;
    this.engineGain.gain.value = 0.015 + speedRatio * 0.03;
  }

  engineOff() {
    if (this.engineGain) this.engineGain.gain.value = 0;
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.value = vol || 0.05;
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + (dur || 0.12));
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + (dur || 0.12));
    } catch {
      // sound is garnish; never break the game
    }
  }

  shot() {
    this.blip(180, 0.09, 'sawtooth', 0.09);
    this.blip(90, 0.14, 'square', 0.07);
  }

  pickup() {
    this.blip(660, 0.1, 'sine', 0.07);
    setTimeout(() => this.blip(880, 0.14, 'sine', 0.07), 90);
  }

  sting() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.22, 'triangle', 0.08), i * 110));
  }

  siren() {
    this.blip(720, 0.3, 'sine', 0.04);
    setTimeout(() => this.blip(540, 0.3, 'sine', 0.04), 300);
  }

  horn() {
    this.blip(330, 0.18, 'square', 0.05);
  }
}
