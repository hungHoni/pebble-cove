import { describe, expect, it } from 'vitest';
import { gustStart, lowStart, makeTimetable, momentAt, postcardAt, waterOffset } from '../src/sim/timetable';

describe('timetable', () => {
  for (const tideLen of [900, 60]) {
    const tt = makeTimetable(12, tideLen);

    it(`counts down to the next tide (${tideLen}s)`, () => {
      const a = momentAt(tt, 1000);
      const b = momentAt(tt, 1001);
      if (b.cycle === a.cycle) expect(b.toNextTide).toBeCloseTo(a.toNextTide - 1, 5);
    });

    it(`has exactly one great low tide in every four tides (${tideLen}s)`, () => {
      for (let group = 0; group < 25; group++) {
        let count = 0;
        for (let c = group * 4; c < group * 4 + 4; c++) if (lowStart(tt, c) !== null) count++;
        expect(count).toBe(1);
      }
    });

    it(`never lets the gust, low tide, postcard and rise overlap (${tideLen}s)`, () => {
      for (let c = 0; c < 40; c++) {
        const g = gustStart(tt, c);
        expect(g).toBeGreaterThanOrEqual(tt.surge);
        const ls = lowStart(tt, c);
        if (ls !== null) {
          expect(g + tt.gustLen).toBeLessThan(ls);
          expect(ls + tt.lowLen).toBeLessThan(postcardAt(tt));
        }
        expect(postcardAt(tt)).toBeLessThan(tt.tideLen - tt.rise);
      }
    });

    it(`keeps the water line continuous across the tide (${tideLen}s)`, () => {
      const start = 50 * tideLen - tt.offset;
      const before = waterOffset(momentAt(tt, start - 0.001));
      const after = waterOffset(momentAt(tt, start + 0.001));
      expect(Math.abs(before - after)).toBeLessThan(0.5);
    });
  }
});
