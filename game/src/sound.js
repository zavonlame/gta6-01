// Sound, synthesised with WebAudio: no audio files, nothing fetched. Every effect is a
// short oscillator envelope; the engine hum follows the car's speed and the siren wails
// while the wanted level is up. Created on the first user gesture; M mutes.

export function createSound() {
  let context = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;

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

  return {
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
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
    /** Call every frame with the driving state: engine follows speed, siren follows heat. */
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
    },
  };
}
