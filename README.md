# Pebble Cove

A calm place to take a break, or to keep you company while you work, shared with real people.

It's a quiet beach in the browser, shared with up to 49 other people. You walk on the sand, wave, sit and watch the water, or add a stone to a cairn. Every 15 minutes the tide comes in and washes the cairns away, and everyone starts again on fresh sand.

Pebble Cove is a working title. Step 1 is built: one beach for one player. Everyone else on the beach is a resident character, not a real person.

## Play it

- **Game:** <https://hunghoni.github.io/pebble-cove/>. It's public: anyone with the link can play, with no sign-in. Add `?tide=60&stats` to the end for one-minute tides and the speed box. Every push to `main` builds the game, runs the tests and publishes it there, through `.github/workflows/pages.yml`.
- **Code:** <https://github.com/hungHoni/pebble-cove>, a public repository.
- **Private copy:** <https://claude.ai/artifact/U8xbxw6mAiFex1YdHiKqpK>, which needs a claude.ai sign-in and doesn't update on push. Add `#tide-60.stats` there instead.

## What's here

| Path | What it is | Status |
|---|---|---|
| `index.html`, `src/` | Step 1 of the game in TypeScript and PixiJS | Built, checked in desktop and phone-sized Chrome, not yet on an iPhone |
| `src/sim/` | The game rules, with no drawing or page code, so the step 2 server can run the same files | 16 tests passing |
| `tests/` | Rule tests (Vitest) | Passing |
| `design/pebble-cove.html` | Source of the design page: looks, a visit, wow ideas, why people come back, multiplayer setup, costs, funding, marketing and the build plan | Draft 10, published |
| `mockups/` | Stills of the design looks and of step 1 running | Reference |
| `scripts/build-artifact.mjs` | Turns the build into the claude.ai link's files | Used by `npm run artifact` |
| `.github/workflows/pages.yml` | Builds, tests and publishes the game to GitHub Pages on every push to `main` | Live |

The published design page is at <https://claude.ai/artifact/BB4UnxniTuGm88Y4mtEpwn>. It's private until you share it. To change it, edit `design/pebble-cove.html` and publish it to that same link.

## Run it

```bash
npm install
npm run dev
```

Then open <http://localhost:5181>.

```bash
npm test
npm run build
```

`npm run build` writes the game to `dist/`. It's about 175 KB of compressed code, plus the two web fonts.

`npm run artifact` builds the game and copies it to `artifact/` in the form the claude.ai link needs: the page without its document wrapper, plus the script files it prints. To update the link, publish `artifact/index.html` with those files to the same address.

### Try it on your iPhone

```bash
npm run phone
```

This builds the game and serves it to every device on your Wi-Fi, on port 5182. Open the Network address it prints in Safari on your iPhone, for example `http://192.168.1.20:5182/?stats`. To test without the Mac, open <https://hunghoni.github.io/pebble-cove/?stats> instead. Your iPhone has to be on the same Wi-Fi as the Mac. Anyone else on that Wi-Fi can open it too while it runs. Press Ctrl+C to stop it.

Before you start:

- Turn off Low Power Mode, which holds Safari to 30 frames a second.
- Flip the silent switch off, or set Silent Mode off. The game follows silent mode, and plays alongside your own music.

What to try and report back:

- Your iPhone model and iOS version (Settings › General › About).
- The numbers in the `?stats` box after a minute of walking and stacking. Above 55 fps with only a few slow frames is good.
- Whether sound starts after your first tap.
- Whether anything is hidden behind the notch, the Home bar or Safari's toolbar, upright and sideways.
- How long the first load took.
- One full tide on `?tide=60&stats`: the postcard, the surge and the album.

### Test switches

- `?tide=60` makes each tide one minute long instead of 15.
- `?skip=rise`, `?skip=surge`, `?skip=low` or `?skip=gust` jumps to 3 seconds before that event.
- `?stats` shows the frame rate, the slowest frame and the screen size above the buttons. Switches combine with `&`, as in `?tide=60&stats`.
- The claude.ai link passes only the part after `#`, so there the switches are words joined by dots: `#tide-60.stats`, `#skip-low` or `#bot`.
- `#bot` turns on the play-test hook for `../playtest-harness`: `window.__game.snapshot()`, `legal()` and `act(id)`. It also has `pump()` and `run(ms)`, which run frames on demand, because a hidden tab gets no animation frames.

## Step 1

What it includes:

- One beach four screens wide in paper cut, with a camera that follows you and keeps the sea in view.
- A color and hat picker. Tap your own character to change your look.
- Walk with WASD, the arrow keys or a tap. Wave, Sit and Stack with the buttons or 1, 2 and 3.
- Cairns go only on rings of pebbles. Each stone plays a note on a pentatonic scale, so any mix sounds good.
- The 15-minute tide on the real clock: a timer, the water rising, a postcard saved to your album, then a surge of foam that washes every cairn away and plays them one last time.
- The great low tide once an hour: the sea pulls back, uncovering tidepools and a sandbar out to an island.
- Hats in the wind: a gust once a tide blows every hat off. Only the owner can pick theirs up, and hats in the water float back.
- Seven resident characters who wander, sit, stack, wave back and fetch their hats.
- Sound made in the browser, started by your first tap. The mute setting, your look, your stone total and up to 12 postcards stay on your device.

Checked so far, in headless Chrome at desktop size, as an upright phone (390 × 844) and as a sideways phone (844 × 390):

- Picking a look, walking, stacking, waving, the full tide cycle, the postcard album, the gust and the low tide all work.
- It holds 60 frames a second with no errors, through the play-test hook.
- The built version loads over the Wi-Fi address at phone size. Checking it found that the build step dropped the CSS `translate` rule, which pushed the hint bubble off screen and the wide-screen picker off center. Both now use `transform`.

Not checked yet:

- Frame rate in Safari on your iPhone, and on an older iPhone.
- Load time on 4G. The public link now makes this easy to try away from the Wi-Fi.
- Sound on a real device.
- Five new players each playing one tide.
- A play-test robot run on the iPhone. The hook is ready, but the runner in `../playtest-harness` isn't built yet.

## Decided

- **Purpose** (4 Nov 2026): a calm place to take a break, or to keep you company while you work, shared with real people.
- **Look** (4 Nov 2026): A, paper cut. Flat sheets of colored paper, each with a soft shadow under it.
- **Features** (4 Nov 2026): all seven wow ideas, spread across the build steps:
  1. One beach, one player: cairns that sing, hats in the wind, the sandbar for the great low tide
  2. One live cove: the daily whale, the crowd wave, living postcards
  3. Many coves: stones that travel

## Still open

- The name, no chat, launch size, money, the monthly budget cap and a first-whale launch event. None of these blocks step 2.

## Planned stack

- **Browser:** TypeScript and PixiJS, drawing the 2D beach
- **Game servers:** Node.js and Colyseus, one room per cove, one process per CPU core
- **Matchmaking:** the Colyseus matchmaker, sharing room lists and head counts through Redis
- **Hosting:** game files on a CDN, and servers on a host that includes traffic in the price
