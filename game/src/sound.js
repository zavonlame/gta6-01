// Sound, all synthesised with WebAudio: no audio files, nothing fetched.
// Every effect is a short oscillator envelope. The engine hum tracks the
// car's speed, the siren wails while the wanted level is up, and the radio
// plays three Solmar stations. The audio context is created on the first
// user gesture; M mutes.
//
// Radio: each station is a tiny step sequencer — a bassline and a lead,
// 16 steps each — scheduled ahead from the audio clock, so the music never
// stutters on a slow frame. R switches station; the HUD shows the station
// and the show on air.

const STATIONS = [
  {
    name: 'SOLMAR FM 88.5', show: 'SUNSET DRIVE', bpm: 96, root: 110, wave: 'triangle',
    bass: [0, null, 0, null, 3, null, 0, null, 5, null, 3, null, 7, null, 5, 3],
    lead: [null, null, 12, null, null, 10, null, null, 12, null, null, 7, null, 10, null, null],
    scale: [0, 3, 5, 7, 10, 12, 15],
  },
  {
    name: 'HEAT 101.2', show: 'STREET BASS', bpm: 122, root: 98, wave: 'sawtooth',
    bass: [0, 0, null, 0, null, 3, null, 0, 0, null, 5, null, 6, null, 5, 3],
    lead: [null, 12, null, null, 10, null, null, 12, null, null, 15, null, 12, null, 10, null],
    scale: [0, 3, 5, 6, 10, 12, 15],
  },
  {
    name: 'PIER 95.7', show: 'NIGHT WAVE', bpm: 80, root: 130.81, wave: 'sine',
    bass: [0, null, null, 0, null, 4, null, null, 0, null, null, 7, null, 4, null, null],
    lead: [12, null, null, 9, null, null, 7, null, null, 12, null, 9, null, null, 7, null],
    scale: [0, 2, 4, 7, 9, 12, 14],
  },
];

// Turn a scale degree (0 = the root) into a frequency in hertz.
function degreeToFreq(root, scale, degree) {
  if (degree === null || degree === undefined) return 0;
  const octaves = Math.floor(degree / 12);
  const semis = scale[degree % scale.length] ?? 0;
  return root * Math.pow(2, octaves + semis / 12);
}

export function createSound() {
  let context = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let stationIndex = 0;
  let radioStep = 0;
  let radioNextTime = 0;

  // Build the context and the two always-on voices (engine, siren) once.
  function ensure() {
    if (context) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      context = new AC();
    } catch {
      return false;
    }
    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain);
    engineGain.connect(context.destination);
    engineOsc.start();
    sirenOsc = context.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenGain = context.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(context.destination);
    sirenOsc.start();
    return true;
  }

  // One short note right now.
  function blip(freq, seconds, type, volume) {
    if (!context || muted) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume || 0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + seconds);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + seconds);
  }

  // One short note at a scheduled time on the audio clock.
  function blipAt(freq, at, seconds, type, volume) {
    if (!context || muted || freq <= 0) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume || 0.12, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + seconds);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(at);
    osc.stop(at + seconds);
  }

  // One radio step: a bass note on its line, a lead note on its line.
  function scheduleRadioStep(step, at) {
    const station = STATIONS[stationIndex];
    const stepDur = 60 / station.bpm / 2;
    const bassFreq = degreeToFreq(station.root, station.scale, station.bass[step % 16]);
    const leadFreq = degreeToFreq(station.root * 2, station.scale, station.lead[step % 16]);
    blipAt(bassFreq, at, stepDur * 0.9, station.wave, 0.055);
    blipAt(leadFreq, at, stepDur * 0.8, 'sine', 0.03);
  }

  return {
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume();
      if (context && radioNextTime === 0) radioNextTime = context.currentTime + 0.05;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    // The station the HUD shows.
    stationName() {
      const station = STATIONS[stationIndex];
      return `${station.name} — ${station.show}`;
    },
    // R: next station, with a two-note jingle so the switch is audible.
    nextStation() {
      stationIndex = (stationIndex + 1) % STATIONS.length;
      radioStep = 0;
      if (context) {
        radioNextTime = context.currentTime + 0.05;
        blip(660, 0.09, 'sine', 0.1);
        setTimeout(() => blip(880, 0.12, 'sine', 0.1), 90);
      }
      return STATIONS[stationIndex].name;
    },
    coin() {
      blip(880, 0.12, 'sine', 0.15);
      setTimeout(() => blip(1320, 0.18, 'sine', 0.15), 60);
    },
    punch() {
      blip(140, 0.12, 'sawtooth', 0.18);
    },
    mission() {
      blip(523, 0.14, 'square', 0.12);
      setTimeout(() => blip(659, 0.14, 'square', 0.12), 120);
      setTimeout(() => blip(784, 0.28, 'square', 0.12), 240);
    },
    busted() {
      blip(220, 0.5, 'sawtooth', 0.16);
      setTimeout(() => blip(165, 0.7, 'sawtooth', 0.16), 200);
    },
    // Every frame: engine follows speed, siren follows heat, radio steps
    // are scheduled a little ahead of the audio clock.
    frame(driving, speed, wanted, dt) {
      if (!context) return;
      const target = muted ? 0 : driving ? 0.03 + (speed / 520) * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + (speed / 520) * 90, context.currentTime, 0.1);
      if (wanted > 0 && !muted) {
        sirenTimer += dt;
        sirenOsc.frequency.value = 650 + Math.sin(sirenTimer * 4) * 180;
        sirenGain.gain.setTargetAtTime(0.025, context.currentTime, 0.2);
      } else {
        sirenGain.gain.setTargetAtTime(0, context.currentTime, 0.2);
      }
      // A long stall (a hidden tab) resets the radio clock instead of
      // bursting hundreds of queued notes at once.
      if (!muted && radioNextTime > 0) {
        if (radioNextTime < context.currentTime - 0.5) radioNextTime = context.currentTime + 0.05;
        const station = STATIONS[stationIndex];
        const stepDur = 60 / station.bpm / 2;
        while (radioNextTime < context.currentTime + 0.15) {
          scheduleRadioStep(radioStep, radioNextTime);
          radioStep += 1;
          radioNextTime += stepDur;
        }
      }
    },
  };
}
