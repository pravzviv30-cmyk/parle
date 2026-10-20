/**
 * The colour contract.
 *
 * Luvani, bright (revamp B): one warm paper ground, white cards, one deep ink
 * and four saturated colours, blue, coral, sun and mint. Every raw value lives
 * in `palette.ts`, which imports nothing, so this suite can hold the whole
 * palette to a numeric contract rather than to a comment somebody will
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

import { paper, colour, pastel, accent, highlight, signal, orb, onOrb, rungColor, lilac, textOn, onColour, segmentPending, streakCelebration, mainApp, boldRhythm, liftInk, b } from './palette.ts';

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
    assert.match(theme, /export\s*\{[^}]*\bstreakCelebration\b[^}]*\}\s*from\s*'\.\/palette\.ts'/);
  });

  test('no six-digit hex is written anywhere in source but palette.ts', () => {
    // The whole app repaints through the tokens alone, which is only true while
    // no screen spells a colour of its own. So every production file under src,
    // and App.tsx beside it, is walked with its comments stripped; a comment may
    // name a colour, code may not.
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const files = [...walk(SRC), join(SRC, '..', 'App.tsx')];
    assert.ok(files.length > 50, `the walk found ${files.length} files, so it is reading the wrong folder`);
    for (const file of files) {
      if (/\.test\.tsx?$/.test(file)) continue;
      if (file === join(SRC, 'palette.ts')) continue;
      const rel = file.slice(join(SRC, '..').length + 1);
      const hexes = strip(readFileSync(file, 'utf8')).match(/#[0-9a-fA-F]{6}\b/g) ?? [];
      assert.deepEqual(hexes, [], `${rel} writes raw hex: ${hexes.join(', ')}; every colour lives in palette.ts`);
    }
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

  test('the B paper is pinned: one ground, one white, one ink, one hairline', () => {
    // STYLE section 4, the founder's revamp B. Pinned by value so a re-tint is a
    // deliberate edit to this line, not a drift. B has one ground, one white,
    // one ink, one soft ink and one hairline, so the old names that asked for a
    // second of any of them are aliases of the one, and pinned as aliases.
    assert.equal(paper.ground, '#FFF6E9');
    assert.equal(paper.skeleton, '#EFE6D6');
    assert.equal(paper.groundDeep, paper.skeleton, 'groundDeep is a second wash; B has only the skeleton');
    assert.equal(paper.card, '#FFFFFF');
    assert.equal(paper.ink, '#16123A');
    assert.equal(paper.inkSoft, '#5C5A74');
    assert.equal(paper.inkFaint, paper.inkSoft, 'inkFaint is a third ink; B has two');
    // Direction B consolidation (DECISIONS.md, 2026-10-19): #EADFCB and the C2
    // border #DCD2C4 fold into one hairline, and the C2 sand becomes the inset.
    assert.equal(paper.line, '#F0E6D6');
    assert.equal(paper.inset, '#F5EEE2');
    assert.equal(paper.inkOnPastel, '#4A4766');
    assert.equal(paper.lineOnCard, paper.line, 'lineOnCard is a second hairline; B has one');
    assert.equal(paper.onInk, '#FFFFFF');
    // Revamp B stage 2: the input border and the unchosen ring. A mark, so it
    // is held to the mark floor on the white it sits on, and never letters words.
    assert.equal(paper.field, '#8A8499');
    assert.ok(contrast(paper.field, CARD) >= MARK, `the field border is ${contrast(paper.field, CARD).toFixed(2)} on a card, under the ${MARK} floor for a mark`);
  });

  test('the card still reads as a card, and the hairlines still read on the ground', () => {
    // Lightness no longer carries the safety argument — one ground means there
    // is nothing for it to hold still against. The steps are held by Delta-E
    // instead: the card lifts off the ground, each hairline separates from what
    // it rules, and groundDeep sits between the two.
    assert.ok(deltaE(GROUND, paper.groundDeep) >= 5, `groundDeep is only ${deltaE(GROUND, paper.groundDeep).toFixed(1)} off the ground`);
    // DECISIONS.md, 2026-10-19: the founder chose a softer hairline (#F0E6D6,
    // 5.8 off the ground). A hairline is decorative and never the only edge of
    // a control, so its floor on the ground drops from 8 to 5; on the card it
    // still clears 6.
    assert.ok(deltaE(GROUND, paper.line) >= 5, `the ground hairline is only ${deltaE(GROUND, paper.line).toFixed(1)} off the ground`);
    assert.ok(deltaE(CARD, GROUND) >= 4, `the card is only ${deltaE(CARD, GROUND).toFixed(1)} off the ground`);
    assert.ok(deltaE(CARD, paper.lineOnCard) >= 6, `the card hairline is only ${deltaE(CARD, paper.lineOnCard).toFixed(1)} off the card`);
  });

  test('faint ink is soft ink now: B has no third ink, so it clears the text floor on the ground and on a card', () => {
    // inkFaint letters placeholders and counts as well as the inactive tab
    // glyph, so it is words as often as it is a mark. B has no third ink, and
    // aliasing it to soft ink is the one value that keeps every existing use
    // above the floor for words, which is stricter than the mark floor it used
    // to be held to.
    assert.equal(paper.inkFaint, paper.inkSoft, 'inkFaint drifted off soft ink into a third ink');
    assert.ok(
      contrast(paper.inkFaint, GROUND) >= TEXT,
      `inkFaint is ${contrast(paper.inkFaint, GROUND).toFixed(2)} on the ground, under the ${TEXT} floor for words`,
    );
    assert.ok(
      contrast(paper.inkFaint, CARD) >= TEXT,
      `inkFaint is ${contrast(paper.inkFaint, CARD).toFixed(2)} on a card, under the ${TEXT} floor for words`,
    );
  });

  test('ink, soft ink, the fix colour and the primary ink all hold on the ground', () => {
    assert.ok(contrast(INK, GROUND) >= 7, `ink is ${contrast(INK, GROUND).toFixed(2)} on the ground`);
    assert.ok(contrast(INK, paper.groundDeep) >= 7, `ink is ${contrast(INK, paper.groundDeep).toFixed(2)} on a chip fill`);
    assert.ok(contrast(paper.inkSoft, GROUND) >= TEXT, `inkSoft is ${contrast(paper.inkSoft, GROUND).toFixed(2)} on the ground`);
    assert.ok(contrast(signal.correspondance, GROUND) >= TEXT, `the fix colour is ${contrast(signal.correspondance, GROUND).toFixed(2)} on the ground`);
    assert.ok(contrast(accent.primary, GROUND) >= TEXT, `the primary ink is ${contrast(accent.primary, GROUND).toFixed(2)} on the ground`);
    assert.ok(contrast(accent.primary, paper.groundDeep) >= 4, `the primary ink is ${contrast(accent.primary, paper.groundDeep).toFixed(2)} on a chip fill`);
    assert.ok(contrast(accent.label, GROUND) >= TEXT, `the label accent is ${contrast(accent.label, GROUND).toFixed(2)} on the ground`);
    assert.ok(contrast(accent.brand, GROUND) >= TEXT, `the brand blue is ${contrast(accent.brand, GROUND).toFixed(2)} on the ground`);
    for (const ground of [streakCelebration.ground, streakCelebration.cream, streakCelebration.gold]) {
      assert.ok(contrast(streakCelebration.ink, ground) >= TEXT, `streak ink is ${contrast(streakCelebration.ink, ground).toFixed(2)} on ${ground}, under the text floor`);
    }
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

describe('direction B: one token set, old names alias it — DECISIONS.md 2026-10-19', () => {
  test('the new tokens are pinned', () => {
    assert.equal(colour.bluePressed, '#2A20B0');
    assert.equal(colour.mintWash, '#D4F5E5');
    assert.equal(colour.mintWords, '#1F7A52');
    // B0 (2026-10-20): the ring and the second violet from the v82 artboards.
    assert.equal(colour.ring, '#D9CFE9');
    assert.equal(colour.violet2, '#5A50EA');
    assert.deepEqual({ ...pastel }, { butter: '#FFE8AB', lavender: '#E9E3FA', peach: '#F7D8C7', sage: '#D4E2D7' });
    assert.equal(liftInk, 'rgba(22, 18, 58, 0.45)');
  });

  test('the C2 and Luvani-theme names are aliases of the one value', () => {
    assert.equal(boldRhythm.muted, paper.inkSoft);
    assert.equal(boldRhythm.line, paper.line);
    assert.equal(boldRhythm.sand, paper.inset);
    assert.equal(mainApp.light.muted, paper.inkSoft);
    assert.equal(mainApp.light.border, paper.line);
    for (const name of ['butter', 'lavender', 'peach', 'sage'] as const) assert.equal(boldRhythm[name], pastel[name]);
  });

  test('the new text pairs clear the text floor', () => {
    const pairs: [string, string, string][] = [
      ['inkOnPastel on lavender', paper.inkOnPastel, pastel.lavender],
      ['inkOnPastel on butter', paper.inkOnPastel, pastel.butter],
      ['inkOnPastel on peach', paper.inkOnPastel, pastel.peach],
      ['inkOnPastel on sage', paper.inkOnPastel, pastel.sage],
      ['mintWords on a card', colour.mintWords, CARD],
      ['mintWords on the mint wash', colour.mintWords, colour.mintWash],
      ['ink on the mint wash', INK, colour.mintWash],
      ['inkSoft on the inset', paper.inkSoft, paper.inset],
      ['white on pressed blue', paper.onInk, colour.bluePressed],
      // B0 (2026-10-20): white words on the violet2 chip, and the lock badge's
      // blue words on its lavender pill and its white disc.
      ['white on violet2', paper.onInk, colour.violet2],
      ['blue on lavender (lock pill)', colour.blue, pastel.lavender],
      ['blue on a card (lock badge)', colour.blue, CARD],
    ];
    for (const [name, fg, bg] of pairs) {
      assert.ok(contrast(fg, bg) >= TEXT, `${name} is ${contrast(fg, bg).toFixed(2)}, under the ${TEXT} floor`);
    }
  });
});

describe('B0 tokens keep to their roles (2026-10-20)', () => {
  test('the ring is decoration only: under the mark floor on a card, so it never edges a control', () => {
    const r = contrast(colour.ring, CARD);
    assert.ok(r < MARK, `the ring is ${r.toFixed(2)} on a card; if it clears ${MARK} the decorative-only rule needs a rethink`);
    assert.ok(r > 1.2 && r < 1.6, `the ring is ${r.toFixed(2)} on a card, not the documented ~1.4`);
  });

  test('violet2 never sits behind the blue ground\'s soft words', () => {
    // onColour.blue on violet2 is under the text floor, which is why DESIGN.md
    // says white words only on a violet2 chip.
    assert.ok(contrast(onColour.blue, colour.violet2) < TEXT, 'onColour.blue now clears the floor on violet2; revisit the rule');
    assert.ok(contrast(paper.onInk, colour.violet2) >= TEXT);
  });

  test('#E4E0FF is folded into onColour.blue: no near-duplicate is written in palette.ts', () => {
    const src = readFileSync(join(SRC, 'palette.ts'), 'utf8');
    assert.doesNotMatch(src, /#E4E0FF/i);
    assert.equal(onColour.blue, '#E4E1FF');
  });
});

describe('signals are held to what they are — F322', () => {
  test('good and the fix colour are ink, so the words that carry them clear the floor by being ink', () => {
    // Both are set as words in about two dozen places. B carries meaning in the
    // words and puts colour only on marks, so both signals are the ink itself.
    assert.equal(signal.good, paper.ink, 'signal.good is a colour again, so the words it letters are held to that colour');
    assert.equal(signal.correspondance, paper.ink, 'the fix colour is a colour again, so the words it letters are held to that colour');
    for (const [name, hex] of [['good', signal.good], ['the fix colour', signal.correspondance]] as const) {
      assert.ok(contrast(hex, GROUND) >= TEXT, `${name} is ${contrast(hex, GROUND).toFixed(2)} on the ground`);
      assert.ok(contrast(hex, CARD) >= TEXT, `${name} is ${contrast(hex, CARD).toFixed(2)} on a card`);
    }
  });

  test('the tutor\'s coral is a mark, so it clears 3 on the ground and on a card', () => {
    // Coral is the orb reporting "the tutor is speaking" and never carries words,
    // so it is held to the mark floor. The caption beside it is ink.
    assert.equal(signal.live, colour.coral, 'the tutor\'s mark is no longer the coral');
    assert.ok(contrast(signal.live, GROUND) >= MARK, `the coral is ${contrast(signal.live, GROUND).toFixed(2)} on the ground`);
    assert.ok(contrast(signal.live, CARD) >= MARK, `the coral is ${contrast(signal.live, CARD).toFixed(2)} on a card`);
  });

  test('the mic glyph still reads on a live ink circle', () => {
    // The SpeakCircle fills with signal.good while the learner's mic is open and
    // draws the microphone in onInk. signal.good is ink in B, so the fill is an
    // ink disc until the stage that redraws the circle; the glyph is a mark on it.
    assert.ok(contrast(paper.onInk, signal.good) >= MARK, `the mic glyph is ${contrast(paper.onInk, signal.good).toFixed(2)} on the live fill`);
  });

  test('the one signal mark stays 30 from ink, the rung fill, the ground and the card', () => {
    // good and the fix colour are both ink now, so holding every signal 30 from
    // every other is impossible by design. The one signal that is still a
    // colour, the tutor's coral, is held 30 from everything it could be taken
    // for: the ink the other two signals are, the rung fill, and the paper.
    const rivals: Record<string, string> = {
      ink: paper.ink,
      'the rung fill': rungColor[1],
      'the ground': GROUND,
      'a card': CARD,
    };
    for (const [name, hex] of Object.entries(rivals)) {
      const d = deltaE(signal.live, hex);
      assert.ok(d >= APART, `the tutor's mark is only ${d.toFixed(0)} from ${name}`);
    }
  });

  test('the brand blue never reads as an orb state, the highlighter, the rung fill or the tutor\'s mark', () => {
    // Mint means your turn and coral means listen; a brand moment the colour of
    // either makes the app lie. The primary and the labels are ink, and ink is
    // not a state, so the one colour accent that could be taken for one is the
    // brand blue, and it is held 30 from every state, the pen and the rung fill.
    assert.equal(accent.primary, paper.ink, 'the primary action is no longer ink');
    assert.equal(accent.label, paper.ink, 'the labels are no longer ink');
    const rivals: Record<string, string> = {
      'orb.speaking': orb.speaking,
      'orb.yourTurn': orb.yourTurn,
      'orb.thinking': orb.thinking,
      highlight,
      'the rung fill': rungColor[1],
      'the tutor\'s mark': signal.live,
    };
    for (const [name, hex] of Object.entries(rivals)) {
      const d = deltaE(accent.brand, hex);
      assert.ok(d >= APART, `the brand blue is only ${d.toFixed(0)} from ${name}`);
    }
  });
});

describe('retired palette aliases stay absent', () => {

  test('the retired feature alias is absent from the palette', () => {
    assert.ok(!Object.hasOwn(accent, 'feature'), 'the retired accent.feature alias must not return');
    assert.ok(contrast(INK, paper.card) >= 7);
    assert.ok(contrast(paper.inkSoft, paper.card) >= TEXT);
    assert.ok(contrast(accent.primary, paper.onInk) >= TEXT);
    for (const value of Object.values(orb)) assert.ok(deltaE(paper.card, value) >= APART);
  });

  test('the palette exports no retired tint tokens or raw tint colours', () => {
    const source = readFileSync(join(SRC, 'palette.ts'), 'utf8');
    assert.doesNotMatch(source, /export\s+(?:const\s+tint|type\s+TintName)\b/);
    assert.doesNotMatch(source, /#(?:FEE7DB|F8D8DF|E4D3EE|CFF3EB|E8EED5|D5EFFE)\b/i);
  });
});

describe('the voice circle is legible — F323', () => {
  test('every orb state carries a glyph that clears the text floor on its own fill', () => {
    // Mint and sun are far too light to be a mark on paper (1.85 and 1.43), so
    // the fill is never the only thing that says the state. Each state carries a
    // glyph, the bars and the embedded status, in the colour onOrb pairs with
    // it, and that glyph is held to the floor for words on its own fill. The
    // coral and the ink ready disc still clear the mark floor on the ground.
    assert.deepEqual(Object.keys(onOrb), Object.keys(orb), 'an orb state has no glyph colour, or a glyph colour has no state');
    for (const state of Object.keys(orb) as (keyof typeof orb)[]) {
      const r = contrast(onOrb[state], orb[state]);
      assert.ok(r >= TEXT, `the glyph on orb.${state} is ${r.toFixed(2)}, below the ${TEXT} floor for words`);
    }
    assert.ok(contrast(orb.ready, GROUND) >= MARK, `the ready orb is ${contrast(orb.ready, GROUND).toFixed(2)} on the ground`);
    assert.ok(contrast(orb.speaking, GROUND) >= MARK, `the speaking orb is ${contrast(orb.speaking, GROUND).toFixed(2)} on the ground`);
  });

  test('the three traffic lights stay far apart, and none of them is the rung fill', () => {
    // The rung fill lives one screen away, so the separation from it is held to
    // the full 30. The three lights stay 30 from each other, and each is the B
    // colour STYLE section 7 gives it.
    assert.equal(orb.speaking, colour.coral, 'the tutor speaking is no longer coral');
    assert.equal(orb.yourTurn, colour.mint, 'your turn is no longer mint');
    assert.equal(orb.thinking, colour.sun, 'thinking is no longer sun');
    assert.equal(orb.ready, paper.ink, 'ready is no longer ink');
    const lights = [orb.speaking, orb.yourTurn, orb.thinking];
    for (let i = 0; i < lights.length; i += 1) {
      for (let j = i + 1; j < lights.length; j += 1) {
        assert.ok(deltaE(lights[i]!, lights[j]!) >= APART, `two of the tutor's three words are the same colour`);
      }
      assert.ok(
        deltaE(lights[i]!, rungColor[1]) >= APART,
        `a traffic light is only ${deltaE(lights[i]!, rungColor[1]).toFixed(0)} from the rung fill`,
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

/**
 * The STYLE colours the B parts draw — revamp B stage 2, F597.
 *
 * Stage 1 shipped the four colours and nothing else, so an unused value could
 * not be built to. Stage 2 is the stage that first draws each of these: the
 * field border and the unchosen ring, the secondary line on each ground, the
 * pending story segments, and the lilac the flat drawings use. Each is pinned
 * by value, each word pairing is held to the floor for words, and the lilac is
 * held to the drawings by a walk, because ILLUSTRATIONS.md allows it there and
 * nowhere else.
 */
describe('the STYLE colours the parts draw — F597', () => {
  test('the STYLE colours the parts draw are in the palette: the field border, the secondary on each ground, the pending segments, and lilac is drawn only by the flat illustrations', () => {
    // The nine new values, STYLE section 4 and SNIPPETS, by value.
    assert.equal(paper.field, '#8A8499');
    assert.equal(lilac, '#B9A7FF');
    assert.equal(onColour.blue, '#E4E1FF');
    assert.equal(onColour.sun, '#3E3A56');
    assert.equal(onColour.mint, '#3E3A56');
    assert.equal(onColour.ink, '#C9C6DE');
    assert.equal(segmentPending.blue, '#7F78EB');
    assert.equal(segmentPending.coral, '#E47F6F');
    assert.equal(segmentPending.sun, '#D0A43C');
    assert.equal(segmentPending.mint, '#2AAB7B');

    // The secondary line is words, so it clears 4.5 on its own ground. Coral
    // has one text colour, white.
    for (const [ground, fill] of [
      ['blue', colour.blue],
      ['coral', colour.coral],
      ['sun', colour.sun],
      ['mint', colour.mint],
      ['ink', paper.ink],
    ] as const) {
      const r = contrast(onColour[ground], fill);
      assert.ok(r >= TEXT, `the secondary line on ${ground} is ${r.toFixed(2)}, under the ${TEXT} floor for words`);
    }
    assert.equal(onColour.coral, paper.onInk, 'coral grew a second text colour; STYLE gives it white only');

    // The words on each ground are STYLE's column: white on blue and coral,
    // ink on sun and mint, never the forbidden other way round.
    assert.deepEqual(
      { ...textOn },
      { blue: paper.onInk, coral: paper.onInk, sun: paper.ink, mint: paper.ink },
      'the text on a colour ground is not STYLE section 4\'s pairing',
    );
    for (const ground of ['blue', 'coral', 'sun', 'mint'] as const) {
      const r = contrast(textOn[ground], colour[ground]);
      assert.ok(r >= TEXT, `the words on ${ground} are ${r.toFixed(2)}, under the ${TEXT} floor`);
    }

    // On paper the pending segment is the one hairline, not a sixth value.
    assert.equal(segmentPending.paper, paper.line, 'the pending segment on paper is a second hairline');
    assert.deepEqual(Object.keys(segmentPending).sort(), ['blue', 'coral', 'mint', 'paper', 'sun'], 'a ground has no pending segment colour');

    // ILLUSTRATIONS.md: "lilac #B9A7FF is allowed here and nowhere else".
    const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const drawers: string[] = [];
    for (const file of walk(SRC)) {
      if (/\.test\.tsx?$/.test(file)) continue;
      const rel = file.slice(SRC.length);
      if (!/\blilac\b/.test(strip(readFileSync(file, 'utf8')))) continue;
      // The founder-approved Explore illustration geometry (ported from
      // ce1fa976) uses the palette-owned lilac; MainIllustrationArt.test.ts
      // compares every shape and colour to the exact source SVGs.
      if (rel === 'palette.ts' || rel === 'theme.ts' || rel.startsWith('art/flat/') || rel === 'illustrations/MainIllustrationArt.ts') continue;
      drawers.push(rel);
    }
    assert.deepEqual(drawers, [], `lilac is drawn outside the flat illustrations: ${drawers.join(', ')}`);
  });
});

describe('the rungs share one fill, and the words say which rung — F324', () => {
  // A rung colour is a FILL under an ink numeral, not a state mark. That is why
  // it is NOT held to 3 against the ground the way an orb light is: nothing reads
  // it against the ground, an ink numeral reads against it. So its floor is that
  // ink clears the text floor on the fill, plus that the fill lifts off the paper
  // and is never mistaken for ink, a signal, an orb state or the highlighter.
  test('a rung numeral in ink clears 4.5 on its own fill', () => {
    for (const rung of [1, 2, 3] as const) {
      const r = contrast(INK, rungColor[rung]);
      assert.ok(r >= TEXT, `the numeral on rung ${rung} is ${r.toFixed(2)} on its own fill`);
    }
    // Rung four is ink, so its numeral is onInk instead.
    assert.ok(contrast(paper.onInk, rungColor[4]) >= TEXT, `the numeral on rung four is ${contrast(paper.onInk, rungColor[4]).toFixed(2)} on its ink fill`);
  });

  test('rungs one to three share the one skeleton fill and rung four is ink', () => {
    // B puts no fourth, fifth and sixth colour on the rungs: the numeral and the
    // words in rungLabel say which rung it is. Rung four is still plain ink, no
    // line left to follow.
    for (const rung of [1, 2, 3] as const) {
      assert.equal(rungColor[rung], paper.skeleton, `rung ${rung} is not the skeleton fill`);
    }
    assert.equal(rungColor[4], INK, 'rung four is no longer plain ink');
  });

  test('the rung fill lifts off the ground and the card, and never reads as ink, a signal, an orb state or the highlighter', () => {
    // The fill is a quiet step off the paper, held to the same floors as the
    // card and the pressed wash: 5 off the ground, 6 off a card. Everything that
    // means something else is held the full 30 away.
    const fill = rungColor[1];
    assert.ok(deltaE(fill, GROUND) >= 5, `the rung fill is only ${deltaE(fill, GROUND).toFixed(1)} off the ground`);
    assert.ok(deltaE(fill, CARD) >= 6, `the rung fill is only ${deltaE(fill, CARD).toFixed(1)} off a card`);
    const rivals: Record<string, string> = {
      ink: INK,
      "the tutor's mark": signal.live,
      'orb.speaking': orb.speaking,
      'orb.yourTurn': orb.yourTurn,
      'orb.thinking': orb.thinking,
      highlight,
    };
    for (const [name, hex] of Object.entries(rivals)) {
      const d = deltaE(fill, hex);
      assert.ok(d >= APART, `the rung fill is only ${d.toFixed(0)} from ${name}`);
    }
  });
});

describe('the identity ink does its jobs — F325, F326', () => {
  test('pill lettering clears 4.5 on the primary ink, the brand blue and the coral', () => {
    // The pill and the active tab are both onInk on accent.primary, and B puts a
    // white button on a blue or coral ground. White on each is words.
    assert.ok(
      contrast(paper.onInk, accent.primary) >= TEXT,
      `pill lettering is ${contrast(paper.onInk, accent.primary).toFixed(2)} on the primary ink`,
    );
    assert.ok(
      contrast(paper.onInk, accent.brand) >= TEXT,
      `white is ${contrast(paper.onInk, accent.brand).toFixed(2)} on the brand blue`,
    );
    assert.ok(
      contrast(paper.onInk, colour.coral) >= TEXT,
      `white is ${contrast(paper.onInk, colour.coral).toFixed(2)} on the coral`,
    );
  });

  test('the micro-label and the primary are one ink', () => {
    // There is one identity ink. This is the tripwire against a second one
    // creeping back in as a "lighter label" the way #8A5BBF once did. The brand
    // is the blue, and it is pinned to it so a second brand cannot creep in.
    assert.equal(accent.label, accent.primary);
    assert.equal(accent.brand, colour.blue);
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

  test('no source uses the retired accent.feature alias', () => {
    const retired = /\baccent\s*(?:\.\s*feature\b|\[\s*['"]feature['"]\s*\])/;
    for (const spelling of ['accent.feature', "accent['feature']", 'accent [ "feature" ]']) assert.match(spelling, retired);
    for (const file of walk(SRC)) {
      if (/\.test\.tsx?$/.test(file)) continue;
      const rel = file.slice(SRC.length);
      const body = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      assert.doesNotMatch(body, retired, `${rel} uses the retired feature alias`);
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
  // Revamp B: the four colours and the orb's glyph pairing, recorded like the rest.
  for (const [k, v] of Object.entries(colour)) tokens[`colour.${k}`] = v;
  // Direction B (DECISIONS.md UI-005): the four pastels are recorded like the rest.
  for (const [k, v] of Object.entries(pastel)) tokens[`pastel.${k}`] = v;
  for (const [k, v] of Object.entries(signal)) tokens[`signal.${k}`] = v;
  for (const [k, v] of Object.entries(orb)) tokens[`orb.${k}`] = v;
  for (const [k, v] of Object.entries(onOrb)) tokens[`onOrb.${k}`] = v;
  for (const k of [1, 2, 3, 4] as const) tokens[`rungColor[${k}]`] = rungColor[k];
  // Revamp B stage 2: what sits on each colour ground, the pending story
  // segments, and the illustrations' lilac, recorded like the rest.
  tokens.lilac = lilac;
  for (const [k, v] of Object.entries(textOn)) tokens[`textOn.${k}`] = v;
  for (const [k, v] of Object.entries(onColour)) tokens[`onColour.${k}`] = v;
  for (const [k, v] of Object.entries(segmentPending)) tokens[`segmentPending.${k}`] = v;
  // The scoped streak palette participates in the same complete documentation contract.
  for (const [k, v] of Object.entries(streakCelebration)) tokens[`streakCelebration.${k}`] = v;
  // UI-008 (2026-10-20): both B token sets are recorded like the rest; the
  // status bar style is a word, not a colour, so it has no row.
  for (const mode of ['light', 'dark'] as const) {
    for (const [k, v] of Object.entries(b[mode])) if (k !== 'statusBar') tokens[`b.${mode}.${k}`] = v;
  }

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

  test('the launch background is the brand blue wherever it is painted, and the app beneath stays on the ground', () => {
    // F328 held both app.json backgrounds to the ground so nothing outside the
    // palette could flash before a launch. F790 (2026-10-06) moved the launch
    // onto Hum, which is the brand blue from the icon to the splash to the
    // launch screen, so the rule is now the same one aimed at the blue: every
    // launch background is one palette colour, and the screen that fades into
    // the app fades onto the ground, which is where the app has always lived.
    const appJson = readFileSync(join(SRC, '..', 'app.json'), 'utf8');
    const backgrounds = [...appJson.matchAll(/"backgroundColor":\s*"(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1]!.toUpperCase());
    assert.ok(backgrounds.length >= 2, `app.json carries ${backgrounds.length} backgroundColor values, expected the splash and the icon`);
    for (const bg of backgrounds) {
      assert.equal(bg, colour.blue.toUpperCase(), 'a launch background is not the brand blue');
    }
    const launch = readFileSync(join(SRC, 'launch', 'LaunchScreen.tsx'), 'utf8');
    assert.match(launch, /backgroundColor: colour\.blue/, 'the launch screen is not on the brand blue the native launch shows');
    const app = readFileSync(join(SRC, '..', 'App.tsx'), 'utf8');
    assert.match(app, /app: \{ flex: 1, backgroundColor: paper\.ground \}/, 'the app beneath the launch is not on the ground');
  });
});

/**
 * Direction B's semantic tokens in both modes (DECISIONS.md UI-008,
 * 2026-10-20). Light is the artboards and must equal what the parts drew
 * before they read the theme, so a pinned-light screen cannot change by a
 * pixel. Dark is the Figma M3 page and is held to the same floors.
 */
describe('B tokens, light and dark — UI-008', () => {
  test('b.light is exactly the shipped light values, so a pinned screen draws as it did', () => {
    const t = b.light;
    const same: [keyof typeof t, string][] = [
      ['ground', paper.ground], ['card', paper.card], ['inset', paper.inset], ['line', paper.line],
      ['text', paper.ink], ['muted', paper.inkSoft], ['secondary', paper.inkOnPastel], ['field', paper.field],
      ['skeleton', paper.skeleton], ['brand', colour.blue], ['brandPressed', colour.bluePressed], ['onBrand', paper.onInk],
      ['onBrandSoft', onColour.blue], ['violet2', colour.violet2], ['periwinkle', lilac], ['ring', colour.ring],
      ['sun', colour.sun], ['mint', colour.mint], ['mintWash', colour.mintWash], ['mintWords', colour.mintWords],
      ['coral', colour.coral], ['butter', pastel.butter], ['lavender', pastel.lavender], ['peach', pastel.peach],
      ['sage', pastel.sage], ['heroGround', colour.sun], ['heroText', paper.ink], ['heroCta', paper.ink],
      ['heroCtaText', paper.onInk], ['heroChip', paper.card], ['primary', accent.primary], ['onPrimary', paper.onInk],
      ['quiet', paper.inset], ['link', colour.blue], ['avatar', paper.ink], ['onAvatar', paper.onInk], ['scrim', paper.ink],
      ['danger', mainApp.light.danger], ['tabCapsule', paper.ink], ['tabSelected', colour.blue], ['tabGlyphSelected', colour.sun],
      ['tabLabel', paper.ground],
    ];
    for (const [key, value] of same) assert.equal(t[key], value, `b.light.${key} drifted from the value the parts drew before UI-008`);
    assert.equal(t.violetDeep, '#2E24B8', 'the deep violet is not the artboards\' Live and Welcome value');
    assert.equal(t.statusBar, 'dark');
    assert.deepEqual(Object.keys(b.dark).sort(), Object.keys(b.light).sort(), 'the two modes do not name the same tokens');
  });

  test('b.dark follows the Figma M3 page: the main app dark values, violet kept, the hero turned', () => {
    const t = b.dark;
    const m3: [keyof typeof t, string][] = [
      ['ground', mainApp.dark.background], ['card', mainApp.dark.surface], ['inset', mainApp.dark.inset], ['line', mainApp.dark.border],
      ['text', mainApp.dark.text], ['muted', mainApp.dark.muted], ['butter', mainApp.dark.ochre], ['lavender', mainApp.dark.plum],
      ['peach', mainApp.dark.rose], ['sage', mainApp.dark.teal], ['mintWash', mainApp.dark.teal], ['heroGround', mainApp.dark.hero],
      ['link', mainApp.dark.link], ['ring', mainApp.dark.border], ['quiet', mainApp.dark.inset], ['danger', mainApp.dark.danger],
    ];
    for (const [key, value] of m3) assert.equal(t[key], value, `b.dark.${key} is not the M3 value`);
    // M3 keeps the violet as the accent, turns the ink pill violet, and gives
    // the hero a gold button with ink words and cream text.
    assert.equal(t.brand, colour.blue);
    assert.equal(t.primary, colour.blue);
    assert.equal(t.heroCta, colour.sun);
    assert.equal(t.heroCtaText, paper.ink);
    assert.equal(t.heroText, paper.ground);
    assert.equal(t.tabCapsule, paper.ink, 'the tab capsule is ink in both modes (Figma 292:1103)');
    assert.equal(t.statusBar, 'light');
  });

  for (const mode of ['light', 'dark'] as const) {
    test(`${mode}: every text pair clears ${TEXT}, and every mark clears ${MARK}`, () => {
      const t = b[mode];
      const pairs: [string, string, string][] = [];
      for (const fg of ['text', 'muted', 'secondary'] as const) {
        for (const bg of ['ground', 'card', 'inset', 'quiet', 'butter', 'lavender', 'peach', 'sage', 'mintWash'] as const) {
          pairs.push([`${fg} on ${bg}`, t[fg], t[bg]]);
        }
      }
      pairs.push(
        ['onBrand on brand', t.onBrand, t.brand],
        ['onBrandSoft on brand', t.onBrandSoft, t.brand],
        ['onBrand on brandPressed', t.onBrand, t.brandPressed],
        ['heroText on heroGround', t.heroText, t.heroGround],
        ['heroText on heroChip', t.heroText, t.heroChip],
        ['heroCtaText on heroCta', t.heroCtaText, t.heroCta],
        ['link on ground', t.link, t.ground],
        ['link on card', t.link, t.card],
        ['link on lavender (the lock badge)', t.link, t.lavender],
        ['mintWords on mintWash', t.mintWords, t.mintWash],
        ['mintWords on card', t.mintWords, t.card],
        ['onPrimary on primary', t.onPrimary, t.primary],
        ['onAvatar on avatar', t.onAvatar, t.avatar],
        ['tabLabel on tabCapsule', t.tabLabel, t.tabCapsule],
        ['tabLabel on tabSelected', t.tabLabel, t.tabSelected],
        ['danger on ground', t.danger, t.ground],
        ['danger on card', t.danger, t.card],
      );
      for (const [name, fg, bg] of pairs) {
        const r = contrast(fg, bg);
        assert.ok(r >= TEXT, `${mode} ${name} is ${r.toFixed(2)}, under the ${TEXT} floor for words`);
      }
      const marks: [string, string, string][] = [
        ['field on card', t.field, t.card],
        ['field on ground', t.field, t.ground],
        // 2026-10-20 UI-008, artboard B-Today: the tick and the star stroke on mint.
        ['onMint on mint', t.onMint, t.mint],
        ['the selected glyph on its cell', t.tabGlyphSelected, t.tabSelected],
        ['an unselected glyph on the capsule', t.tabLabel, t.tabCapsule],
      ];
      for (const [name, fg, bg] of marks) {
        const r = contrast(fg, bg);
        assert.ok(r >= MARK, `${mode} ${name} is ${r.toFixed(2)}, under the ${MARK} floor for a mark`);
      }
    });
  }
});

describe('main appearance premium roles', () => {
  for (const mode of ['light', 'dark'] as const) {
    const c = mainApp[mode];
    test(`${mode}: link and danger read on background and surface; text reads on selected`, () => {
      for (const role of ['link', 'danger'] as const) {
        for (const ground of ['background', 'surface'] as const) {
          const r = contrast(c[role], c[ground]);
          assert.ok(r >= 4.5, `${mode} ${role} is ${r.toFixed(2)} on ${ground}`);
        }
      }
      const r = contrast(c.text, c.selected);
      assert.ok(r >= 4.5, `${mode} text is ${r.toFixed(2)} on selected`);
    });
  }
});
