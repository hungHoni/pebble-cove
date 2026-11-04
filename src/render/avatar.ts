import { Container, Graphics, Text } from 'pixi.js';
import type { Person } from '../sim/world';
import { BODY, HAT, INK, K, SHADOW, drawHat, sheetEllipse } from './paper';

export class AvatarView {
  readonly root = new Container();
  private readonly figure = new Container();
  private readonly shadow = new Graphics();
  private readonly ring = new Graphics();
  private readonly foam = new Graphics();
  private readonly body = new Graphics();
  private readonly arm = new Graphics();
  private readonly marks = new Graphics();
  private readonly hat = new Graphics();
  private readonly label: Container | null = null;
  private key = '';

  constructor(p: Person, me: boolean) {
    this.root.scale.set(K);
    this.shadow.ellipse(0, 0, 9, 3).fill({ color: 0x5a411e, alpha: 0.25 });
    this.foam.ellipse(0, 0, 12, 3.6).stroke({ width: 1.2, color: 0xffffff, alpha: 0.9 });
    if (me) {
      for (let i = 0; i < 14; i += 2) {
        const a0 = (i / 14) * Math.PI * 2;
        const a1 = ((i + 1) / 14) * Math.PI * 2;
        this.ring.moveTo(Math.cos(a0) * 13, Math.sin(a0) * 4.5);
        for (let k = 1; k <= 4; k++) {
          const a = a0 + ((a1 - a0) * k) / 4;
          this.ring.lineTo(Math.cos(a) * 13, Math.sin(a) * 4.5);
        }
      }
      this.ring.stroke({ width: 1.1, color: 0xffffff, alpha: 0.95 });
      const label = new Container();
      const text = new Text({ text: 'you', style: { fontFamily: 'Fredoka, system-ui, sans-serif', fontSize: 7.5, fontWeight: '600', fill: 0xffffff }, resolution: 6 });
      text.anchor.set(0.5);
      const w = text.width + 7;
      label.addChild(new Graphics().roundRect(-w / 2, -4.5, w, 9, 4.5).fill({ color: 0x16252c, alpha: 0.8 }), text);
      label.y = 9.5;
      this.label = label;
    }
    this.figure.addChild(this.arm, this.body, this.hat, this.marks);
    this.root.addChild(this.shadow, this.ring, this.foam, this.figure);
    if (this.label) this.root.addChild(this.label);
  }

  update(p: Person, t: number) {
    const sit = p.sitting;
    const rx = 8;
    const ry = sit ? 7 : 10;
    const by = sit ? -7 : -11;
    const holding = p.stackLeft > 0.45;
    const key = `${sit}|${holding}|${p.color}|${p.hatStyle}`;
    if (key !== this.key) {
      this.key = key;
      const c = BODY[p.color];
      this.body.clear();
      sheetEllipse(this.body, 0, by, rx, ry, c);
      this.body.ellipse(1.5, by + 3, rx * 0.5, ry * 0.45).fill({ color: 0xffffff, alpha: 0.2 });
      if (sit) {
        for (const dx of [-2.8, 2.8]) {
          this.body.moveTo(dx - 1.3, by - 1.4).arc(dx, by - 1.6, 1.3, 0.15 * Math.PI, 0.85 * Math.PI).stroke({ width: 0.9, color: INK, cap: 'round' });
        }
      } else {
        this.body.circle(-2.8, by - 1.5, 1.1).fill(INK);
        this.body.circle(2.8, by - 1.5, 1.1).fill(INK);
      }
      this.body.circle(-4.8, by + 1.4, 1.3).fill({ color: 0xe86e6e, alpha: 0.45 });
      this.body.circle(4.8, by + 1.4, 1.3).fill({ color: 0xe86e6e, alpha: 0.45 });
      if (holding) sheetEllipse(this.body, rx + 2.5, by + 1, 3.4, 2.3, 0x9aa3a6);
      this.arm.clear();
      sheetEllipse(this.arm, 0, -4, 2.3, 4.2, c);
      this.hat.clear();
      drawHat(this.hat, p.hatStyle, HAT[p.color]);
      this.marks.clear();
      for (const r of [4, 7]) {
        this.marks.moveTo(Math.cos(-1.3) * r, Math.sin(-1.3) * r).arc(0, 0, r, -1.3, -0.3).stroke({ width: 1.1, color: 0xffffff, alpha: 0.9, cap: 'round' });
      }
    }
    this.hat.visible = p.hat.state === 'on';
    this.hat.y = by - ry + 3;
    const waving = p.waveLeft > 0;
    this.arm.visible = waving;
    this.marks.visible = waving;
    if (waving) {
      this.arm.position.set(rx - 1, by - ry + 4);
      this.arm.rotation = 0.45 + Math.sin(t * 12) * 0.4;
      this.marks.position.set(rx + 1, by - ry + 1);
      this.marks.alpha = 0.6 + 0.4 * Math.sin(t * 12);
    }
    this.figure.scale.x = p.facing;
    this.foam.visible = p.floating;
    this.ring.visible = !p.floating;
    this.shadow.visible = !p.floating;
    let bob = 0;
    if (p.moving) bob = -Math.abs(Math.sin(t * 9)) * 1.4 * K;
    if (p.floating) bob = Math.sin(t * 3) * 1.5 * K;
    this.root.position.set(p.x, p.y + bob);
    this.root.zIndex = p.y;
  }
}

export class LooseHatView {
  readonly root = new Container();
  private readonly shadow = new Graphics();
  private readonly hat = new Graphics();
  private readonly foam = new Graphics();
  private key = '';

  constructor() {
    this.root.scale.set(K);
    this.shadow.ellipse(0, 0, 7, 2.2).fill(SHADOW);
    this.foam.ellipse(0, 1, 10, 3).stroke({ width: 1.1, color: 0xffffff, alpha: 0.85 });
    this.root.addChild(this.shadow, this.foam, this.hat);
  }

  update(p: Person, t: number) {
    const key = `${p.hatStyle}|${p.color}`;
    if (key !== this.key) {
      this.key = key;
      this.hat.clear();
      drawHat(this.hat, p.hatStyle, HAT[p.color]);
    }
    const h = p.hat;
    this.root.visible = h.state !== 'on';
    if (!this.root.visible) return;
    this.root.position.set(h.x, h.y);
    this.root.zIndex = h.state === 'flying' ? 10_000 : h.y;
    const bob = h.state === 'floating' ? Math.sin(t * 3 + p.id) * 1.2 : 0;
    this.hat.position.set(0, -h.z / K + bob);
    this.hat.rotation = h.state === 'flying' ? h.spin : 0;
    this.shadow.visible = h.state === 'flying';
    this.shadow.alpha = 0.6 - Math.min(0.4, h.z / 120);
    this.foam.visible = h.state === 'floating';
  }
}
