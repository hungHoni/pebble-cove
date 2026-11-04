import { hash, mulberry32 } from './rng';
import { LOW_DEPTH, RISE_DEPTH, WORLD_H } from './constants';

// One timetable per cove, so events never overlap: the tide every cycle, the
// great low tide in one cycle of every four, and one gust early in each cycle.
export interface Timetable {
  seed: number;
  tideLen: number;
  rise: number;
  surge: number;
  lowLen: number;
  lowEvery: number;
  gustLen: number;
  offset: number;
}

export interface Moment {
  cycle: number;
  inCycle: number;
  toNextTide: number;
  /** 0..1 over the last `rise` seconds of a cycle. */
  rising: number;
  /** 0..1 over the first `surge` seconds of a cycle, -1 otherwise. */
  surge: number;
  /** 0..1, how far the great low tide has pulled the water back. */
  low: number;
  lowActive: boolean;
  gust: { id: number; t: number; dir: 1 | -1 } | null;
}

export function makeTimetable(seed: number, tideLen = 900): Timetable {
  const r = mulberry32(seed);
  return {
    seed,
    tideLen,
    rise: Math.min(20, tideLen * 0.2),
    surge: Math.min(6, tideLen * 0.08),
    lowLen: Math.min(120, tideLen * 0.4),
    lowEvery: 4,
    gustLen: Math.min(5, tideLen * 0.06),
    offset: Math.floor(r() * tideLen),
  };
}

export function lowStart(tt: Timetable, cycle: number): number | null {
  const group = Math.floor(cycle / tt.lowEvery);
  const pick = hash(tt.seed, group, 7) % tt.lowEvery;
  if (cycle - group * tt.lowEvery !== pick) return null;
  return tt.tideLen * 0.5 - tt.lowLen / 2;
}

export function gustStart(tt: Timetable, cycle: number): number {
  const r = mulberry32(hash(tt.seed, cycle, 13));
  return tt.tideLen * (0.1 + 0.1 * r());
}

export function gustDir(tt: Timetable, id: number): 1 | -1 {
  return hash(tt.seed, id, 29) & 1 ? 1 : -1;
}

export const postcardAt = (tt: Timetable): number => tt.tideLen - tt.rise - 2;

export const smooth = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export function momentAt(tt: Timetable, timeS: number): Moment {
  const t = timeS + tt.offset;
  const cycle = Math.floor(t / tt.tideLen);
  const inCycle = t - cycle * tt.tideLen;
  const toNextTide = tt.tideLen - inCycle;
  const rising = toNextTide <= tt.rise ? 1 - toNextTide / tt.rise : 0;
  const surge = inCycle < tt.surge ? inCycle / tt.surge : -1;

  let low = 0;
  let lowActive = false;
  const ls = lowStart(tt, cycle);
  if (ls !== null && inCycle >= ls && inCycle < ls + tt.lowLen) {
    lowActive = true;
    const k = (inCycle - ls) / tt.lowLen;
    const edge = 0.22;
    low = k < edge ? smooth(k / edge) : k > 1 - edge ? smooth((1 - k) / edge) : 1;
  }

  const gs = gustStart(tt, cycle);
  const gust =
    inCycle >= gs && inCycle < gs + tt.gustLen
      ? { id: cycle, t: (inCycle - gs) / tt.gustLen, dir: gustDir(tt, cycle) }
      : null;

  return { cycle, inCycle, toNextTide, rising, surge, low, lowActive, gust };
}

/** How far the water line sits below its normal place (negative = pulled back). */
export function waterOffset(m: Moment): number {
  let off = RISE_DEPTH * smooth(m.rising);
  if (m.surge >= 0) off += RISE_DEPTH * (1 - smooth(m.surge));
  return off - LOW_DEPTH * m.low;
}

/** 0 at rest, rising to 1 when the surge covers the whole beach, back to 0. */
export function surgeReach(m: Moment): number {
  return m.surge < 0 ? 0 : Math.sin(Math.PI * Math.min(1, m.surge));
}

export function surgeFrontY(base: number, m: Moment, x: number): number {
  const s = surgeReach(m);
  if (s <= 0) return base;
  return base + (WORLD_H + 40 - base) * s + 6 * Math.sin(x / 31 + m.surge * 9);
}
