import { Graphics } from 'pixi.js';
import type { Cairn } from '../sim/world';
import { BODY, K, STONE, blend, sheetEllipse } from './paper';

export class CairnView {
  readonly g = new Graphics();
  private count = -1;

  constructor(c: Cairn) {
    this.g.scale.set(K);
    this.g.position.set(c.x, c.y);
    this.g.zIndex = c.y;
  }

  update(c: Cairn, time: number) {
    if (c.stones.length !== this.count) {
      this.count = c.stones.length;
      this.g.clear();
      this.g.ellipse(0, 0, 9, 3).fill({ color: 0x5a411e, alpha: 0.25 });
      let y = 0;
      let w = 13;
      c.stones.forEach((s, i) => {
        const h = w * 0.46;
        const x = i % 2 ? 1.2 : i ? -1 : 0;
        // Each stone keeps a hint of its builder's color.
        const color = blend(STONE[(i + c.id) % STONE.length], BODY[s.color], 0.32);
        sheetEllipse(this.g, x, y - h / 2, w / 2, h / 2, color);
        this.g.ellipse(x - w * 0.15, y - h * 0.68, w * 0.2, h * 0.15).fill({ color: 0xffffff, alpha: 0.25 });
        y -= h * 0.9;
        w *= 0.84;
      });
    }
    if (c.washedAt !== null) {
      const k = Math.min(1, (time - c.washedAt) / 1.6);
      this.g.alpha = 1 - k;
      this.g.y = c.y - k * 20;
      this.g.rotation = k * 0.35;
    }
  }
}
