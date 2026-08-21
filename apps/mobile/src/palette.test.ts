/**
 * The colour contract.
 *
 * `palette.ts` claims two things that are easy to say and easy to break later:
 * that every paper sits at one lightness, and that every accent stays clear of
 * every signal. Both are arithmetic, so both can be held here rather than in a
 * comment somebody will contradict with an eyedropper in six months.
 *
 * What this deliberately does NOT do is assert that every colour passes the
 * 4.5 floor for text. Two do not: inkFaint at 2.91 and signal.good at 3.64,
 * both of which are used as marks and as secondary type. Asserting a floor
 * they never met would mean a red suite on day one.
 *
 * The orb colours USED to be listed here as exemptions too, and that was the
 * mistake J2 fixed. They are marks, and a mark that reports state is held to 3,
 * not to 4.5 — so the honest thing was never an exemption, it was the right
 * floor. Amber measured 1.79 and red 2.79 against their own paper. Both are
 * asserted below now, and the captions that used to be set in them are ink.
 *
 * So the contract is: hard floors where the app clears them, the mark floor on
 * anything that reports state, and no regression anywhere else. Equal lightness
 * makes the last one free, which turns it into a real tripwire against a sixth
 * paper picked by eye.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { papers, accents, ink, paperFor, type Paper } from './palette.ts';

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

// ── the colours this palette has to live beside ───────────────────────────
// Copied in rather than imported, because theme.ts reaches react-native and
// this suite must never load it. If they drift apart, the drift is the finding.

const SIGNALS = {
  good: '#437A62',
  correspondance: '#8B5578',
  live: '#A9564F',
  rung1: '#D6A846',
  rung2: '#C8794A',
  rung3: '#5F95AA',
} as const;

/**
 * The voice circle's three words, which are NOT signals and never were.
 *
 * `orb.thinking` sat in the table above for a while and it does not belong
 * there: `signal.*` are the marks that appear inside a card, beside a label set
 * in that paper's accent, which is the adjacency the Delta-E rule below exists
 * to police. The orb is a hundred-point circle that owns its screen and never
 * shares one with an accent.
 *
 * Keeping it in the signals table had a cost, and the cost was the learner. The
 * only ambers far enough from `accents.bronze` to satisfy that rule sit around
 * L* 23 and read as dark olive; the one that satisfied it before was light
 * enough to measure 1.79 against its own paper. Legibility wins, and the orb
 * gets its own contract instead: the mark floor, and the three lights held
 * apart from each other and from rung one.
 */
const ORB = {
  speaking: SIGNALS.live,
  yourTurn: SIGNALS.good,
  thinking: '#8A6A2D',
  ready: accents.violet,
} as const;

const HOUSE = papers.house;
const ALL = Object.entries(papers) as [string, Paper][];

/** The inks whose ratio must not move when the paper changes. */
const CARRIED = { ...ink, ...SIGNALS, thinking: ORB.thinking, violet: accents.violet } as Record<string, string>;

describe('every paper is the same light', () => {
  test('all five grounds sit at L* 93.1', () => {
    for (const [name, p] of ALL) {
      const l = lab(p.ground).l;
      assert.ok(
        Math.abs(l - 93.12) < 0.4,
        `${name}'s ground is at L* ${l.toFixed(2)}, and every paper has to be 93.1 or contrast moves with it`,
      );
    }
  });

  test('groundDeep and line hold their own steps too', () => {
    for (const [name, p] of ALL) {
      assert.ok(Math.abs(lab(p.groundDeep).l - 86.63) < 0.4, `${name}'s groundDeep drifted`);
      assert.ok(Math.abs(lab(p.line).l - 82.67) < 0.6, `${name}'s line drifted`);
    }
  });

  test('no ink changes contrast by more than 1% when the paper changes', () => {
    for (const [key, colour] of Object.entries(CARRIED)) {
      if (key === 'card' || key === 'onInk' || key === 'lineOnCard') continue;
      const home = contrast(HOUSE.ground, colour);
      for (const [name, p] of ALL) {
        const here = contrast(p.ground, colour);
        const drift = Math.abs(here - home) / home;
        assert.ok(
          drift < 0.01,
          `${key} reads ${here.toFixed(2)} on ${name} but ${home.toFixed(2)} on house, a ${(drift * 100).toFixed(1)}% drift. Papers must not change how legible anything is.`,
        );
      }
    }
  });

  test('the papers whisper rather than repainting the app', () => {
    for (const [oneName, one] of ALL) {
      for (const [twoName, two] of ALL) {
        if (oneName >= twoName) continue;
        const d = deltaE(one.ground, two.ground);
        assert.ok(d >= 3, `${oneName} and ${twoName} collapsed into the same paper at ${d.toFixed(1)}`);
        assert.ok(d <= 16, `${oneName} and ${twoName} are ${d.toFixed(1)} apart and read like different products`);
      }
    }
  });
});

describe('the floors the app already clears', () => {
  const FLOORS: Record<string, number> = {
    ink: 7,
    inkSoft: 4.5,
    correspondance: 4.5,
    violet: 4.5,
  };

  test('ink, soft ink, the fix colour and the violet all hold on every paper', () => {
    for (const [key, floor] of Object.entries(FLOORS)) {
      const colour = CARRIED[key];
      assert.ok(colour, `${key} is not a colour this palette carries`);
      for (const [name, p] of ALL) {
        const r = contrast(p.ground, colour);
        assert.ok(r >= floor, `${key} is ${r.toFixed(2)} on ${name}, under its floor of ${floor}`);
      }
    }
  });

  test('ink still holds on a filled chip', () => {
    for (const [name, p] of ALL) {
      const r = contrast(p.groundDeep, ink.ink);
      assert.ok(r >= 7, `ink is only ${r.toFixed(2)} on ${name}'s chip fill`);
    }
  });
});

describe('an accent is typographic, so it must never read as a signal', () => {
  test('every accent clears 4.5 on its own paper', () => {
    for (const [name, p] of ALL) {
      const r = contrast(p.ground, p.accent);
      assert.ok(r >= 4.5, `${name}'s accent is ${r.toFixed(2)}, under the small-text floor`);
    }
  });

  test('every accent still holds on its own chip fill', () => {
    for (const [name, p] of ALL) {
      const r = contrast(p.groundDeep, p.accent);
      assert.ok(r >= 4, `${name}'s accent is ${r.toFixed(2)} on its own chip`);
    }
  });

  test('every accent beats the label violet it replaces', () => {
    const OLD_LABEL = '#8A5BBF';
    for (const [name, p] of ALL) {
      assert.ok(
        contrast(p.ground, p.accent) > contrast(p.ground, OLD_LABEL),
        `${name}'s accent is no better than the 4.08 it was brought in to fix`,
      );
    }
  });

  test('no accent comes within a Delta-E of 30 of any signal or rung', () => {
    const shipped = [...new Set(ALL.map(([, room]) => room.accent))];
    for (const [aName, a] of shipped.entries()) {
      for (const [sName, s] of Object.entries(SIGNALS)) {
        const d = deltaE(a, s);
        assert.ok(
          d >= 30,
          `${aName} is only ${d.toFixed(0)} from ${sName}. Green means go and red means listen, and a label that looks like either one makes the app lie.`,
        );
      }
    }
  });

  test('every room shares the same identity accent', () => {
    for (const [name, room] of ALL) {
      assert.equal(room.accent, accents.violet, `${name} introduced a competing identity colour`);
    }
  });
});

describe('which place gets which light', () => {
  test('the house paper is still the lilac the app already had', () => {
    assert.equal(HOUSE.ground, '#F3E8F3');
    assert.equal(HOUSE.groundDeep, '#E4D3EE');
    assert.equal(HOUSE.line, '#D9C8E2');
    assert.equal(HOUSE.accent, '#6B3FA0');
  });

  test('the authored units are pinned', () => {
    assert.equal(paperFor('cafe'), papers.sand);
    assert.equal(paperFor('amis'), papers.sage);
    assert.equal(paperFor('practice'), papers.sky);
    assert.equal(paperFor('review'), papers.sky);
  });

  test('anything unrecognised falls back to the house paper', () => {
    assert.equal(paperFor(null), HOUSE);
    assert.equal(paperFor(undefined), HOUSE);
    assert.equal(paperFor(''), HOUSE);
    assert.equal(paperFor('mine:recent'), HOUSE);
    assert.equal(paperFor('something nobody wrote'), HOUSE);
  });

  test('a learner topic gets a colour and keeps it', () => {
    const id = 'topic:le-marche';
    const first = paperFor(id);
    assert.equal(paperFor(id), first, 'a topic that changed colour between launches reads as a different topic');
    assert.notEqual(first, HOUSE, 'a topic is a subject, so it gets a subject colour');
  });

  test('learner topics do not all land on one colour', () => {
    const ids = ['topic:le-marche', 'topic:mon-travail', 'topic:la-famille', 'topic:les-vacances', 'topic:le-sport'];
    const seen = new Set(ids.map((id) => paperFor(id).ground));
    assert.ok(seen.size > 1, 'the hash put every topic on the same paper');
  });
});

describe('the voice circle is legible — J2', () => {
  /**
   * A mark that reports state is a graphical object, and the floor for one is
   * 3 against whatever it sits on. Words are held to 4.5. Conflating the two is
   * what let "One moment" ship at 1.79: the caption took the mark's colour, so
   * it quietly inherited the mark's floor.
   */
  const MARK_FLOOR = 3;

  test('every orb state is legible as a mark against its own paper', () => {
    for (const [name, hex] of Object.entries(ORB)) {
      const ratio = contrast(hex, HOUSE.ground);
      assert.ok(ratio >= MARK_FLOOR, `orb.${name} is ${ratio.toFixed(2)} on house, below the ${MARK_FLOOR} floor for a mark`);
    }
  });

  test('an orb caption is words, so it is held to the floor for words', () => {
    // The captions are set in ink for exactly this reason. Two of the three
    // state colours cannot carry text on this paper and never could.
    assert.ok(contrast(ink.ink, HOUSE.ground) >= 4.5, 'the caption ink itself has to clear the floor for text');
    assert.ok(
      contrast(ORB.thinking, HOUSE.ground) < 4.5,
      'if amber ever clears the text floor this test is stale, not the code',
    );
  });

  test('the three traffic lights stay far apart, and none of them is rung one', () => {
    const lights = [ORB.speaking, ORB.yourTurn, ORB.thinking];
    for (let i = 0; i < lights.length; i += 1) {
      for (let j = i + 1; j < lights.length; j += 1) {
        assert.ok(deltaE(lights[i]!, lights[j]!) >= 30, `two of the tutor's three words are the same colour`);
      }
      assert.ok(
        deltaE(lights[i]!, SIGNALS.rung1) >= 20,
        `a traffic light reads as rung one's yellow, which lives one screen away`,
      );
    }
  });

  test('the copied orb values still match what theme.ts actually ships', () => {
    // theme.ts reaches react-native and this suite must never load it, so the
    // values above are copies. This is what keeps a copy from becoming a lie.
    const source = readFileSync(join(SRC, 'theme.ts'), 'utf8');
    for (const [name, hex] of Object.entries(ORB)) {
      if (name === 'ready') continue; // an alias for accent.primary, asserted elsewhere
      assert.ok(source.includes(hex), `theme.ts no longer ships ${hex} for orb.${name}; the copy above is stale`);
    }
  });
});

describe('a paper that nothing renders is not shipped — J11', () => {
  /**
   * The whole five-paper system had zero application callers while DESIGN.md
   * described where each one is used, complete with a "Where" column naming
   * the cafe arc and Entre amis. Roughly three hundred and seventy lines of
   * tested arithmetic defending colours nobody could see, and a design document
   * that read as a plan rather than a record.
   *
   * This is the lock, in both directions: a paper is shipped when a screen asks
   * for it by calling paperFor, and DESIGN.md's table has to agree.
   */
  const shipped = (() => {
    const calls = new Set<string>();
    for (const file of walk(join(SRC))) {
      if (file.includes('.test.')) continue;
      for (const m of readFileSync(file, 'utf8').matchAll(/paperFor\(\s*'([^']+)'\s*\)/g)) {
        calls.add(m[1]!);
      }
    }
    const names = new Set<string>();
    for (const id of calls) {
      const resolved = paperFor(id);
      for (const [name, p] of Object.entries(papers)) {
        if (p.ground === resolved.ground) names.add(name);
      }
    }
    // House does not go through paperFor and never needed to: it is the flat
    // `paper` spread in theme.ts that thirty-odd modules read directly, which
    // is the default light of the whole app.
    for (const file of walk(join(SRC))) {
      if (file.includes('.test.')) continue;
      if (/\bpaper\.ground\b/.test(readFileSync(file, 'utf8'))) {
        names.add('house');
        break;
      }
    }
    return names;
  })();

  const designTable = (() => {
    const doc = readFileSync(join(SRC, '..', '..', '..', 'DESIGN.md'), 'utf8');
    const rows = new Map<string, string>();
    for (const m of doc.matchAll(/^\|\s*`(house|sand|sage|lagoon|sky)`\s*\|(?:[^|]*\|){3}[^|]*\|([^|]*)\|/gm)) {
      rows.set(m[1]!, m[2]!.trim());
    }
    return rows;
  })();

  test('at least one screen asks for its own light', () => {
    assert.ok(shipped.size > 1, 'nothing calls paperFor, so the whole system is still decoration');
  });

  test('DESIGN.md marks every paper no screen renders', () => {
    assert.equal(designTable.size, Object.keys(papers).length, 'the DESIGN.md paper table no longer lists every paper');
    for (const name of Object.keys(papers)) {
      const where = designTable.get(name)!;
      const claimsUnshipped = /not shipped/i.test(where);
      if (shipped.has(name)) {
        assert.ok(!claimsUnshipped, `${name} is rendered by a screen but DESIGN.md says it is not shipped`);
      } else {
        assert.ok(claimsUnshipped, `nothing renders ${name}, and DESIGN.md claims it is used: "${where}"`);
      }
    }
  });
});
