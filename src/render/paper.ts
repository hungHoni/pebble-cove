import type { Graphics } from 'pixi.js';

// Paper cut: every shape is a flat sheet with a soft shadow under it.

export const K = 1.7;

export const BODY = [0xe9785b, 0x5b8fd9, 0xf2b544, 0x7fb77e, 0xb48ad6, 0xe88fb0, 0x4fa3a0];
export const HAT = [0x2f4858, 0xf2d06b, 0x3a6ea5, 0xf4f1e6, 0x3f7f6b, 0x5b8fd9, 0xf6e3b4];
export const COLOR_NAMES = ['Coral', 'Sky', 'Sun', 'Moss', 'Lilac', 'Rose', 'Sea'];
export const HAT_NAMES = ['Beanie', 'Sun hat', 'Bucket hat', 'Cap'];
export const STONE = [0x8e989b, 0xb3b9ba, 0x7a8487, 0xa59e95];

export const SAND = 0xecd8b1;
export const WET_SAND = 0xd8bf94;
export const FOAM = 0xeef5ef;
export const WATER = [0x5eadb2, 0x3c90a0, 0x2c7486];
export const INK = 0x22303a;

export const SHADOW = { color: 0x281e0a, alpha: 0.22 };

export function blend(a: number, b: number, k: number): number {
  const ar = a >> 16, ag = (a >> 8) & 255, ab = a & 255;
  const br = b >> 16, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * k) << 16) | (Math.round(ag + (bg - ag) * k) << 8) | Math.round(ab + (bb - ab) * k);
}

export const darken = (c: number, k = 0.22) => blend(c, 0x000000, k);

export function sheetEllipse(g: Graphics, x: number, y: number, rx: number, ry: number, color: number, sx = 1.4, sy = 2.4) {
  g.ellipse(x + sx, y + sy, rx, ry).fill(SHADOW);
  g.ellipse(x, y, rx, ry).fill(color);
}

export function sheetPoly(g: Graphics, pts: number[], color: number, sx = 1.4, sy = 2.4) {
  g.poly(pts.map((v, i) => v + (i % 2 ? sy : sx))).fill(SHADOW);
  g.poly(pts).fill(color);
}

export function domePts(cx: number, cy: number, rx: number, ry: number, n = 14): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (Math.PI * i) / n;
    pts.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
  return pts;
}

/** Hats are drawn with (0, 0) where the hat meets the top of the head. */
export function drawHat(g: Graphics, style: number, color: number, rx = 8) {
  const trim = darken(color);
  switch (style) {
    case 1:
      sheetEllipse(g, 0, 0.4, rx * 1.4, 2.6, color);
      sheetPoly(g, domePts(0, 0, rx * 0.62, 4.8), color);
      g.rect(-rx * 0.62, -1.6, rx * 1.24, 1.3).fill(trim);
      break;
    case 2:
      sheetPoly(g, [-rx * 0.95, 0.9, rx * 0.95, 0.9, rx * 0.62, -5.2, -rx * 0.62, -5.2], color);
      g.ellipse(0, 0.9, rx * 1.02, 1.6).fill(trim);
      break;
    case 3:
      sheetPoly(g, domePts(0, 0, rx * 0.8, 4.6), color);
      sheetEllipse(g, rx * 0.9, 0.3, rx * 0.62, 1.7, trim);
      break;
    default:
      sheetPoly(g, domePts(0, 0, rx * 0.82, 4.4), color);
      g.circle(1.4, -2.4, 1.9).fill(SHADOW);
      g.circle(0, -4.8, 1.9).fill(color);
  }
}
