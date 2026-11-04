import { ISLAND, STACK_R, WORLD_H, WORLD_W } from './sim/constants';
import type { World, WorldEvent } from './sim/world';
import type { Screen } from './ui';

// The play-test robot's hook (see ../playtest-harness/PLAN.md). It only exists
// when the address ends in #bot, so normal play is unchanged.

export interface BotDeps {
  world: World;
  screen(): Screen;
  texts(): Record<string, string>;
  act: Record<string, () => void>;
  /** Runs one frame now. Hidden tabs get no animation frames, so automation can drive the game itself. */
  pump(): void;
}

export interface BotHook {
  onEvent(e: WorldEvent): void;
  frame(ms: number): void;
}

const push = <T>(ring: T[], item: T, max = 60) => {
  ring.push(item);
  if (ring.length > max) ring.splice(0, ring.length - max);
};

export function installBot(deps: BotDeps): BotHook | null {
  if (!location.hash.includes('bot')) return null;
  const { world } = deps;
  const events: WorldEvent[] = [];
  const errors: string[] = [];
  const frames: number[] = [];
  window.addEventListener('error', (e) => push(errors, String(e.message)));
  window.addEventListener('unhandledrejection', (e) => push(errors, String(e.reason)));

  const me = () => world.me;
  const walk = (dx: number, dy: number) => () =>
    world.walkTo(me(), Math.max(20, Math.min(WORLD_W - 20, me().x + dx)), Math.max(0, Math.min(WORLD_H - 20, me().y + dy)));
  const spotToVisit = () => {
    let best = null as { x: number; y: number; d: number } | null;
    for (const s of world.spots) {
      if (!world.spotOpen(s) || (world.cairns.get(s.id)?.stones.length ?? 0) >= 8) continue;
      const d = Math.hypot(s.x - me().x, s.y - me().y);
      if (d > STACK_R * 0.6 && (!best || d < best.d)) best = { x: s.x, y: s.y, d };
    }
    return best;
  };

  const moves: Record<string, () => void> = {
    walk_left: walk(-120, 0),
    walk_right: walk(120, 0),
    walk_up: walk(0, -70),
    walk_down: walk(0, 70),
    walk_to_spot: () => {
      const s = spotToVisit();
      if (s) world.walkTo(me(), s.x, s.y);
    },
    walk_to_hat: () => world.walkTo(me(), me().hat.x, me().hat.y),
    walk_to_island: () => world.walkTo(me(), ISLAND.x, ISLAND.y + 40),
    wait_short: () => {},
    wait_long: () => {},
  };

  const legal = (): string[] => {
    const s = deps.screen();
    if (s === 'picker') return [...Array.from({ length: 7 }, (_, i) => `pick_color_${i}`), ...Array.from({ length: 4 }, (_, i) => `pick_hat_${i}`), 'start'];
    if (s === 'album') return ['close_album'];
    const p = me();
    const out: string[] = [];
    if (world.canWave(p)) out.push('wave');
    if (world.canSit(p)) out.push(p.sitting ? 'stand' : 'sit');
    if (world.canStack(p).ok) out.push('stack');
    if (!p.floating) {
      if (spotToVisit()) out.push('walk_to_spot');
      out.push('walk_left', 'walk_right', 'walk_up', 'walk_down');
      if (p.hat.state === 'ground') out.push('walk_to_hat');
      if (world.moment.lowActive && world.moment.low > 0.9) out.push('walk_to_island');
    }
    out.push('open_album', 'toggle_sound', 'change_look', 'wait_short', 'wait_long');
    return out;
  };

  const buttons = () =>
    [...document.querySelectorAll<HTMLElement>('[data-bot]')]
      .filter((el) => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden')
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.dataset.bot!,
          label: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' '),
          box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        };
      });

  const snapshot = () => {
    const m = world.moment;
    const sorted = [...frames].sort((a, b) => a - b);
    const out = {
      state: deps.screen(),
      text: deps.texts(),
      tide: { toNextTide: Math.round(m.toNextTide), rising: m.rising > 0, surge: m.surge >= 0, lowTide: m.lowActive, gust: !!m.gust },
      me: { x: Math.round(me().x), y: Math.round(me().y), sitting: me().sitting, floating: me().floating, hat: me().hat.state, stones: world.myStones },
      cairns: [...world.cairns.values()].map((c) => ({ id: c.id, stones: c.stones.length })),
      buttons: buttons(),
      legal: legal(),
      events: events.splice(0),
      errors: errors.splice(0),
      frames: {
        count: frames.length,
        avgMs: frames.length ? +(frames.reduce((a, b) => a + b, 0) / frames.length).toFixed(1) : 0,
        p95Ms: sorted.length ? +sorted[Math.floor(sorted.length * 0.95)].toFixed(1) : 0,
        over50ms: frames.filter((f) => f > 50).length,
      },
    };
    return out;
  };

  const act = (id: string): boolean => {
    if (!legal().includes(id)) return false;
    const fn = moves[id] ?? deps.act[id];
    if (!fn) return false;
    fn();
    return true;
  };

  /** Runs frames for `ms` of real time, about 30 a second. */
  const run = (ms: number) => {
    const end = performance.now() + ms;
    let next = 0;
    while (performance.now() < end) {
      if (performance.now() >= next) {
        deps.pump();
        next = performance.now() + 33;
      }
    }
  };

  (window as unknown as { __game: unknown }).__game = { snapshot, legal, act, pump: deps.pump, run };
  return { onEvent: (e) => push(events, e), frame: (ms) => push(frames, ms, 300) };
}
