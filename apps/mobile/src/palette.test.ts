/**
 * The colour contract.
 *
 * There is one ground now — Porcelain — not five papers keyed by place, and the
 * signals and traffic lights are saturated back up to full colour. Every raw
 * value lives in `palette.ts`, which imports nothing, so this suite can hold the
 * whole palette to a numeric contract rather than to a comment somebody will
 * contradict with an eyedropper.
 *
 * The contract has three floors, and which one a colour is held to is the whole
 * of it. Words clear 4.5 against whatever they sit on. A mark that reports state
 * clears 3. Two colours that mean different things stay a Delta-E of 30 apart so
 * neither reads as the other. Nothing is exempt from the floor it belongs to;
 * where a colour cannot clear the floor for words it is used only as a mark and
 * the words beside it are set in ink.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { paper, accent, highlight, signal, orb, rungColor, tint } from './palette.ts';

const SRC = new URL('.', import.meta.url).pathname;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

// ── colour maths, local to the test, per docs/TESTING.md ──────────────────

interface Rgb {
  r: number;
  g: number;
  b: number;
}
interface Lab {
  l: number;
  a: number;
  b: number;
}

const linear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

function channels(hex: string): Rgb {
  const h = hex.replace('#', '');
  assert.equal(h.length, 6, `${hex} is not a six digit hex`);
  return {
    r: linear(Number.parseInt(h.slice(0, 2), 16)),
    g: linear(Number.parseInt(h.slice(2, 4), 16)),
    b: linear(Number.parseInt(h.slice(4, 6), 16)),
  };
}

function luminance(hex: string): number {
  const c = channels(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  const hi = Math.max(x, y);
  const lo = Math.min(x, y);
  return (hi + 0.05) / (lo + 0.05);
}

/** CIE L*a*b* under D65, which is where lightness and Delta-E both live. */
function lab(hex: string): Lab {
  const c = channels(hex);
  const x = (0.4124 * c.r + 0.3576 * c.g + 0.1805 * c.b) / 0.95047;
  const y = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const z = (0.0193 * c.r + 0.1192 * c.g + 0.9505 * c.b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function deltaE(one: string, two: string): number {
  const p = lab(one);
  const q = lab(two);
  return Math.hypot(p.l - q.l, p.a - q.a, p.b - q.b);
}

const GROUND = paper.ground;
const CARD = paper.card;
const INK = paper.ink;

// The three text floors, named once.
const TEXT = 4.5;
const MARK = 3;
const APART = 30;

describe('every raw colour lives in palette.ts — F320', () => {
  test('theme.ts carries no raw hex, every colour comes from palette.ts', () => {
    // The values used to live in theme.ts and this suite copied them and grepped
    // source to keep the copies honest. They live in palette.ts now, this suite
    // imports them, and theme.ts must carry no six-digit hex literal at all — a
    // hex in theme.ts is a value that escaped the one file the test can hold.
    const theme = readFileSync(join(SRC, 'theme.ts'), 'utf8');
    const stripped = theme.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const hexes = stripped.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
    assert.deepEqual(hexes, [], `theme.ts still writes raw hex: ${hexes.join(', ')}`);

    // And theme.ts really does re-export the five colour objects from palette.
    assert.match(theme, /export\s*\{[^}]*\bpaper\b[^}]*\}\s*from\s*'\.\/palette\.ts'/);
  });
});

describe('one ground, pinned — F321', () => {
  test('nothing asks for a paper by place any more', () => {
    // paperFor and the five-paper table are gone. No screen may call the one nor
    // reach into the other; there is a single `paper` object and that is the
    // whole of the app's light.
    for (const file of walk(SRC)) {
      if (file.includes('.test.')) continue;
      const body = readFileSync(file, 'utf8');
      assert.ok(!/paperFor/.test(body), `${file} still calls paperFor; the five-paper system is gone`);
      assert.ok(!/\bpapers\s*[.[]/.test(body), `${file} still reaches into a papers map; there is one ground now`);
      assert.ok(!/\baccents\s*[.[]/.test(body), `${file} still reaches into an accents map; there is one accent now`);
    }
    const palette = readFileSync(join(SRC, 'palette.ts'), 'utf8');
    for (const gone of ['paperFor', 'papers', 'accents', 'PaperName', 'Paper ']) {
      assert.ok(
        !new RegExp(`export\\s[^\\n]*\\b${gone.trim()}\\b`).test(palette),
        `palette.ts still exports ${gone.trim()}`,
      );
    }
  });

  test('the ground is pinned, and there is only one', () => {
    // Porcelain (B), the founder's pick. Pinned by value so a re-tint is a
    // deliberate edit to this line, not a drift, and there is exactly one of it.
    assert.equal(paper.ground, '#F7F3E8');
    assert.equal(paper.groundDeep, '#E6DECD');
    assert.equal(paper.line, '#B8BCAD');
    assert.equal(paper.lineOnCard, '#DADBCF');
    assert.equal(paper.card, '#FFFEFA');
  });

  test('the card still reads as a card, and the hairlines still read on the ground', () => {
    // Lightness no longer carries the safety argument — one ground means there
    // is nothing for it to hold still against. The steps are held by Delta-E
    // instead: the card lifts off the ground, each hairline separates from what
    // it rules, and groundDeep sits between the two.
    assert.ok(deltaE(GROUND, paper.groundDeep) >= 5, `groundDeep is only ${deltaE(GROUND, paper.groundDeep).toFixed(1)} off the ground`);
    assert.ok(deltaE(GROUND, paper.line) >= 8, `the ground hairline is only ${deltaE(GROUND, paper.line).toFixed(1)} off the ground`);
    assert.ok(deltaE(CARD, GROUND) >= 4, `the card is only ${deltaE(CARD, GROUND).toFixed(1)} off the ground`);
    assert.ok(deltaE(CARD, paper.lineOnCard) >= 6, `the card hairline is only ${deltaE(CARD, paper.lineOnCard).toFixed(1)} off the card`);
  });

  test('faint ink is a mark on the inactive tab, so it clears 3 on the ground', () => {
    // inkFaint went from #94849F (2.91, under the mark floor) to #8A7996 so the
    // inactive tab glyph reads. It is a mark, not words, so 3 is its floor.
    assert.ok(
      contrast(paper.inkFaint, GROUND) >= MARK,
      `inkFaint is ${contrast(paper.inkFaint, GROUND).toFixed(2)} on the ground, under the ${MARK} floor for a mark`,
    );
  });

  test('ink, soft ink, the fix colour and the violet all hold on the ground', () => {
    assert.ok(contrast(INK, GROUND) >= 7, `ink is ${contrast(INK, GROUND).toFixed(2)} on the ground`);
    assert.ok(contrast(INK, paper.groundDeep) >= 7, `ink is ${contrast(INK, paper.groundDeep).toFixed(2)} on a chip fill`);
    assert.ok(contrast(paper.inkSoft, GROUND) >= TEXT, `inkSoft is ${contrast(paper.inkSoft, GROUND).toFixed(2)} on the ground`);
    assert.ok(contrast(signal.correspondance, GROUND) >= TEXT, `the fix colour is ${contrast(signal.correspondance, GROUND).toFixed(2)} on the ground`);
    assert.ok(contrast(accent.primary, GROUND) >= TEXT, `the violet is ${contrast(accent.primary, GROUND).toFixed(2)} on the ground`);
    assert.ok(contrast(accent.primary, paper.groundDeep) >= 4, `the violet is ${contrast(accent.primary, paper.groundDeep).toFixed(2)} on a chip fill`);
    assert.ok(contrast(accent.label, GROUND) >= TEXT, `the label accent is ${contrast(accent.label, GROUND).toFixed(2)} on the ground`);
  });

  test('soft ink clears 4.5 on a card as well as on the ground', () => {
    // F330 moves the app's running text onto inkSoft, and some of that text sits
    // on a white card rather than on the ground. The value already clears the
    // text floor there; this pins it, so a re-tint of inkSoft cannot pass by
    // clearing the ground alone and leave the words on a card under the floor.
    assert.ok(contrast(paper.inkSoft, GROUND) >= TEXT, `inkSoft is ${contrast(paper.inkSoft, GROUND).toFixed(2)} on the ground`);
    assert.ok(contrast(paper.inkSoft, CARD) >= TEXT, `inkSoft is ${contrast(paper.inkSoft, CARD).toFixed(2)} on a card`);
  });
});

describe('signals are re-saturated and held to what they are — F322', () => {
  test('green and the fix colour are words, so they clear 4.5 on the ground and on a card', () => {
    for (const [name, hex] of [['green', signal.good], ['the fix colour', signal.correspondance]] as const) {
      assert.ok(contrast(hex, GROUND) >= TEXT, `${name} is ${contrast(hex, GROUND).toFixed(2)} on the ground`);
      assert.ok(contrast(hex, CARD) >= TEXT, `${name} is ${contrast(hex, CARD).toFixed(2)} on a card`);
    }
  });

  test('the tutor\'s red is a mark, so it clears 3 on the ground', () => {
    // Red is the orb reporting "the tutor is speaking" and never carries words,
    // so it is held to the mark floor. The caption beside it is ink.
    assert.ok(contrast(signal.live, GROUND) >= MARK, `the red is ${contrast(signal.live, GROUND).toFixed(2)} on the ground`);
  });

  test('the mic glyph still reads on a live green circle', () => {
    // The SpeakCircle fills with signal.good while the learner's mic is open and
    // draws the microphone in onInk. The glyph is a mark on that fill.
    assert.ok(contrast(paper.onInk, signal.good) >= MARK, `the mic glyph is ${contrast(paper.onInk, signal.good).toFixed(2)} on the live green`);
  });

  test('no two signals come within a Delta-E of 30, and none reads as a rung', () => {
    const sigs = Object.entries(signal);
    for (let i = 0; i < sigs.length; i += 1) {
      for (let j = i + 1; j < sigs.length; j += 1) {
        const d = deltaE(sigs[i]![1], sigs[j]![1]);
        assert.ok(d >= APART, `${sigs[i]![0]} and ${sigs[j]![0]} are only ${d.toFixed(0)} apart`);
      }
    }
    for (const [sName, s] of sigs) {
      for (const rung of [1, 2, 3] as const) {
        const d = deltaE(s, rungColor[rung]);
        assert.ok(d >= APART, `${sName} is only ${d.toFixed(0)} from rung ${rung}, so a state reads as a rung`);
      }
    }
  });

  test('no accent comes within a Delta-E of 30 of any signal or rung', () => {
    // Green means go and red means listen; a label the colour of either makes the
    // app lie. The rungs and the orb's amber are held off the accent too, because
    // the same violet is the only accent everywhere now.
    const rivals: Record<string, string> = {
      good: signal.good,
      live: signal.live,
      correspondance: signal.correspondance,
      rung1: rungColor[1],
      rung2: rungColor[2],
      rung3: rungColor[3],
      thinking: orb.thinking,
    };
    for (const a of new Set([accent.primary, accent.label])) {
      for (const [name, hex] of Object.entries(rivals)) {
        const d = deltaE(a, hex);
        assert.ok(d >= APART, `the accent is only ${d.toFixed(0)} from ${name}`);
      }
    }
  });
});

describe('a tint is paper under ink art, never a mark — F362', () => {
  // A tint is a surface: the disc behind a mission's drawing and nothing else.
  // So it is held to a paper's floors, not a mark's and not an accent's. A blue
  // that clears thirty from rung three's blue cannot also read as a disc on the
  // ground (every such blue sits under eight from it), which is why the rung
  // floor here is twenty, with the lightness rule making sure no tint can be
  // mistaken for a fill that means something.
  const surfaces: Record<string, string> = {
    ground: paper.ground,
    groundDeep: paper.groundDeep,
    card: paper.card,
    lineOnCard: paper.lineOnCard,
  };
  const marks: Record<string, string> = {
    good: signal.good,
    live: signal.live,
    correspondance: signal.correspondance,
    thinking: orb.thinking,
    accent: accent.primary,
  };
  // Outlined surfaces carry their boundary in ink; the tint supplies context.
  const DISC = 5;
  const RUNG_APART = 20;
  const TWIN = 10;

  test('ink clears the text floor on every tint, and every tint reads as a disc — F362', () => {
    for (const [name, hex] of Object.entries(tint)) {
      assert.ok(contrast(INK, hex) >= TEXT, `ink is ${contrast(INK, hex).toFixed(2)} on ${name}`);
      for (const [surface, sh] of Object.entries(surfaces)) {
        const d = deltaE(hex, sh);
        assert.ok(d >= DISC, `${name} is only ${d.toFixed(1)} off the ${surface}, so it does not read as a disc`);
      }
    }
  });

  test('feature paper carries dark text and remains distinct from voice states', () => {
    // 2026-09-27, notebook Phase 1: the chartreuse left `accent.feature` for the
    // `highlight` token, and the old name is a deprecated alias for the card, so
    // every panel, tile, avatar and tab still spelling it turns to paper at once.
    // The floors below held on the chartreuse and are held on it again, under its
    // new name, in the highlighter suite; here they are kept for the alias too.
    assert.equal(accent.feature, paper.card, 'accent.feature is no longer the deprecated alias for the card');
    assert.ok(contrast(INK, accent.feature) >= 7);
    assert.ok(contrast(paper.inkSoft, accent.feature) >= TEXT);
    assert.ok(contrast(accent.primary, paper.onInk) >= TEXT);
    for (const value of Object.values(orb)) assert.ok(deltaE(accent.feature, value) >= APART);
  });

  test('inkSoft clears 4.5 on every tint', () => {
    // Revamp A puts running words on a tint for the first time: a tinted row is
    // a title in ink over a gloss in soft ink, and a disabled row says so by
    // stepping its title down to soft ink too. Ink on a tint was already held
    // above; soft ink never was, because until now nothing set a word in it on
    // one. It passes today on all six, and this pins it, so a re-tint cannot
    // clear the floor for ink alone and leave every gloss in the app under it.
    for (const [name, hex] of Object.entries(tint)) {
      const r = contrast(paper.inkSoft, hex);
      assert.ok(r >= TEXT, `inkSoft is ${r.toFixed(2)} on ${name}, under the ${TEXT} floor for words`);
    }
  });

  test('no tint comes within thirty of a signal or the accent, within twenty of a rung, or as dark as any mark — F362', () => {
    const everyMark = [...Object.values(marks), rungColor[1], rungColor[2], rungColor[3]];
    const maxMarkL = Math.max(...everyMark.map((h) => lab(h).l));
    for (const [name, hex] of Object.entries(tint)) {
      for (const [mark, mh] of Object.entries(marks)) {
        const d = deltaE(hex, mh);
        assert.ok(d >= APART, `${name} is only ${d.toFixed(0)} from ${mark}`);
      }
      for (const rung of [1, 2, 3, 4] as const) {
        const d = deltaE(hex, rungColor[rung]);
        assert.ok(d >= RUNG_APART, `${name} is only ${d.toFixed(0)} from rung ${rung}'s fill`);
      }
      assert.ok(lab(hex).l > maxMarkL, `${name} is as dark as a mark (L* ${lab(hex).l.toFixed(0)} against ${maxMarkL.toFixed(0)})`);
    }
  });

  test('no two tints read as one, and nothing letters or signals in a tint — F362', () => {
    const entries = Object.entries(tint);
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const d = deltaE(entries[i]![1], entries[j]![1]);
        assert.ok(d >= TWIN, `${entries[i]![0]} and ${entries[j]![0]} are only ${d.toFixed(1)} apart`);
      }
    }

    // The source walk. A tint is a SURFACE: the disc under a place's line art,
    // or the ground under a row about one place (F467, the founder's call). It
    // is never lettering, never a stroke, never a border and never a mark that
    // reports state, and the hex is still reachable from four files only, so a
    // screen names a place and never a colour.
    //
    // The ban used to read `(?:color|stroke|fill|borderColor)` with no `i` and
    // no boundary, which quietly matched nothing in `backgroundColor` — so a
    // tint ground passed by accident rather than by permission. Now the
    // permission is explicit and the ban is real: the lookbehind lets
    // `backgroundColor` through and holds `borderColor`, `tintColor` and a bare
    // `color` however they are cased.
    const LETTERS_IN_A_TINT = /(?<!background)(?:[Cc]olor|stroke|fill)\s*[:=]\s*\{?\s*tint[.[]/;

    // The refutations first, so a regex that stopped catching anything fails
    // here rather than going quietly green over the whole app.
    for (const forbidden of ['color: tint.sage', 'borderColor: tint.sky', 'stroke={tint.rose}', 'fill: tint.lilac']) {
      assert.match(forbidden, LETTERS_IN_A_TINT, `"${forbidden}" is lettering or a stroke in a tint and must be caught`);
    }
    for (const permitted of ['backgroundColor: tint.sage', 'backgroundColor: tint[name]']) {
      assert.doesNotMatch(permitted, LETTERS_IN_A_TINT, `"${permitted}" is a surface, which is what a tint is`);
    }

    const allowed = new Set(['palette.ts', 'theme.ts', 'components.tsx', 'missions/missionTint.ts', 'nav/tabSurface.ts']);
    for (const file of walk(SRC)) {
      if (/\.test\.tsx?$/.test(file)) continue;
      const rel = file.slice(SRC.length);
      const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      const reaches = /\btint\.[a-z]+\b|\btint\[/.test(source);
      if (reaches && !allowed.has(rel)) {
        assert.fail(`${rel} reaches a tint directly; a screen names a place, and the primitive names the colour`);
      }
      assert.doesNotMatch(source, LETTERS_IN_A_TINT, `${rel} letters or signals in a tint`);
    }
  });
});

describe('the voice circle is legible — F323', () => {
  test('every orb state is legible as a mark against the ground', () => {
    // A mark that reports state is a graphical object and clears 3 against the
    // ground it sits on. All four states, red and amber included, now do.
    for (const [name, hex] of Object.entries(orb)) {
      const r = contrast(hex, GROUND);
      assert.ok(r >= MARK, `orb.${name} is ${r.toFixed(2)} on the ground, below the ${MARK} floor for a mark`);
    }
  });

  test('the three traffic lights stay far apart, and none of them is rung one', () => {
    // rung one's yellow lives one screen away, so the separation from it is held
    // to the full 30 now (it was 20). The three lights stay 30 from each other.
    const lights = [orb.speaking, orb.yourTurn, orb.thinking];
    for (let i = 0; i < lights.length; i += 1) {
      for (let j = i + 1; j < lights.length; j += 1) {
        assert.ok(deltaE(lights[i]!, lights[j]!) >= APART, `two of the tutor's three words are the same colour`);
      }
      assert.ok(
        deltaE(lights[i]!, rungColor[1]) >= APART,
        `a traffic light is only ${deltaE(lights[i]!, rungColor[1]).toFixed(0)} from rung one's yellow`,
      );
    }
  });

  test('an orb caption is words, so it is held to the floor for words', () => {
    // The captions are ink, exactly because the state colours are marks. The
    // amber ceiling that used to sit here was a ceiling, not a floor, and it is
    // gone: the caption clearing the text floor is the whole assertion now.
    assert.ok(contrast(INK, GROUND) >= TEXT, 'the caption ink itself has to clear the floor for text');
  });
});

describe('support colours run hot to cool again — F324', () => {
  // A rung colour is a FILL under an ink numeral, not a state mark. That is why
  // it is NOT held to 3 against the ground the way an orb light is: nothing reads
  // it against the ground, an ink numeral reads against it. So its floor is that
  // ink clears the text floor on the fill, plus that no rung is mistaken for
  // another rung, for the ground, or for ink.
  test('a rung numeral in ink clears 4.5 on its own fill', () => {
    for (const rung of [1, 2, 3] as const) {
      const r = contrast(INK, rungColor[rung]);
      assert.ok(r >= TEXT, `the numeral on rung ${rung} is ${r.toFixed(2)} on its own fill`);
    }
    // Rung four is ink, so its numeral is onInk instead.
    assert.ok(contrast(paper.onInk, rungColor[4]) >= TEXT, `the numeral on rung four is ${contrast(paper.onInk, rungColor[4]).toFixed(2)} on its ink fill`);
  });

  test('support cools as help is withdrawn: each rung is bluer than the last and rung four is ink', () => {
    assert.ok(lab(rungColor[1]).b > lab(rungColor[2]).b, 'rung two is not cooler than rung one');
    assert.ok(lab(rungColor[2]).b > lab(rungColor[3]).b, 'rung three is not cooler than rung two');
    assert.equal(rungColor[4], INK, 'rung four is no longer plain ink');
  });

  test('no rung reads as another rung, as the ground, or as ink', () => {
    const rungs = { 1: rungColor[1], 2: rungColor[2], 3: rungColor[3] } as const;
    const entries = Object.entries(rungs);
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        assert.ok(deltaE(entries[i]![1], entries[j]![1]) >= APART, `rung ${entries[i]![0]} reads as rung ${entries[j]![0]}`);
      }
    }
    for (const [name, hex] of entries) {
      assert.ok(deltaE(hex, GROUND) >= APART, `rung ${name}'s fill is only ${deltaE(hex, GROUND).toFixed(0)} off the ground`);
      assert.ok(deltaE(hex, INK) >= APART, `rung ${name} reads as ink`);
    }
  });
});

describe('the identity violet does its jobs — F325, F326', () => {
  test('pill lettering clears 4.5 on the primary violet', () => {
    // The pill and the active tab are both onInk on accent.primary. This floor
    // has always been met and was never asserted; it is asserted with them now.
    assert.ok(
      contrast(paper.onInk, accent.primary) >= TEXT,
      `pill lettering is ${contrast(paper.onInk, accent.primary).toFixed(2)} on the primary violet`,
    );
  });

  test('the micro-label and the primary are one violet', () => {
    // There is one identity colour. This is the tripwire against a second one
    // creeping back in as a "lighter label" the way #8A5BBF once did.
    assert.equal(accent.label, accent.primary);
  });
});

/**
 * One highlighter — notebook Phase 1, added 2026-09-27.
 *
 * The chartreuse used to be feature paper: the ground of heroes, tiles, the
 * avatar, the active tab and a title panel on half the screens. It is now one
 * pen, drawn behind a French line, on the "you are here" stop of the level path,
 * and in the brand mark (an SVG asset, outside this source tree). So the value
 * is held to a mark's floors, and where it may be spelled is held by a walk.
 */
describe('one highlighter — notebook Phase 1', () => {
  test('the highlighter carries ink and never reads as a state, a rung or the page', () => {
    assert.equal(highlight, '#D8FF54', 'the highlighter moved off the brand chartreuse');
    assert.ok(contrast(INK, highlight) >= 7, `ink is ${contrast(INK, highlight).toFixed(2)} on the highlighter`);
    assert.ok(contrast(paper.inkSoft, highlight) >= TEXT, `soft ink is ${contrast(paper.inkSoft, highlight).toFixed(2)} on the highlighter`);
    const rivals: Record<string, string> = {
      ...Object.fromEntries(Object.entries(signal)),
      ...Object.fromEntries(Object.entries(orb).map(([k, v]) => [`orb.${k}`, v])),
      rung1: rungColor[1],
      rung2: rungColor[2],
      rung3: rungColor[3],
      ground: paper.ground,
      card: paper.card,
      groundDeep: paper.groundDeep,
    };
    for (const [name, hex] of Object.entries(rivals)) {
      const d = deltaE(highlight, hex);
      assert.ok(d >= APART, `the highlighter is only ${d.toFixed(0)} from ${name}`);
    }
  });

  test('the highlighter is spelled in three files, and inside components.tsx only by its two hosts', () => {
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const allowed = new Set(['palette.ts', 'theme.ts', 'components.tsx']);
    for (const file of walk(SRC)) {
      if (/\.test\.tsx?$/.test(file)) continue;
      const rel = file.slice(SRC.length);
      const raw = readFileSync(file, 'utf8');
      if (rel !== 'palette.ts') {
        assert.doesNotMatch(raw, /#D8FF54/i, `${rel} writes the highlighter as a hex; it lives in palette.ts`);
      }
      if (!allowed.has(rel)) {
        assert.doesNotMatch(strip(raw), /\bhighlight\b/, `${rel} reaches for the highlighter; only Highlight and LevelPath may draw it`);
      }
    }

    // Inside the component file: the import, the band behind a French line, and
    // the "you are here" stop. Every other region of the file is refused.
    const components = strip(readFileSync(join(SRC, 'components.tsx'), 'utf8'));
    const region = (marker: string): [number, number] => {
      const from = components.indexOf(marker);
      assert.notEqual(from, -1, `${marker} is missing from components.tsx`);
      const next = components.indexOf('\nexport ', from + marker.length);
      return [from, next === -1 ? components.length : next];
    };
    const hosts = [region('export function Highlight('), region('export function LevelPath(')];
    const importEnd = components.indexOf("from './theme.ts';");
    let uses = 0;
    for (const m of components.matchAll(/\bhighlight\b/g)) {
      const at = m.index;
      if (at < importEnd) continue;
      uses += 1;
      assert.ok(
        hosts.some(([from, to]) => at >= from && at < to),
        `components.tsx draws the highlighter outside Highlight and LevelPath: ${components.slice(Math.max(0, at - 60), at + 20).replace(/\s+/g, ' ')}`,
      );
    }
    assert.ok(uses >= 2, 'neither host draws the highlighter, so this walk is guarding nothing');
  });

  test('no primitive spells the deprecated accent.feature, and no new screen starts to', () => {
    // Pending, Phase 4: every file below still names the alias and draws paper
    // through it. The list may only shrink; a primitive may never be on it.
    const PENDING = new Set([
      'ConvoScreen.tsx',
      'RecapScreen.tsx',
      'SummaryScreen.tsx',
      'auth/SignInScreen.tsx',
      'auth/SignUpScreen.tsx',
      'daily/DailyCarousel.tsx',
      'home/HomeMomentum.tsx',
      'nav/tabSurface.ts',
      'onboarding/AgeGateScreen.tsx',
      'onboarding/OnboardingFlow.tsx',
      'phrases/PhrasebookScreen.tsx',
      'profile/ProfileButton.tsx',
      'tabs/FriendsTab.tsx',
      'tabs/TutorTab.tsx',
      'tutor/TutorIntro.tsx',
      'wall/WallPlansPage.tsx',
    ]);
    for (const file of walk(SRC)) {
      if (/\.test\.tsx?$/.test(file)) continue;
      const rel = file.slice(SRC.length);
      const body = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      if (!/\baccent\.feature\b/.test(body)) continue;
      assert.ok(PENDING.has(rel), `${rel} spells accent.feature; the chartreuse is the highlighter now and the alias is only for screens not yet rebuilt`);
    }
  });
});

describe('the recorded palette matches the code — F327, F328', () => {
  /** Every shipped token, flattened to the path the doc and the app.json use. */
  const tokens: Record<string, string> = {};
  for (const [k, v] of Object.entries(paper)) tokens[`paper.${k}`] = v;
  for (const [k, v] of Object.entries(accent)) tokens[`accent.${k}`] = v;
  // 2026-09-27: the highlighter is a token of its own, recorded like the rest.
  tokens.highlight = highlight;
  for (const [k, v] of Object.entries(signal)) tokens[`signal.${k}`] = v;
  for (const [k, v] of Object.entries(orb)) tokens[`orb.${k}`] = v;
  for (const k of [1, 2, 3, 4] as const) tokens[`rungColor[${k}]`] = rungColor[k];
  for (const [k, v] of Object.entries(tint)) tokens[`tint.${k}`] = v;

  test('DESIGN.md records the palette the app ships', () => {
    // DESIGN.md is recorded from the built artifact, so its token table has to be
    // the palette, row for row. Every row is `| `token.path` | `#HEX` |`, and the
    // doc may list no token the code does not export and skip none it does.
    const doc = readFileSync(join(SRC, '..', '..', '..', 'DESIGN.md'), 'utf8');
    const recorded = new Map<string, string>();
    for (const m of doc.matchAll(/^\|\s*`([^`]+)`\s*\|\s*`(#[0-9A-Fa-f]{6})`\s*\|/gm)) {
      recorded.set(m[1]!, m[2]!.toUpperCase());
    }
    assert.equal(
      recorded.size,
      Object.keys(tokens).length,
      `DESIGN.md records ${recorded.size} tokens and the palette exports ${Object.keys(tokens).length}`,
    );
    for (const [path, hex] of Object.entries(tokens)) {
      assert.equal(recorded.get(path), hex.toUpperCase(), `DESIGN.md records ${path} as ${recorded.get(path)}, the app ships ${hex}`);
    }
  });

  test('every colour DESIGN.md names is a colour the theme ships', () => {
    // The table above is held row for row. This holds the REST of the document:
    // every six-digit hex anywhere in the prose, the captions, the illustration
    // notes. A doc that names a colour the app does not ship is a doc somebody
    // will build to, and F146 filed exactly that.
    //
    // Two hexes are deliberately not shipped, and they are pinned here by value
    // with the reason rather than quietly excluded by a pattern. Both are
    // colours the app STOPPED shipping, named in the prose so the doc records
    // why they left; a third one cannot join them without an edit to this list.
    const RETIRED: Record<string, string> = {
      '#94849F': 'the old inkFaint, 2.91 against the ground and under the mark floor',
      '#8A5BBF': 'the second, lighter label violet, 4.08 at 11.5pt bold',
    };
    const doc = readFileSync(join(SRC, '..', '..', '..', 'DESIGN.md'), 'utf8');
    const shipped = new Set(Object.values(tokens).map((hex) => hex.toUpperCase()));
    const palette = readFileSync(join(SRC, 'palette.ts'), 'utf8').toUpperCase();

    for (const [hex, why] of Object.entries(RETIRED)) {
      assert.ok(
        !shipped.has(hex.toUpperCase()) && !palette.includes(hex.toUpperCase()),
        `${hex} is listed as retired (${why}) but the app ships it; the doc is right and this list is stale`,
      );
    }

    const named = new Set([...doc.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0]!.toUpperCase()));
    assert.ok(named.size > 0, 'DESIGN.md names no colour at all, so this test is reading the wrong file');
    for (const hex of named) {
      if (RETIRED[hex] != null) continue;
      assert.ok(
        shipped.has(hex),
        `DESIGN.md names ${hex}, which no token in palette.ts ships; either the app lost a colour or the doc invented one`,
      );
    }
  });

  test('the splash and the icon background are the ground', () => {
    // Two hard-coded backgrounds sat outside the palette and would have flashed
    // the old lilac before every launch. Both are the ground now.
    const appJson = readFileSync(join(SRC, '..', 'app.json'), 'utf8');
    const backgrounds = [...appJson.matchAll(/"backgroundColor":\s*"(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1]!.toUpperCase());
    assert.ok(backgrounds.length >= 2, `app.json carries ${backgrounds.length} backgroundColor values, expected the splash and the icon`);
    for (const bg of backgrounds) {
      assert.equal(bg, paper.ground.toUpperCase(), 'a launch background is not the ground');
    }
  });
});
