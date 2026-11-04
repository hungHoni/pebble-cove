import { Graphics } from 'pixi.js';
import { ISLAND, SHORE_Y, WORLD_H, WORLD_W } from '../sim/constants';
import { mulberry32 } from '../sim/rng';
import { surgeFrontY, waterOffset } from '../sim/timetable';
import { sandbarDip, shoreShape, type World } from '../sim/world';
import { FOAM, K, SAND, SHADOW, WATER, WET_SAND, sheetEllipse, sheetPoly } from './paper';

// Water sheets lie on top of the sand, so every shadow falls down the beach.
const LAYERS: [number, number][] = [
  [14, WET_SAND],
  [0, FOAM],
  [-6, WATER[0]],
  [-16, WATER[1]],
  [-30, WATER[2]],
];

export class Beach {
  readonly sand = new Graphics();
  readonly water = new Graphics();
  readonly island = new Graphics();
  readonly surge = new Graphics();
  readonly highlight = new Graphics();

  constructor(world: World) {
    this.drawSand(world);
    this.drawIsland();
    this.highlight.ellipse(0, 0, 15, 5.5).stroke({ width: 1.4, color: 0xffffff, alpha: 0.9 });
    this.highlight.scale.set(K);
    this.highlight.visible = false;
  }

  private drawSand(world: World) {
    const g = this.sand;
    const r = mulberry32(7);
    g.rect(-400, -300, WORLD_W + 800, WORLD_H + 600).fill(SAND);
    for (let i = 0; i < 900; i++) {
      g.ellipse(-100 + r() * (WORLD_W + 200), r() * (WORLD_H + 60), 1.3, 0.85).fill({ color: 0x785a28, alpha: 0.16 });
    }
    // Tidepools, only uncovered by the great low tide.
    for (let i = 0; i < 14; i++) {
      const x = 420 + i * 58 + (r() - 0.5) * 30;
      const y = 62 + r() * 70;
      const rx = 14 + r() * 12;
      const ry = 5 + r() * 4;
      g.ellipse(x, y, rx + 3, ry + 2).fill(0xd2b98c);
      g.ellipse(x, y, rx, ry).fill(0x7cc3c1);
      g.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.35, ry * 0.25).fill({ color: 0xffffff, alpha: 0.35 });
      if (r() < 0.45) {
        g.circle(x + rx * 0.4, y + ry + 2.5, 1.6).fill(0xe0705a);
        g.circle(x + rx * 0.4 + 2.6, y + ry + 2.2, 1.1).fill(0xe0705a);
      }
    }
    // Rings of pebbles mark where a cairn can go.
    for (const s of world.spots) {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + s.id;
        g.ellipse(s.x + Math.cos(a) * 9 * K, s.y + Math.sin(a) * 3.4 * K, 1.5 * K, 1 * K).fill({ color: 0x9c865e, alpha: 0.75 });
      }
    }
  }

  private drawIsland() {
    const g = this.island;
    const { x, y, rx, ry } = ISLAND;
    sheetEllipse(g, x, y, rx, ry, 0xe8d2a6, 2, 3.5);
    g.ellipse(x, y + ry * 0.55, rx * 0.92, ry * 0.32).fill({ color: WET_SAND, alpha: 0.7 });
    sheetEllipse(g, x - 40, y + 2, 15, 10, 0x7e8a8c);
    g.ellipse(x - 44, y - 1, 8, 4.5).fill(0x9aa6a7);
    sheetEllipse(g, x + 46, y + 7, 10, 7, 0x8e989b);
    sheetPoly(g, [x + 3, y + 4, x + 9, y + 4, x + 13, y - 40, x + 9, y - 40], 0x8a6a4a);
    const leaf = (a: number, len: number, color: number) => {
      const cx = x + 11;
      const cy = y - 42;
      const ex = cx + Math.cos(a) * len;
      const ey = cy + Math.sin(a) * len * 0.6;
      const nx = -Math.sin(a) * 6;
      const ny = Math.cos(a) * 6 * 0.6;
      const mx = (cx + ex) / 2;
      const my = (cy + ey) / 2 - 4;
      sheetPoly(g, [cx, cy, mx + nx, my + ny, ex, ey, mx - nx, my - ny], color);
    };
    leaf(Math.PI + 0.5, 30, 0x5b8f5a);
    leaf(-0.4, 30, 0x5b8f5a);
    leaf(Math.PI - 0.2, 26, 0x6fa36b);
    leaf(0.2, 26, 0x6fa36b);
    leaf(-Math.PI / 2 - 0.2, 20, 0x7fb77e);
  }

  update(world: World, x0: number, x1: number, t: number) {
    const m = world.moment;
    const off = waterOffset(m);
    const step = 6;
    const xs: number[] = [];
    for (let x = Math.floor(x0 / step) * step - step; x <= x1 + step; x += step) xs.push(x);
    const base = (x: number) => SHORE_Y + shoreShape(x) + off + m.low * sandbarDip(x);

    const g = this.water;
    g.clear();
    LAYERS.forEach(([lo, color], i) => {
      const pts: number[] = [xs[0], -320];
      const shadow: number[] = [xs[0], -320];
      for (const x of xs) {
        const sway = lo <= 0 ? 2.2 * Math.sin(t * 1.1 + x / 26 + i * 1.7) : 1.2 * Math.sin(x / 23 + i);
        const y = base(x) + lo + sway;
        pts.push(x, y);
        shadow.push(x, y + 2.5);
      }
      pts.push(xs[xs.length - 1], -320);
      shadow.push(xs[xs.length - 1], -320);
      g.poly(shadow).fill(lo >= 0 ? { color: 0x6e4b19, alpha: 0.16 } : { color: 0x0c2d37, alpha: 0.2 });
      g.poly(pts).fill(color);
    });

    const s = this.surge;
    s.clear();
    if (m.surge >= 0) {
      const top: number[] = [];
      const front: number[] = [];
      const shade: number[] = [];
      for (const x of xs) {
        const b = base(x);
        const f = surgeFrontY(b, m, x);
        top.push(x, b);
        front.push(x, f);
        shade.push(x, f + 3);
      }
      const back = (arr: number[]) => {
        const out: number[] = [];
        for (let i = arr.length - 2; i >= 0; i -= 2) out.push(arr[i], arr[i + 1]);
        return out;
      };
      s.poly([...front, ...back(shade)]).fill(SHADOW);
      s.poly([...top, ...back(front)]).fill({ color: FOAM, alpha: 0.78 });
      s.moveTo(front[0], front[1]);
      for (let i = 2; i < front.length; i += 2) s.lineTo(front[i], front[i + 1]);
      s.stroke({ width: 1.6, color: 0xffffff, alpha: 0.95 });
    }
  }

  showHighlight(x: number | null, y = 0) {
    this.highlight.visible = x !== null;
    if (x !== null) this.highlight.position.set(x, y);
  }
}
