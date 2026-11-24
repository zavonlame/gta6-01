// radio.js — one job: the three switchable radio stations.
// R or the HUD line cycles stations; nowPlaying() is the line the HUD
// prints. No audio files: the sound module hums a tone per station.
import { STATIONS } from './config.js';

export class Radio {
  constructor() {
    this.index = 0;
    this.volume = 0.5;
  }

  get station() {
    return STATIONS[this.index];
  }

  next() {
    this.index = (this.index + 1) % STATIONS.length;
    return this.station;
  }

  tuneTo(i) {
    this.index = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
    return this.station;
  }

  stationCount() {
    return STATIONS.length;
  }

  prev() {
    this.index = (this.index - 1 + STATIONS.length) % STATIONS.length;
    return this.station;
  }

  nowPlaying() {
    const s = this.station;
    return s.name + ' ' + s.freq + ' — ' + s.genre + ' · ' + s.track;
  }

  shortLine() {
    const s = this.station;
    return s.name + ' ' + s.freq + ' — ' + s.genre;
  }
}
