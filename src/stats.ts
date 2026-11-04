// ?stats shows the frame rate on screen, so it can be checked on a phone without
// developer tools. Normal play is unchanged.

export interface StatsHook {
  frame(ms: number): void;
}

export function installStats(enabled: boolean, resolution: number): StatsHook | null {
  if (!enabled) return null;
  const el = document.createElement('div');
  el.id = 'stats';
  document.body.appendChild(el);
  const start = performance.now();
  let since = start;
  let count = 0;
  let worst = 0;
  let slow = 0;
  return {
    frame(ms) {
      const now = performance.now();
      count++;
      worst = Math.max(worst, ms);
      // The first seconds include loading, so slow frames only count after that.
      if (ms > 50 && now - start > 3000) slow++;
      if (now - since < 1000) return;
      const fps = Math.round((count * 1000) / (now - since));
      el.textContent = `${fps} fps · slowest ${Math.round(worst)} ms\nslow frames: ${slow} · ${innerWidth}×${innerHeight} at ${resolution}×`;
      since = now;
      count = 0;
      worst = 0;
    },
  };
}
