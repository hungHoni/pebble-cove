import type { World } from './sim/world';
import type { Postcard } from './postcard';
import { BODY, COLOR_NAMES, HAT_NAMES } from './render/paper';

export type Screen = 'picker' | 'beach' | 'album';

export interface UiHandlers {
  wave(): void;
  sit(): void;
  stack(): void;
  toggleSound(): void;
  openAlbum(): void;
  closeAlbum(): void;
  pickColor(i: number): void;
  pickHat(i: number): void;
  start(): void;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export const formatTime = (s: number): string => {
  const v = Math.max(0, Math.ceil(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

export class UI {
  private toastTimer = 0;
  private shown: Record<string, string> = {};

  constructor(h: UiHandlers, color: number, hat: number) {
    const swatches = $('swatches');
    COLOR_NAMES.forEach((name, i) => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.type = 'button';
      b.dataset.bot = `pick_color_${i}`;
      b.setAttribute('aria-label', name);
      b.style.background = hex(BODY[i]);
      b.addEventListener('click', () => h.pickColor(i));
      swatches.appendChild(b);
    });
    const hats = $('hats');
    HAT_NAMES.forEach((name, i) => {
      const b = document.createElement('button');
      b.className = 'hat-choice';
      b.type = 'button';
      b.dataset.bot = `pick_hat_${i}`;
      b.textContent = name;
      b.addEventListener('click', () => h.pickHat(i));
      hats.appendChild(b);
    });
    $('btn-wave').addEventListener('click', () => h.wave());
    $('btn-sit').addEventListener('click', () => h.sit());
    $('btn-stack').addEventListener('click', () => h.stack());
    $('btn-sound').addEventListener('click', () => h.toggleSound());
    $('btn-album').addEventListener('click', () => h.openAlbum());
    $('btn-album-close').addEventListener('click', () => h.closeAlbum());
    $('btn-start').addEventListener('click', () => h.start());
    this.markColor(color);
    this.markHat(hat);
  }

  markColor(i: number) {
    $('swatches').querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
  }

  markHat(i: number) {
    $('hats').querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
  }

  show(screen: Screen) {
    $('picker').hidden = screen !== 'picker';
    $('album').hidden = screen !== 'album';
    document.body.classList.toggle('sheet-open', screen !== 'beach');
  }

  renderAlbum(cards: Postcard[]) {
    const grid = $('album-grid');
    grid.replaceChildren(
      ...cards.map((c) => {
        const f = document.createElement('figure');
        const img = document.createElement('img');
        img.src = c.img;
        img.alt = 'Postcard of the beach just before the tide';
        const cap = document.createElement('figcaption');
        cap.textContent = new Date(c.t).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        f.append(img, cap);
        return f;
      }),
    );
    $('album-empty').hidden = cards.length > 0;
  }

  toast(text: string, ms = 3600) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('show'), ms);
  }

  get toastText(): string {
    const el = $('toast');
    return el.classList.contains('show') ? (el.textContent ?? '') : '';
  }

  setMuted(m: boolean) {
    const b = $('btn-sound');
    b.classList.toggle('muted', m);
    b.setAttribute('aria-label', m ? 'Turn sound on' : 'Turn sound off');
  }

  private set(id: string, text: string) {
    if (this.shown[id] === text) return;
    this.shown[id] = text;
    $(id).textContent = text;
  }

  update(w: World) {
    const m = w.moment;
    this.set('stones', String(w.myStones));
    this.set('tide-time', m.surge >= 0 ? 'the tide is here' : `tide in ${formatTime(m.toNextTide)}`);
    this.set('cove-pill', m.lowActive ? 'Low tide · the sandbar is open' : 'Practice cove · you and 7 residents');
    this.set('sit-label', w.me.sitting ? 'Stand' : 'Sit');
    // Buttons stay tappable when they can't act, so a tap can explain why.
    $('btn-stack').classList.toggle('off', !w.canStack(w.me).ok);
    $('btn-wave').classList.toggle('off', !w.canWave(w.me));
  }
}
