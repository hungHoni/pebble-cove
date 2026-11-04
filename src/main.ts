import { Application, Rectangle } from 'pixi.js';
import { Sound } from './audio';
import { installBot } from './bot';
import { composePostcard, type Postcard } from './postcard';
import { Scene } from './render/scene';
import { World, type WorldEvent } from './sim/world';
import { installStats } from './stats';
import { store } from './storage';
import { UI, type Screen } from './ui';

const params = new URLSearchParams(location.search);
// A claude.ai link passes only a plain #anchor, so the switches also work there
// as words joined by dots, e.g. #tide-60.stats.
for (const word of location.hash.slice(1).split('.')) {
  const [key, value = ''] = word.split('-');
  if (key && !params.has(key)) params.set(key, value);
}
// ?tide=60 makes each tide one minute long for testing; ?skip=rise|surge|low|gust jumps close to an event.
const tideLen = Math.max(30, Math.min(3600, Number(params.get('tide')) || 900));
const COVE_SEED = 12;

async function boot() {
  const saved = store.get<{ color: number; hat: number } | null>('me', null);
  const world = new World({ seed: COVE_SEED, tideLen, startTime: Date.now() / 1000, me: saved ?? { color: 2, hat: 0 }, residents: 7 });
  world.myStones = store.get('stones', 0);
  world.setLook(world.me.color, world.me.hatStyle);
  const skip = params.get('skip');
  if (skip === 'rise' || skip === 'surge' || skip === 'low' || skip === 'gust') world.jumpTo(skip);
  // The world runs on the real clock; ?skip moves it by a fixed offset.
  const clockOffset = world.time - Date.now() / 1000;

  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);

  const stageEl = document.getElementById('stage')!;
  const app = new Application();
  await app.init({
    resizeTo: stageEl,
    antialias: true,
    background: 0xecd8b1,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    preference: 'webgl',
  });
  stageEl.appendChild(app.canvas);
  const scene = new Scene(app.stage, world);
  const sound = new Sound(store.get('muted', false));
  let album = store.get<Postcard[]>('album', []);
  let screen: Screen = saved ? 'beach' : 'picker';
  const touch = matchMedia('(pointer: coarse)').matches;
  const me = world.me;

  const handlers = {
    wave: () => {
      sound.unlock();
      world.wave(me);
    },
    sit: () => {
      sound.unlock();
      world.toggleSit(me);
    },
    stack: () => {
      sound.unlock();
      const r = world.canStack(me);
      if (!r.ok) ui.toast(r.reason ?? 'You can’t stack here', 2400);
      else world.stack(me);
    },
    toggleSound: () => {
      sound.unlock();
      sound.setMuted(!sound.muted);
      store.set('muted', sound.muted);
      ui.setMuted(sound.muted);
    },
    openAlbum: () => {
      ui.renderAlbum(album);
      setScreen('album');
    },
    closeAlbum: () => setScreen('beach'),
    pickColor: (i: number) => {
      world.setLook(i, me.hatStyle);
      ui.markColor(i);
    },
    pickHat: (i: number) => {
      world.setLook(me.color, i);
      ui.markHat(i);
    },
    start: () => {
      sound.unlock();
      store.set('me', { color: me.color, hat: me.hatStyle });
      setScreen('beach');
      if (!store.get('seen', false)) {
        store.set('seen', true);
        ui.toast(touch ? 'Tap the sand to walk. Wave, Sit and Stack are below.' : 'Walk with WASD or the arrow keys, or click the sand. Press 1, 2 or 3.', 6000);
      }
    },
  };
  const ui = new UI(handlers, me.color, me.hatStyle);
  ui.setMuted(sound.muted);
  const setScreen = (s: Screen) => {
    screen = s;
    ui.show(s);
  };
  setScreen(screen);

  const stats = installStats(params.has('stats'), app.renderer.resolution);
  const bot = installBot({
    world,
    pump: () => app.ticker.update(),
    screen: () => screen,
    texts: () => ({
      toast: ui.toastText,
      tide: document.getElementById('tide-time')?.textContent ?? '',
      cove: document.getElementById('cove-pill')?.textContent ?? '',
    }),
    act: {
      wave: handlers.wave,
      sit: handlers.sit,
      stand: handlers.sit,
      stack: handlers.stack,
      open_album: handlers.openAlbum,
      close_album: handlers.closeAlbum,
      toggle_sound: handlers.toggleSound,
      change_look: () => setScreen('picker'),
      start: handlers.start,
      ...Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`pick_color_${i}`, () => handlers.pickColor(i)])),
      ...Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`pick_hat_${i}`, () => handlers.pickHat(i)])),
    },
  });

  // ---- input -------------------------------------------------------------
  const keys = new Set<string>();
  const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  const updateDir = () => {
    world.keyDir.x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    world.keyDir.y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  };
  window.addEventListener('keydown', (e) => {
    if (screen !== 'beach' || e.metaKey || e.ctrlKey || e.altKey) return;
    sound.unlock();
    const k = e.key.toLowerCase();
    if (MOVE_KEYS.includes(k)) {
      keys.add(k);
      e.preventDefault();
    } else if (!e.repeat) {
      if (k === '1') handlers.wave();
      if (k === '2') handlers.sit();
      if (k === '3') handlers.stack();
      if (k === 'm') handlers.toggleSound();
    }
    updateDir();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.key.toLowerCase());
    updateDir();
  });
  window.addEventListener('blur', () => {
    keys.clear();
    updateDir();
  });
  // iPhone Safari only lets the end of a touch start sound, not its start.
  for (const type of ['pointerdown', 'pointerup', 'touchend']) window.addEventListener(type, () => sound.unlock(), { capture: true, passive: true });

  let down: { x: number; y: number; t: number } | null = null;
  app.canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  app.canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14 || performance.now() - down.t > 700) return;
    down = null;
    if (screen === 'album') return setScreen('beach');
    const rect = app.canvas.getBoundingClientRect();
    const p = scene.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    if (Math.hypot(p.x - me.x, p.y - (me.y - 16)) < 18) return setScreen('picker');
    if (screen !== 'beach') return;
    const h = me.hat;
    if (h.state === 'ground' && Math.hypot(p.x - h.x, p.y - h.y) < 26) world.walkTo(me, h.x, h.y);
    else world.walkTo(me, p.x, p.y + 4);
  });

  // ---- events --------------------------------------------------------------
  const takePostcard = () => {
    try {
      const frame = new Rectangle(0, 0, app.screen.width, app.screen.height);
      const src = app.renderer.extract.canvas({ target: app.stage, frame, resolution: 1 }) as HTMLCanvasElement;
      const focus = scene.worldToScreen(me.x, me.y).y;
      album.unshift({ t: Date.now(), img: composePostcard(src, focus, new Date()) });
      album = album.slice(0, 12);
      while (!store.set('album', album) && album.length > 1) album.pop();
      ui.renderAlbum(album);
      ui.toast('Postcard saved to your album');
    } catch (err) {
      console.error(err);
    }
  };

  const handle = (e: WorldEvent) => {
    bot?.onEvent(e);
    const mine = e.by === me.id;
    switch (e.type) {
      case 'stack':
        sound.note((e.height as number) - 1 + ((e.spot as number) % 3), 0, mine ? 0.22 : 0.12);
        if (mine) store.set('stones', world.myStones);
        break;
      case 'postcard':
        takePostcard();
        break;
      case 'tide-rising':
        sound.chime();
        ui.toast('The tide is coming in');
        break;
      case 'surge': {
        sound.whoosh(4, 0.2);
        // The tide plays every cairn one last time, low to high.
        (e.heights as number[]).forEach((h, i) => sound.note(h - 1, 0.4 + i * 0.14, 0.13));
        ui.toast('The tide washes every cairn away. Fresh sand.');
        break;
      }
      case 'low-start':
        sound.chime();
        ui.toast('Low tide. Walk out to the island before the water comes back.', 5000);
        break;
      case 'low-ending':
        ui.toast('The water is coming back');
        break;
      case 'gust':
        sound.whoosh(3, 0.1);
        if ((e.blown as number[]).includes(me.id)) ui.toast('Your hat blew away. Walk over to pick it up.', 5000);
        break;
      case 'hat-landed':
        if (mine && e.water) ui.toast('Your hat landed in the water. The next wave will bring it back.', 4500);
        break;
      case 'hat-picked':
        if (mine) ui.toast('Hat back on', 1800);
        break;
      case 'floated':
        if (mine) ui.toast('The water floated you back to shore', 3000);
        break;
    }
  };

  // ---- loop ------------------------------------------------------------------
  app.ticker.add((tk) => {
    const dt = Math.min(0.1, tk.deltaMS / 1000);
    world.advanceTo(Date.now() / 1000 + clockOffset);
    scene.resize(app.screen.width, app.screen.height);
    scene.update(world, dt, performance.now() / 1000, screen === 'beach' ? null : 0.3);
    sound.update(dt, world.moment);
    for (const e of world.drainEvents()) handle(e);
    ui.update(world);
    bot?.frame(tk.deltaMS);
    stats?.frame(tk.deltaMS);
  });
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<p style="position:fixed;inset:auto 16px 16px;background:#fff;padding:12px;border-radius:12px;font:15px system-ui">Pebble Cove couldn’t start: ${String(err)}</p>`);
});
