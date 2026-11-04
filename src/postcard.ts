export interface Postcard {
  t: number;
  img: string;
}

const ASPECT = 3 / 2;

/** Crops the frame around the player and frames it like a small paper postcard. */
export function composePostcard(src: HTMLCanvasElement, focusY: number, when: Date): string {
  let sw = src.width;
  let sh = sw / ASPECT;
  if (sh > src.height) {
    sh = src.height;
    sw = sh * ASPECT;
  }
  const sx = (src.width - sw) / 2;
  const sy = Math.max(0, Math.min(src.height - sh, focusY - sh * 0.6));
  const W = 520;
  const H = Math.round(W / ASPECT);
  const pad = 14;
  const c = document.createElement('canvas');
  c.width = W + pad * 2;
  c.height = H + pad * 2 + 30;
  const g = c.getContext('2d')!;
  g.fillStyle = '#FFFCF4';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, sx, sy, sw, sh, pad, pad, W, H);
  g.fillStyle = '#24353C';
  g.font = '600 16px Fredoka, system-ui, sans-serif';
  g.textBaseline = 'middle';
  g.fillText('Pebble Cove', pad, H + pad + 17);
  g.fillStyle = '#53636A';
  g.font = '500 13px Figtree, system-ui, sans-serif';
  g.textAlign = 'right';
  const label = when.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  g.fillText(label, c.width - pad, H + pad + 17);
  return c.toDataURL('image/jpeg', 0.72);
}
