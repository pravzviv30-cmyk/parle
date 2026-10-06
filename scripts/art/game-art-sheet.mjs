/**
 * The founder's contact sheet for the game art (come alive, decision D10).
 *
 *   node --experimental-strip-types scripts/art/game-art-sheet.mjs
 *
 * Reads the drawings from apps/mobile/src/game/art/shapes.ts and the colours from
 * apps/mobile/src/palette.ts, the same data the app draws, and writes
 * artifacts/game-art/index.html (ignored by git): every drawing in every state at 48, 96 and
 * 160 px on paper and on the blue, coral, sun and mint grounds, with a plain note of where
 * each one appears, and a motion preview of the flame lighting.
 *
 * Inline SVG, CSS and a few lines of script only, so the page opens from disk with no server
 * and nothing is fetched. The founder approves the art by eye on this page before it ships.
 */
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  ART_GROUNDS,
  ART_VIEWBOX,
  FLAME_FEET,
  GROUND_TOKEN,
  colourOf,
  drawn,
  layer,
  statesOf,
} from '../../apps/mobile/src/game/art/shapes.ts';
import { FLAME_MOTION } from '../../apps/mobile/src/game/art/artMotion.ts';
import { colour, paper } from '../../apps/mobile/src/palette.ts';

const ROOT = resolve(import.meta.dirname, '..', '..');
const OUT = join(ROOT, 'artifacts', 'game-art');
const SIZES = [48, 96, 160];

const GROUND_NAMES = { paper: 'Paper', blue: 'Blue', coral: 'Coral', sun: 'Sun', mint: 'Mint' };

/** What each drawing is, where it appears, and what each state means. Plain English, for the founder. */
const NOTES = {
  flame: {
    title: 'Flame',
    what: 'The streak flame. Lit when today counts. Unlit is the same flame in the paper greys, waiting for the first practice of the day.',
    where: [
      'Streak takeover, lighting up from an ember. On the coral milestone card it is drawn white and sun.',
      'Home flame on the Today card, small, beside the streak number.',
      'Streak screen: the hero flame and the practised days in the week strip.',
      'The streak tile on Progress.',
      'The first-run Day 1 page, where the streak starts.',
    ],
    states: {
      lit: 'Lit: today counts. It lights once for each real streak day, then flickers three times while it is in view and rests.',
      unlit: 'Unlit: before the first practice of the day, or after a fresh start. Never sad, never crossed out.',
    },
  },
  medal: {
    title: 'Medal',
    what: 'The milestone and badge medal: a white star on a disc in a rim, with two ribbon tails.',
    where: [
      'Badge takeover, on paper.',
      'Streak milestone takeover, where a medal drops in.',
      'Badge shelf on Progress: earned medals in colour, the next ones in grey.',
      'Milestones row on the Streak screen: sun for 7 days, mint for 30, blue for 100.',
      'The month medal in the quests sheet.',
    ],
    states: {
      sun: 'Earned, sun.',
      mint: 'Earned, mint.',
      blue: 'Earned, blue.',
      next: 'Next: a badge still ahead, the same medal in the paper greys. The app never calls it locked.',
    },
  },
  crest: {
    title: 'Level crest',
    what: 'The level crest. It draws no number and no name: the screen sets "Level 5" beside it in type, so the words grow with the text size setting.',
    where: ['Level takeover, on blue, with "Level 5" set beneath it in type.'],
    states: { level: 'The one look.' },
  },
  freeze: {
    title: 'Freeze mark',
    what: 'A streak freeze: a plan perk that covers a missed day by itself.',
    where: [
      'Freezes card on the Streak screen, one mark per freeze.',
      'A day a freeze covered, in the week strip and the month calendar.',
    ],
    states: {
      ready: 'Ready to cover a day.',
      used: 'Used this week: grey until it comes back seven days later.',
    },
  },
  repair: {
    title: 'Repair mark',
    what: 'A streak repair: a ring broken at the top and mended with a stitched patch.',
    where: ['Repair card on the Streak screen.', 'A day a repair brought back, in the calendar.'],
    states: { mended: 'The one look.' },
  },
};

/** @param {string} text */
function escape(text) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

/**
 * One drawing as inline SVG.
 * @param {readonly { id: string; layer: string; d: string; fill: string }[]} parts
 * @param {number} size
 * @param {string} label
 */
function svg(parts, size, label) {
  const paths = parts.map((p) => `<path d="${p.d}" fill="${colourOf(p.fill)}"/>`).join('');
  const named = label === '' ? 'aria-hidden="true"' : `role="img" aria-label="${escape(label)}"`;
  return `<svg width="${size}" height="${size}" viewBox="${ART_VIEWBOX}" ${named} focusable="false" overflow="visible">${paths}</svg>`;
}

/** @param {string} name @param {string} state @param {string} ground */
function tile(name, state, ground) {
  const parts = drawn(name, state, ground);
  const title = NOTES[name].title;
  const drawings = SIZES.map((size) => svg(parts, size, `${title}, ${state}, on ${GROUND_NAMES[ground].toLowerCase()}, ${size} pixels`)).join('');
  return `
        <figure class="tile on-${ground}" style="background:${colourOf(GROUND_TOKEN[ground])}">
          <div class="sizes">${drawings}</div>
          <figcaption>${escape(GROUND_NAMES[ground])}</figcaption>
        </figure>`;
}

function sections() {
  return Object.entries(NOTES)
    .map(([name, note]) => {
      const states = statesOf(name)
        .map(
          (state) => `
      <h3>${escape(state)}</h3>
      <p class="state">${escape(note.states[state] ?? '')}</p>
      <div class="grounds">${ART_GROUNDS.map((ground) => tile(name, state, ground)).join('')}
      </div>`,
        )
        .join('');
      return `
    <section aria-labelledby="art-${name}">
      <h2 id="art-${name}">${escape(note.title)}</h2>
      <p>${escape(note.what)}</p>
      <p class="where-title">Where it appears</p>
      <ul class="where">${note.where.map((line) => `<li>${escape(line)}</li>`).join('')}</ul>${states}
    </section>`;
    })
    .join('');
}

/** The motion preview: each moving layer as its own still SVG, moved by CSS, as the app moves them. */
function motionPreview() {
  const size = 160;
  const lit = drawn('flame', 'lit', 'blue');
  const ember = drawn('flame', 'unlit', 'blue');
  const pct = ([x, y]) => `${x}% ${y}%`;
  const flame = `
        <div class="stage" style="background:${colourOf(GROUND_TOKEN.blue)}">
          <div class="box" data-motion="flame" role="img" aria-label="The flame lighting on the blue streak card">
            <div class="layer ember">${svg(ember, size, '')}</div>
            <div class="layer lit" style="transform-origin:${pct(FLAME_FEET.outer)}">
              <div class="layer flicker" style="transform-origin:${pct(FLAME_FEET.outer)}">${svg(layer(lit, 'outer'), size, '')}</div>
              <div class="layer inner" style="transform-origin:${pct(FLAME_FEET.inner)}"><div class="layer rise">${svg(layer(lit, 'inner'), size, '')}</div></div>
              <div class="layer core" style="transform-origin:${pct(FLAME_FEET.core)}">${svg(layer(lit, 'core'), size, '')}</div>
            </div>
          </div>
        </div>`;
  return `
    <section aria-labelledby="motion">
      <h2 id="motion">Motion preview</h2>
      <p>The flame lighting and flickering three times. The app runs it on its motion tokens and springs; this page draws the same layers and approximates the springs with CSS curves. It rests on its final frame.</p>
      <p class="reduced-note">Your system asks for reduced motion, so these show their final frame, as the app does.</p>
      <div class="previews">
        <figure class="preview">${flame}
          <figcaption><button type="button" class="play" data-play="flame">Light the flame</button></figcaption>
        </figure>
      </div>
    </section>`;
}

function page() {
  const F = FLAME_MOTION;
  const flickerAt = F.wait;
  const flickerAll = F.flickerMs * F.flickers;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Luvani game art</title>
<style>
  :root { color-scheme: light dark; --page: ${paper.ground}; --card: ${paper.card}; --ink: ${paper.ink}; --quiet: ${paper.inkSoft}; --line: ${paper.line}; --accent: ${colour.blue}; --on-accent: ${paper.onInk}; }
  @media (prefers-color-scheme: dark) { :root { --page: #171513; --card: #221f1c; --ink: #f4efe8; --quiet: #b9b1a6; --line: #38332e; --accent: #8fa8ff; --on-accent: #171513; } }
  body { margin: 0; background: var(--page); color: var(--ink); font: 1rem/1.5 -apple-system, system-ui, sans-serif; }
  main { max-width: 1180px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 1.75em; line-height: 1.2; margin: 0 0 0.3em; }
  h2 { font-size: 1.4em; margin: 2.2em 0 0.4em; padding-top: 1em; border-top: 1px solid var(--line); }
  h3 { font-size: 1em; margin: 1.4em 0 0.1em; text-transform: capitalize; }
  p { margin: 0.25em 0; max-width: 70ch; }
  .lead, .state, .where, .where-title { color: var(--quiet); }
  .where-title { font-weight: 600; margin-top: 0.6em; }
  .where { margin: 0.2em 0 0.4em; padding-left: 1.25em; max-width: 70ch; }
  .grounds { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
  .tile { margin: 0; border-radius: 16px; padding: 28px 16px 10px; border: 1px solid var(--line); }
  .sizes { display: flex; align-items: flex-end; gap: 14px; }
  .tile figcaption { margin-top: 8px; font-size: 0.8em; font-weight: 600; color: ${paper.ink}; }
  .on-blue figcaption, .on-coral figcaption { color: ${paper.onInk}; }
  svg { display: block; overflow: visible; }
  .previews { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px; }
  .preview { margin: 0; }
  .stage { border-radius: 16px; padding: 40px 48px 24px; }
  .box { position: relative; width: 160px; height: 160px; }
  .layer { position: absolute; inset: 0; }
  .play { margin-top: 10px; min-height: 44px; padding: 0.4em 1.2em; border-radius: 999px; border: 0; background: var(--accent); color: var(--on-accent); font: inherit; font-weight: 600; cursor: pointer; }
  .play:focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; }
  .ember { opacity: 0; }
  .reduced-note { display: none; }
  @keyframes ember { from { opacity: 1; } to { opacity: 0; } }
  @keyframes light { 0% { opacity: 0; transform: rotate(${F.tilt}deg) scale(${F.ember}); } 30% { opacity: 1; } 60% { transform: rotate(-2deg) scale(1.1); } 82% { transform: rotate(0deg) scale(0.98); } 100% { opacity: 1; transform: rotate(0deg) scale(1); } }
  @keyframes inner { 0% { transform: scale(${F.innerFrom}); } 60% { transform: scale(1.1); } 100% { transform: scale(1); } }
  @keyframes core { 0% { transform: scale(0); } 60% { transform: scale(1.12); } 100% { transform: scale(1); } }
  @keyframes stretch { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(${F.stretch}); } }
  @keyframes rise { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-${F.rise * 100}%); } }
  .box.playing[data-motion="flame"] .ember { animation: ember ${F.fade}ms ease-in both; }
  .box.playing[data-motion="flame"] .lit { animation: light 560ms cubic-bezier(0.22, 1, 0.36, 1) both; }
  .box.playing[data-motion="flame"] .inner { animation: inner 520ms cubic-bezier(0.22, 1, 0.36, 1) ${F.innerLag}ms both; }
  .box.playing[data-motion="flame"] .core { animation: core 520ms cubic-bezier(0.22, 1, 0.36, 1) ${F.coreLag}ms both; }
  .box.playing[data-motion="flame"] .flicker { animation: stretch ${F.flickerMs}ms cubic-bezier(0.65, 0, 0.35, 1) ${flickerAt}ms ${F.flickers}; }
  .box.playing[data-motion="flame"] .rise { animation: rise ${F.flickerMs}ms cubic-bezier(0.65, 0, 0.35, 1) ${flickerAt + F.riseLag}ms ${F.flickers}; }
  @media (prefers-reduced-motion: reduce) {
    .reduced-note { display: block; }
    .box.playing *, .box.done * { animation: none !important; }
  }
</style>
</head>
<body>
<main>
  <h1>Luvani game art</h1>
  <p class="lead">Flat drawings built in code from apps/mobile/src/game/art/shapes.ts, in the house style: palette colours only, no outlines, gradients, shadows, faces or words. Every drawing in every state, at 48, 96 and 160 pixels, on paper and on the four colour grounds.</p>
  <p class="lead">On a colour ground a drawing never vanishes into it: where a drawing uses the ground's own colour, that colour and white trade places.</p>
  <p class="lead">Nothing ships until you approve it by eye. Tell Claude in chat which drawings you approve and which to change.</p>${motionPreview()}${sections()}
</main>
<script>
  // Total play time per preview, so the button can rest the drawing on its final frame.
  const LENGTH = { flame: ${flickerAt + F.riseLag + flickerAll} };
  for (const button of document.querySelectorAll('[data-play]')) {
    button.addEventListener('click', () => {
      const name = button.getAttribute('data-play');
      const box = document.querySelector('[data-motion="' + name + '"]');
      box.classList.remove('playing', 'done');
      void box.offsetWidth;
      box.classList.add('playing');
      window.setTimeout(() => { box.classList.remove('playing'); box.classList.add('done'); }, LENGTH[name] + 50);
    });
  }
</script>
</body>
</html>
`;
}

mkdirSync(OUT, { recursive: true });
const file = join(OUT, 'index.html');
writeFileSync(`${file}.tmp`, page());
renameSync(`${file}.tmp`, file);
console.log(`game art contact sheet: ${file}`);
