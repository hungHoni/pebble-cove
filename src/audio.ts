import type { Moment } from './sim/timetable';

// Every sound is made in the browser: no audio files to download.
const PENTATONIC = [0, 2, 4, 7, 9];

export class Sound {
  muted: boolean;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private bus!: GainNode;
  private waves!: GainNode;
  private filter!: BiquadFilterNode;
  private noise!: AudioBuffer;
  private phase = 0;
  private gullIn = 14;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  /** iOS only allows sound after a tap, so every tap and key press calls this. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state !== 'running') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    // On iPhone, play alongside the player's own music and stay quiet in silent mode.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'ambient';
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(ctx.destination);

    this.bus = ctx.createGain();
    this.bus.connect(this.master);
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.28;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.25;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.bus.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(this.master);

    const len = ctx.sampleRate * 3;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 600;
    this.waves = ctx.createGain();
    this.waves.gain.value = 0;
    src.connect(this.filter);
    this.filter.connect(this.waves);
    this.waves.connect(this.master);
    src.start();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  /** A soft marimba-like note on a pentatonic scale, so any mix of stones sounds good. */
  note(step: number, when = 0, gain = 0.2) {
    const ctx = this.ctx;
    if (!ctx) return;
    const s = Math.max(0, Math.floor(step));
    const semis = PENTATONIC[s % 5] + 12 * Math.floor(s / 5);
    const f = 293.66 * Math.pow(2, semis / 12);
    const t0 = ctx.currentTime + when;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
    const o1 = ctx.createOscillator();
    o1.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = f * 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.18;
    o1.connect(env);
    o2.connect(g2);
    g2.connect(env);
    env.connect(this.bus);
    o1.start(t0);
    o2.start(t0);
    o1.stop(t0 + 1.7);
    o2.stop(t0 + 1.7);
  }

  chime() {
    [5, 7, 9].forEach((s, i) => this.note(s, i * 0.18, 0.12));
  }

  whoosh(dur = 2.5, peak = 0.12) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(300, t0);
    bp.frequency.linearRampToValueAtTime(1400, t0 + dur * 0.4);
    bp.frequency.linearRampToValueAtTime(500, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur);
  }

  private gull() {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const off of [0, 0.28]) {
      const t0 = ctx.currentTime + off;
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(1500, t0);
      o.frequency.exponentialRampToValueAtTime(950, t0 + 0.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.035, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(g);
      g.connect(this.master);
      o.start(t0);
      o.stop(t0 + 0.25);
    }
  }

  update(dt: number, m: Moment) {
    const ctx = this.ctx;
    if (!ctx) return;
    this.phase += dt;
    const swell = 0.5 + 0.5 * Math.sin(this.phase * 0.55);
    const surge = m.surge >= 0 ? Math.sin(Math.PI * m.surge) : 0;
    this.waves.gain.setTargetAtTime(0.16 + 0.08 * swell + 0.06 * m.rising + 0.18 * surge, ctx.currentTime, 0.3);
    this.filter.frequency.setTargetAtTime(420 + 380 * swell + 900 * surge, ctx.currentTime, 0.3);
    this.gullIn -= dt;
    if (this.gullIn <= 0) {
      this.gull();
      this.gullIn = 18 + Math.random() * 30;
    }
  }
}
