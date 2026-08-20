/**
 * The colour contract.
 *
 * `palette.ts` claims two things that are easy to say and easy to break later:
 * that every paper sits at one lightness, and that every accent stays clear of
 * every signal. Both are arithmetic, so both can be held here rather than in a
 * comment somebody will contradict with an eyedropper in six months.
 *
 * What this deliberately does NOT do is assert that every colour passes WCAG.
 * Four of them do not, and did not before any of this work: inkFaint at 2.91,
 * signal.good at 3.64, the old label violet at 4.08, and orb.thinking at 1.79.
 * Asserting a floor they never met would mean either a red suite on day one or
 * quietly changing a colour the tutor intro teaches a learner by name. So the
 * contract is: hard floors where the app already clears them, and no
 * regression anywhere else. Equal lightness makes the second one free, which
 * turns it into a real tripwire against a sixth paper picked by eye.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { papers, accents, ink, paperFor, type Paper } from './palette.ts';

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
  good: '#1E8A5B',
  correspondance: '#B4008A',
  live: '#FF4B3E',
  thinking: '#E3A800',
  rung1: '#FFCD00',
  rung2: '#FF7E2E',
  rung3: '#6EC4E8',
} as const;

const HOUSE = papers.house;
const ALL = Object.entries(papers) as [string, Paper][];

/** The inks whose ratio must not move when the paper changes. */
const CARRIED = { ...ink, ...SIGNALS, violet: accents.violet } as Record<string, string>;

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

  test('the papers are far enough apart to tell apart', () => {
    for (const [oneName, one] of ALL) {
      for (const [twoName, two] of ALL) {
        if (oneName >= twoName) continue;
        const d = deltaE(one.ground, two.ground);
        assert.ok(d >= 10, `${oneName} and ${twoName} are only ${d.toFixed(1)} apart`);
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
    for (const [aName, a] of Object.entries(accents)) {
      for (const [sName, s] of Object.entries(SIGNALS)) {
        const d = deltaE(a, s);
        assert.ok(
          d >= 30,
          `${aName} is only ${d.toFixed(0)} from ${sName}. Green means go and red means listen, and a label that looks like either one makes the app lie.`,
        );
      }
    }
  });

  test('the accents are distinguishable from each other', () => {
    for (const [oneName, one] of Object.entries(accents)) {
      for (const [twoName, two] of Object.entries(accents)) {
        if (oneName >= twoName) continue;
        const d = deltaE(one, two);
        assert.ok(d >= 20, `${oneName} and ${twoName} are only ${d.toFixed(0)} apart`);
      }
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
