import { Container, Graphics } from 'pixi.js';
import { STACK_R, WORLD_H, WORLD_W } from '../sim/constants';
import type { World } from '../sim/world';
import { AvatarView, LooseHatView } from './avatar';
import { Beach } from './beach';
import { CairnView } from './cairn';
import { sheetEllipse } from './paper';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class Scene {
  readonly root = new Container();
  readonly entities = new Container();
  readonly beach: Beach;
  scale = 1;
  viewW = 420;
  viewH = 450;
  cam = { x: 0, y: 0 };
  private camReady = false;
  private readonly avatars = new Map<number, AvatarView>();
  private readonly hats = new Map<number, LooseHatView>();
  private readonly cairns = new Map<number, CairnView>();

  constructor(stage: Container, world: World) {
    this.beach = new Beach(world);
    this.entities.sortableChildren = true;
    for (const k of world.rocks) {
      const g = new Graphics();
      sheetEllipse(g, 0, 0, k.r, k.r * 0.72, 0x7e8a8c, 1.6, 3);
      g.ellipse(-k.r * 0.25, -k.r * 0.22, k.r * 0.55, k.r * 0.35).fill(0x9aa6a7);
      g.position.set(k.x, k.y);
      g.zIndex = k.y;
      this.entities.addChild(g);
    }
    this.root.addChild(this.beach.sand, this.beach.water, this.beach.island, this.beach.highlight, this.entities, this.beach.surge);
    stage.addChild(this.root);
  }

  /**
   * Shows about 420 world units across, or the whole beach height, whichever is
   * larger on screen, but always at least 260 units of height, so a phone held
   * sideways still shows the sea above the player.
   */
  resize(w: number, h: number) {
    this.scale = Math.min(Math.max(w / 420, h / 450), h / 260);
    this.viewW = w / this.scale;
    this.viewH = h / this.scale;
  }

  /** `focus` pins the player at that fraction of the screen height, e.g. above an open sheet. */
  update(world: World, dt: number, t: number, focus: number | null = null) {
    const me = world.me;
    const tx = clamp(me.x - this.viewW / 2, 0, Math.max(0, WORLD_W - this.viewW));
    // Keep the sea in view, but never push the player off the bottom.
    const anchor = Math.min(me.y - this.viewH * 0.62, world.waterline(me.x) - this.viewH * 0.3);
    const want = focus !== null ? me.y - this.viewH * focus : Math.max(me.y - this.viewH * 0.7, anchor);
    const ty = clamp(want, -70, WORLD_H + 10 - this.viewH);
    if (!this.camReady) {
      this.cam.x = tx;
      this.cam.y = ty;
      this.camReady = true;
    } else {
      const k = Math.min(1, dt * 4);
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
    }
    this.root.scale.set(this.scale);
    this.root.position.set(-this.cam.x * this.scale, -this.cam.y * this.scale);

    for (const p of world.people) {
      let a = this.avatars.get(p.id);
      if (!a) {
        a = new AvatarView(p, p === me);
        this.avatars.set(p.id, a);
        this.entities.addChild(a.root);
      }
      a.update(p, t);
      let h = this.hats.get(p.id);
      if (!h) {
        h = new LooseHatView();
        this.hats.set(p.id, h);
        this.entities.addChild(h.root);
      }
      h.update(p, t);
    }

    const live = new Set<number>();
    for (const c of [...world.cairns.values(), ...world.washed]) {
      live.add(c.id);
      let v = this.cairns.get(c.id);
      if (!v) {
        v = new CairnView(c);
        this.cairns.set(c.id, v);
        this.entities.addChild(v.g);
      }
      v.update(c, world.time);
    }
    for (const [id, v] of this.cairns) {
      if (!live.has(id)) {
        v.g.destroy();
        this.cairns.delete(id);
      }
    }

    this.beach.update(world, this.cam.x - 10, this.cam.x + this.viewW + 10, t);
    const near = world.nearestSpot(me.x, me.y);
    this.beach.showHighlight(near && near.dist < STACK_R * 2 ? near.spot.x : null, near?.spot.y);
  }

  screenToWorld(px: number, py: number) {
    return { x: px / this.scale + this.cam.x, y: py / this.scale + this.cam.y };
  }

  worldToScreen(x: number, y: number) {
    return { x: (x - this.cam.x) * this.scale, y: (y - this.cam.y) * this.scale };
  }
}
