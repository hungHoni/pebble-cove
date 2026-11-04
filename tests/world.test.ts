import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { MAX_STONES } from '../src/sim/constants';

const make = (tideLen = 900) =>
  new World({ seed: 12, tideLen, startTime: 1_800_000_000, me: { color: 2, hat: 0 }, residents: 0 });

const run = (w: World, seconds: number, dt = 1 / 30) => {
  for (let t = 0; t < seconds; t += dt) w.step(dt);
};

const standAtSpot = (w: World) => {
  const s = w.spots.find((sp) => !sp.sandbar && w.spotOpen(sp))!;
  w.me.x = s.x + 10;
  w.me.y = s.y;
  return s;
};

describe('stacking', () => {
  it('needs a ring of pebbles nearby', () => {
    const w = make();
    w.me.x = 800;
    w.me.y = 440;
    const far = w.nearestSpot(w.me.x, w.me.y)!;
    if (far.dist > 30) expect(w.canStack(w.me).ok).toBe(false);
    standAtSpot(w);
    expect(w.canStack(w.me).ok).toBe(true);
  });

  it('adds a stone, counts it and stops at the height limit', () => {
    const w = make();
    const s = standAtSpot(w);
    for (let i = 0; i < MAX_STONES + 3; i++) {
      w.stack(w.me);
      run(w, 1);
    }
    expect(w.cairns.get(s.id)!.stones.length).toBe(MAX_STONES);
    expect(w.myStones).toBe(MAX_STONES);
    expect(w.canStack(w.me).reason).toMatch(/tall/);
  });

  it('lets the tide wash every cairn away', () => {
    const w = make();
    standAtSpot(w);
    w.stack(w.me);
    w.jumpTo('surge');
    run(w, 3 + w.tt.surge * 0.6);
    expect(w.cairns.size).toBe(0);
    expect(w.drainEvents().some((e) => e.type === 'wash')).toBe(true);
  });
});

describe('hats in the wind', () => {
  it('blows hats off, and only the owner can pick one up', () => {
    const w = new World({ seed: 12, tideLen: 900, startTime: 1_800_000_000, me: { color: 2, hat: 0 }, residents: 1 });
    const other = w.people[1];
    other.ai = null;
    other.x = w.me.x + 40;
    other.y = w.me.y;
    w.jumpTo('gust');
    run(w, 3.2);
    expect(w.me.hat.state).toBe('flying');
    run(w, 8);
    expect(['ground', 'floating']).toContain(other.hat.state);
    // Standing on someone else's hat leaves it where it is.
    w.me.x = other.hat.x;
    w.me.y = other.hat.y;
    run(w, 0.5);
    expect(other.hat.state).not.toBe('on');
  });
});

describe('the clock', () => {
  it('keeps the tide on the real clock even at a low frame rate', () => {
    const w = make();
    const start = w.time;
    for (let i = 1; i <= 10; i++) w.advanceTo(start + i);
    expect(w.time).toBeCloseTo(start + 10, 5);
  });

  it('washes the cairns when a tide passes while the phone is locked', () => {
    const w = make();
    standAtSpot(w);
    w.stack(w.me);
    w.advanceTo(w.time + w.tt.tideLen + 5);
    expect(w.cairns.size).toBe(0);
  });
});

describe('the water', () => {
  it('floats a player back to shore', () => {
    const w = make();
    w.me.y = w.waterline(w.me.x) - 5;
    w.me.x = 300;
    run(w, 4);
    expect(w.me.floating).toBe(false);
    expect(w.me.y).toBeGreaterThan(w.waterline(w.me.x) + 8);
  });

  it('opens the sandbar to the island at low tide', () => {
    const w = make();
    expect(w.walkable(800, 60)).toBe(false);
    w.jumpTo('low');
    run(w, 3 + w.tt.lowLen * 0.5);
    expect(w.moment.lowActive).toBe(true);
    expect(w.walkable(800, 60)).toBe(true);
  });
});
