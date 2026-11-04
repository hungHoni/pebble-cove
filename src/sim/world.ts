import { hash, mulberry32 } from './rng';
import {
  HAT_PICK_R, ISLAND, MAX_STONES, SHORE_Y, SPEED_ME, SPEED_RESIDENT, STACK_COOLDOWN_S, STACK_R, STAND_ASIDE,
  WAVE_S, WORLD_H, WORLD_W,
} from './constants';
import {
  gustStart, lowStart, makeTimetable, momentAt, postcardAt, surgeFrontY, waterOffset,
  type Moment, type Timetable,
} from './timetable';

// The game rules. No drawing, no DOM: the step 2 server runs this same file.

export type HatState = 'on' | 'flying' | 'floating' | 'ground';

export interface Hat {
  state: HatState;
  x: number;
  y: number;
  z: number;
  spin: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t0: number;
  dur: number;
  dir: 1 | -1;
}

export interface Ai {
  mode: 'idle' | 'walk' | 'sit' | 'stack' | 'fetch';
  until: number;
  homeX: number;
  stacksLeft: number;
  waveBackAt: number | null;
  lastWaveBack: number;
}

export interface Person {
  id: number;
  resident: boolean;
  color: number;
  hatStyle: number;
  x: number;
  y: number;
  tx: number | null;
  ty: number | null;
  moving: boolean;
  sitting: boolean;
  floating: boolean;
  facing: 1 | -1;
  waveLeft: number;
  stackLeft: number;
  hat: Hat;
  ai: Ai | null;
}

export interface Stone {
  color: number;
  by: number;
}

export interface Cairn {
  id: number;
  spot: number;
  x: number;
  y: number;
  stones: Stone[];
  washedAt: number | null;
}

export interface Spot {
  id: number;
  x: number;
  y: number;
  sandbar: boolean;
}

export interface Rock {
  x: number;
  y: number;
  r: number;
}

export interface WorldEvent {
  t: number;
  type: string;
  [key: string]: unknown;
}

export interface WorldOptions {
  seed: number;
  tideLen: number;
  startTime: number;
  me: { color: number; hat: number };
  residents?: number;
}

export function shoreShape(x: number): number {
  return 7 * Math.sin(x / 38) + 4 * Math.sin(x / 17 + 1.3) + 10 * Math.sin(x / 140 + 0.7);
}

/** At low tide the water pulls back further in front of the island, leaving a sandbar. */
export function sandbarDip(x: number): number {
  const d = (x - ISLAND.x) / 70;
  return -70 * Math.exp(-d * d);
}

export function waterline(x: number, m: Moment): number {
  return SHORE_Y + shoreShape(x) + waterOffset(m) + m.low * sandbarDip(x);
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class World {
  readonly tt: Timetable;
  time: number;
  moment: Moment;
  readonly people: Person[] = [];
  readonly me: Person;
  readonly spots: Spot[] = [];
  readonly rocks: Rock[] = [];
  readonly cairns = new Map<number, Cairn>();
  washed: Cairn[] = [];
  events: WorldEvent[] = [];
  myStones = 0;
  keyDir = { x: 0, y: 0 };

  private rng: () => number;
  private nextCairnId = 1;
  private lastPostcard: number;
  private lastRise: number;
  private lastSurge: number;
  private lastGust: number;
  private wasLow: boolean;
  private lowEnding = false;

  constructor(opts: WorldOptions) {
    this.tt = makeTimetable(opts.seed, opts.tideLen);
    this.time = opts.startTime;
    this.moment = momentAt(this.tt, this.time);
    this.rng = mulberry32(hash(opts.seed, 99));
    this.buildRocks();
    this.buildSpots();
    this.me = this.addPerson(false, opts.me.color, opts.me.hat, 800, 270);
    const n = opts.residents ?? 7;
    for (let i = 0; i < n; i++) {
      const r = mulberry32(hash(opts.seed, i, 3));
      const x = 560 + r() * 480;
      const y = 200 + r() * 220;
      const p = this.addPerson(true, (i + 3) % 7, Math.floor(r() * 4), x, y);
      const spot = this.walkableNear(p.x, p.y);
      p.x = spot.x;
      p.y = spot.y;
      p.ai = { mode: 'idle', until: this.time + r() * 4, homeX: 120 + (i / Math.max(1, n - 1)) * 1360, stacksLeft: 0, waveBackAt: null, lastWaveBack: -99 };
    }
    this.lastPostcard = this.moment.inCycle >= postcardAt(this.tt) ? this.moment.cycle : this.moment.cycle - 1;
    this.lastRise = this.moment.rising > 0 ? this.moment.cycle : this.moment.cycle - 1;
    this.lastSurge = this.moment.surge >= 0 ? this.moment.cycle : this.moment.cycle - 1;
    this.lastGust = this.moment.gust ? this.moment.gust.id : -1;
    this.wasLow = this.moment.lowActive;
  }

  // ---- setup -------------------------------------------------------------

  private buildRocks() {
    const r = mulberry32(hash(this.tt.seed, 41));
    for (let i = 0; i < 11; i++) {
      this.rocks.push({ x: 60 + (i / 10) * 1480 + (r() - 0.5) * 90, y: 200 + r() * 220, r: 12 + r() * 12 });
    }
  }

  private buildSpots() {
    const r = mulberry32(hash(this.tt.seed, 57));
    let id = 0;
    const rows = [222, 305, 390];
    for (let col = 0; col < 12; col++) {
      for (const row of rows) {
        const x = 70 + col * 132 + (r() - 0.5) * 50;
        const y = row + (r() - 0.5) * 36;
        if (this.rocks.some((k) => Math.hypot(k.x - x, k.y - y) < k.r + 34)) continue;
        this.spots.push({ id: id++, x, y, sandbar: false });
      }
    }
    for (const [dx, dy] of [[-46, 92], [10, 70], [52, 96]]) {
      this.spots.push({ id: id++, x: ISLAND.x + dx, y: ISLAND.y + dy, sandbar: true });
    }
  }

  private addPerson(resident: boolean, color: number, hatStyle: number, x: number, y: number): Person {
    const p: Person = {
      id: this.people.length,
      resident,
      color,
      hatStyle,
      x,
      y,
      tx: null,
      ty: null,
      moving: false,
      sitting: false,
      floating: false,
      facing: 1,
      waveLeft: 0,
      stackLeft: 0,
      hat: { state: 'on', x, y, z: 0, spin: 0, fromX: x, fromY: y, toX: x, toY: y, t0: 0, dur: 1, dir: 1 },
      ai: null,
    };
    this.people.push(p);
    return p;
  }

  // ---- geometry ----------------------------------------------------------

  waterline(x: number): number {
    return waterline(x, this.moment);
  }

  /** The water line without the tide's daily rise, used for sand that stays dry. */
  inWater(x: number, y: number, margin = 10): boolean {
    return y < this.waterline(x) + margin;
  }

  walkable(x: number, y: number): boolean {
    if (x < 12 || x > WORLD_W - 12 || y > WORLD_H - 12 || y < -30) return false;
    if (this.inWater(x, y)) return false;
    return !this.rocks.some((k) => Math.hypot(k.x - x, k.y - y) < k.r + 6);
  }

  walkableNear(x: number, y: number): { x: number; y: number } {
    let nx = clamp(x, 14, WORLD_W - 14);
    let ny = clamp(y, -28, WORLD_H - 14);
    ny = Math.max(ny, this.waterline(nx) + 14);
    for (const k of this.rocks) {
      const d = Math.hypot(nx - k.x, ny - k.y);
      if (d < k.r + 8) {
        const a = d > 0.01 ? Math.atan2(ny - k.y, nx - k.x) : Math.PI / 2;
        nx = k.x + Math.cos(a) * (k.r + 9);
        ny = k.y + Math.sin(a) * (k.r + 9);
      }
    }
    return { x: nx, y: Math.max(ny, this.waterline(nx) + 14) };
  }

  spotOpen(s: Spot): boolean {
    return !this.inWater(s.x, s.y, 6);
  }

  nearestSpot(x: number, y: number, openOnly = true): { spot: Spot; dist: number } | null {
    let best: Spot | null = null;
    let bd = Infinity;
    for (const s of this.spots) {
      if (openOnly && !this.spotOpen(s)) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best ? { spot: best, dist: bd } : null;
  }

  // ---- actions -----------------------------------------------------------

  /** Changes the player's look, making sure no resident wears the same color and hat. */
  setLook(color: number, hatStyle: number) {
    this.me.color = color;
    this.me.hatStyle = hatStyle;
    for (const q of this.people) {
      if (q !== this.me && q.color === color && q.hatStyle === hatStyle) q.hatStyle = (hatStyle + 1) % 4;
    }
  }

  walkTo(p: Person, x: number, y: number) {
    if (p.floating) return;
    // A tap on a ring of pebbles means "go and stand next to it".
    const near = this.nearestSpot(x, y, false);
    if (near && near.dist < 14) {
      x = near.spot.x + (p.x < near.spot.x ? -STAND_ASIDE : STAND_ASIDE);
      y = near.spot.y + 3;
    }
    const t = this.walkableNear(x, y);
    p.tx = t.x;
    p.ty = t.y;
    p.sitting = false;
  }

  canWave(p: Person): boolean {
    return p.waveLeft <= 0 && !p.floating;
  }

  wave(p: Person): boolean {
    if (!this.canWave(p)) return false;
    p.waveLeft = WAVE_S;
    this.emit('wave', { by: p.id });
    if (p === this.me) {
      for (const q of this.people) {
        if (!q.ai || Math.hypot(q.x - p.x, q.y - p.y) > 150) continue;
        if (this.time - q.ai.lastWaveBack < 12) continue;
        q.ai.waveBackAt = this.time + 0.5 + this.rng() * 0.8;
        q.ai.lastWaveBack = this.time;
      }
    }
    return true;
  }

  canSit(p: Person): boolean {
    return !p.floating;
  }

  toggleSit(p: Person): boolean {
    if (!this.canSit(p)) return false;
    p.tx = p.ty = null;
    p.sitting = !p.sitting;
    this.emit(p.sitting ? 'sit' : 'stand', { by: p.id });
    return true;
  }

  canStack(p: Person): { ok: boolean; spot?: Spot; reason?: string } {
    if (this.moment.surge >= 0) return { ok: false, reason: 'The tide is washing in' };
    if (p.floating) return { ok: false, reason: 'You are floating back to shore' };
    if (p.stackLeft > 0) return { ok: false, reason: 'One stone at a time' };
    const near = this.nearestSpot(p.x, p.y);
    if (!near || near.dist > STACK_R) return { ok: false, reason: 'Walk to a ring of pebbles to stack' };
    const c = this.cairns.get(near.spot.id);
    if (c && c.stones.length >= MAX_STONES) return { ok: false, reason: 'This cairn is as tall as it gets' };
    return { ok: true, spot: near.spot };
  }

  stack(p: Person): boolean {
    const r = this.canStack(p);
    if (!r.ok || !r.spot) return false;
    const s = r.spot;
    p.sitting = false;
    p.tx = p.ty = null;
    let c = this.cairns.get(s.id);
    if (!c) {
      c = { id: this.nextCairnId++, spot: s.id, x: s.x, y: s.y, stones: [], washedAt: null };
      this.cairns.set(s.id, c);
    }
    c.stones.push({ color: p.color, by: p.id });
    p.stackLeft = STACK_COOLDOWN_S;
    // Step aside so the cairn isn't hidden behind the builder.
    if (Math.hypot(p.x - s.x, p.y - s.y) < STAND_ASIDE - 4) {
      const side = p.x < s.x ? -1 : 1;
      const aside = this.walkableNear(s.x + side * STAND_ASIDE, s.y + 3);
      p.tx = aside.x;
      p.ty = aside.y;
    }
    p.facing = s.x >= p.x ? 1 : -1;
    if (p === this.me) this.myStones++;
    this.emit('stack', { by: p.id, spot: s.id, height: c.stones.length, color: p.color, x: s.x, y: s.y });
    return true;
  }

  // ---- debug -------------------------------------------------------------

  /** Moves the clock to a few seconds before an event. Used by ?skip= and tests. */
  jumpTo(kind: 'rise' | 'surge' | 'low' | 'gust') {
    const tt = this.tt;
    const m = this.moment;
    let target: number | null = null;
    for (let c = m.cycle; c < m.cycle + tt.lowEvery + 2 && target === null; c++) {
      const base = c * tt.tideLen - tt.offset;
      let at: number | null = null;
      if (kind === 'rise') at = tt.tideLen - tt.rise;
      if (kind === 'surge') at = tt.tideLen;
      if (kind === 'gust') at = gustStart(tt, c);
      if (kind === 'low') at = lowStart(tt, c);
      if (at === null) continue;
      if (base + at - 3 > this.time) target = base + at - 3;
    }
    if (target === null) return;
    this.time = target;
    this.moment = momentAt(tt, this.time);
    this.lastPostcard = this.moment.inCycle >= postcardAt(tt) ? this.moment.cycle : this.moment.cycle - 1;
    this.lastRise = this.moment.rising > 0 ? this.moment.cycle : this.moment.cycle - 1;
    this.lastSurge = this.moment.surge >= 0 ? this.moment.cycle : this.moment.cycle - 1;
    this.wasLow = this.moment.lowActive;
  }

  // ---- simulation --------------------------------------------------------

  /**
   * Brings the world up to a clock time in small steps. The tide follows the
   * real clock, so a slow phone or a hidden tab never falls behind it. A long
   * gap (a locked phone) skips ahead, and a tide missed in the gap still
   * washes the cairns away.
   */
  advanceTo(target: number) {
    let gap = target - this.time;
    if (gap <= 0) return;
    if (gap > 3) {
      const before = this.moment.cycle;
      this.time = target - 3;
      this.moment = momentAt(this.tt, this.time);
      if (this.moment.cycle !== before) {
        this.cairns.clear();
        this.lastSurge = this.moment.cycle;
      }
      gap = 3;
    }
    while (gap > 1e-6) {
      const d = Math.min(0.05, gap);
      this.step(d);
      gap -= d;
    }
  }

  step(dt: number) {
    this.time += dt;
    const m = (this.moment = momentAt(this.tt, this.time));
    this.timetableEvents(m);
    for (const p of this.people) {
      p.waveLeft = Math.max(0, p.waveLeft - dt);
      p.stackLeft = Math.max(0, p.stackLeft - dt);
      if (p.ai) this.thinkResident(p);
      this.move(p, dt);
      this.updateHat(p, dt);
    }
    this.washCairns(m);
    this.washed = this.washed.filter((c) => this.time - (c.washedAt ?? 0) < 2);
  }

  drainEvents(): WorldEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  private emit(type: string, data: Record<string, unknown> = {}) {
    this.events.push({ t: this.time, type, ...data });
    if (this.events.length > 200) this.events.splice(0, this.events.length - 200);
  }

  private timetableEvents(m: Moment) {
    if (m.inCycle >= postcardAt(this.tt) && this.lastPostcard !== m.cycle) {
      this.lastPostcard = m.cycle;
      this.emit('postcard', { cycle: m.cycle });
    }
    if (m.rising > 0 && this.lastRise !== m.cycle) {
      this.lastRise = m.cycle;
      this.emit('tide-rising');
    }
    if (m.surge >= 0 && this.lastSurge !== m.cycle) {
      this.lastSurge = m.cycle;
      const heights = [...this.cairns.values()].map((c) => c.stones.length).sort((a, b) => a - b);
      this.emit('surge', { heights });
    }
    if (m.lowActive && !this.wasLow) {
      this.lowEnding = false;
      this.emit('low-start');
    }
    if (m.lowActive && !this.lowEnding && m.low < 1 && m.inCycle > (lowStart(this.tt, m.cycle) ?? 0) + this.tt.lowLen / 2) {
      this.lowEnding = true;
      this.emit('low-ending');
    }
    if (!m.lowActive && this.wasLow) this.emit('low-end');
    this.wasLow = m.lowActive;
    if (m.gust && m.gust.id !== this.lastGust) {
      this.lastGust = m.gust.id;
      this.startGust(m.gust.id, m.gust.dir);
    }
  }

  private startGust(id: number, dir: 1 | -1) {
    const blown: number[] = [];
    for (const p of this.people) {
      if (p.hat.state !== 'on') continue;
      // Every screen works out the same path from the gust and the owner,
      // so a gust never needs to be sent over the network.
      const r = mulberry32(hash(this.tt.seed, id, p.id, 61));
      const h = p.hat;
      h.state = 'flying';
      h.fromX = p.x;
      h.fromY = p.y;
      h.toX = clamp(p.x + dir * (60 + r() * 90), 20, WORLD_W - 20);
      h.toY = clamp(p.y + (r() - 0.5) * 80 - 12, -20, WORLD_H - 16);
      h.t0 = this.time;
      h.dur = 2.4 + r() * 1.2;
      h.dir = dir;
      blown.push(p.id);
    }
    this.emit('gust', { dir, blown });
  }

  private updateHat(p: Person, dt: number) {
    const h = p.hat;
    if (h.state === 'on') {
      h.x = p.x;
      h.y = p.y;
      h.z = 0;
      return;
    }
    if (h.state === 'flying') {
      const k = (this.time - h.t0) / h.dur;
      if (k >= 1) {
        h.x = h.toX;
        h.y = h.toY;
        h.z = 0;
        h.spin = 0;
        h.t0 = this.time;
        h.state = this.inWater(h.x, h.y, 4) ? 'floating' : 'ground';
        this.emit('hat-landed', { by: p.id, water: h.state === 'floating' });
      } else {
        const e = 1 - (1 - k) * (1 - k);
        h.x = h.fromX + (h.toX - h.fromX) * e;
        h.y = h.fromY + (h.toY - h.fromY) * e;
        h.z = 30 * (1 - k) + 26 * Math.sin(Math.PI * k);
        h.spin = h.dir * k * Math.PI * 3;
      }
      return;
    }
    if (h.state === 'floating') {
      // Hats in the water ride the next wave back to the shore.
      const target = this.waterline(h.x) + 16;
      h.y += (target - h.y) * Math.min(1, dt * 0.7);
      if (this.time - h.t0 > 6 && !this.inWater(h.x, h.y, 4)) {
        h.state = 'ground';
        this.emit('hat-ashore', { by: p.id });
      }
    }
    if (h.state === 'ground' && Math.hypot(p.x - h.x, p.y - h.y) < HAT_PICK_R && !p.floating) {
      h.state = 'on';
      this.emit('hat-picked', { by: p.id });
    }
  }

  private move(p: Person, dt: number) {
    if (p.floating || this.inWater(p.x, p.y, 8)) {
      // Anyone the water catches floats gently back to shore.
      if (!p.floating) this.emit('floated', { by: p.id });
      p.floating = true;
      p.sitting = false;
      p.tx = p.ty = null;
      const target = this.waterline(p.x) + 18;
      p.y = Math.min(p.y + 26 * dt, target);
      if (p.y < target - 0.5 && p.y < WORLD_H - 14) {
        p.moving = false;
        return;
      }
      p.floating = false;
    }
    let dx = 0;
    let dy = 0;
    if (p === this.me && (this.keyDir.x || this.keyDir.y)) {
      dx = this.keyDir.x;
      dy = this.keyDir.y;
      p.tx = p.ty = null;
    } else if (p.tx !== null && p.ty !== null) {
      const ddx = p.tx - p.x;
      const ddy = p.ty - p.y;
      const d = Math.hypot(ddx, ddy);
      if (d < 2) p.tx = p.ty = null;
      else {
        dx = ddx / d;
        dy = ddy / d;
      }
    }
    if (!dx && !dy) {
      p.moving = false;
      return;
    }
    p.sitting = false;
    const n = Math.hypot(dx, dy);
    const sp = (p.resident ? SPEED_RESIDENT : SPEED_ME) * dt;
    const nx = p.x + (dx / n) * sp;
    const ny = p.y + (dy / n) * sp;
    let moved = true;
    if (this.walkable(nx, ny)) {
      p.x = nx;
      p.y = ny;
    } else if (this.walkable(nx, p.y)) p.x = nx;
    else if (this.walkable(p.x, ny)) p.y = ny;
    else {
      moved = false;
      p.tx = p.ty = null;
    }
    p.moving = moved;
    if (Math.abs(dx) > 0.15) p.facing = dx > 0 ? 1 : -1;
  }

  private washCairns(m: Moment) {
    const gone: number[] = [];
    for (const [spot, c] of this.cairns) {
      const base = this.waterline(c.x);
      const reached = m.surge >= 0 && m.surge < 0.55 && surgeFrontY(base, m, c.x) > c.y - 4;
      if (reached || this.inWater(c.x, c.y, 2)) {
        c.washedAt = this.time;
        this.washed.push(c);
        this.cairns.delete(spot);
        gone.push(c.id);
      }
    }
    if (gone.length) this.emit('wash', { cairns: gone });
  }

  private thinkResident(p: Person) {
    const a = p.ai!;
    if (p.floating) return;
    if (a.waveBackAt !== null && this.time >= a.waveBackAt) {
      a.waveBackAt = null;
      this.wave(p);
    }
    const h = p.hat;
    if (h.state === 'flying' || h.state === 'floating') {
      p.tx = p.ty = null;
      p.sitting = false;
      return;
    }
    if (h.state === 'ground') {
      a.mode = 'fetch';
      if (p.tx === null) this.walkTo(p, h.x, h.y);
      return;
    }
    if (a.mode === 'fetch') {
      a.mode = 'idle';
      a.until = this.time + 1 + this.rng() * 2;
    }
    switch (a.mode) {
      case 'walk':
        if (p.tx === null) {
          a.mode = 'idle';
          a.until = this.time + 2 + this.rng() * 4;
        }
        break;
      case 'sit':
        if (this.time >= a.until) {
          p.sitting = false;
          a.mode = 'idle';
          a.until = this.time + 1 + this.rng() * 2;
        }
        break;
      case 'stack':
        if (p.tx === null) {
          const can = this.canStack(p);
          if (a.stacksLeft > 0 && can.ok) {
            this.stack(p);
            a.stacksLeft--;
          } else if (a.stacksLeft <= 0 || (!can.ok && p.stackLeft <= 0)) {
            a.mode = 'idle';
            a.until = this.time + 2 + this.rng() * 3;
          }
        }
        break;
      case 'idle':
        if (this.time >= a.until) this.chooseNext(p);
        break;
    }
  }

  private chooseNext(p: Person) {
    const a = p.ai!;
    const r = this.rng();
    if (this.moment.lowActive && this.moment.low > 0.9 && r < 0.3) {
      a.mode = 'walk';
      this.walkTo(p, ISLAND.x + (this.rng() - 0.5) * 90, ISLAND.y + 30 + this.rng() * 40);
    } else if (r < 0.45) {
      a.mode = 'walk';
      this.walkTo(p, clamp(a.homeX + (this.rng() - 0.5) * 440, 30, WORLD_W - 30), 190 + this.rng() * 240);
    } else if (r < 0.72) {
      a.mode = 'sit';
      p.tx = p.ty = null;
      p.sitting = true;
      a.until = this.time + 20 + this.rng() * 30;
    } else {
      const near = this.nearestSpot(p.x, p.y);
      if (!near || near.dist > 240) {
        a.mode = 'idle';
        a.until = this.time + 2;
        return;
      }
      a.mode = 'stack';
      a.stacksLeft = 1 + Math.floor(this.rng() * 3);
      const side = p.x < near.spot.x ? -1 : 1;
      this.walkTo(p, near.spot.x + side * STAND_ASIDE, near.spot.y + 4);
    }
  }
}
