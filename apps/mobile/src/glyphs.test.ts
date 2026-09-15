/**
 * The glyph set, read as source — F589.
 *
 * There is no renderer in this workspace (docs/TESTING.md), so this is the
 * `motion.test.ts` idiom: walk the two files that hold the app's line-art marks,
 * strip the comments, and fail on the shapes that break the one-pen rule. The
 * ceiling is honest: it proves the marks are drawn at one weight and hidden from
 * assistive tech, never that a phone drew a cup.
 *
 * The place switch is checked against `packages/core`'s own union rather than a
 * list written here, because a seventh place added to the catalogue with no mark
 * to draw it is exactly the miss this test is for.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const FILES = [
  { name: 'glyphs.tsx', body: stripComments(read('./glyphs.tsx')) },
  { name: 'nav/icons.tsx', body: stripComments(read('./nav/icons.tsx')) },
];

const GLYPHS = FILES[0]!.body;

/** Every place a mission can happen in, taken from the catalogue's own union. */
const PLACES: string[] = (() => {
  const missions = read('../../../packages/core/src/missions/missions.ts');
  const at = missions.indexOf('export type MissionPlace');
  assert.notEqual(at, -1, 'MissionPlace has moved out of packages/core/src/missions/missions.ts');
  const union = missions.slice(at, missions.indexOf(';', at));
  return (union.match(/'[a-z]+'/g) ?? []).map((q) => q.slice(1, -1));
})();

describe('one pen drew every mark in the app — F589', () => {
  test('every glyph draws in the one stroke weight and hides from assistive technology', () => {
    assert.ok(PLACES.length >= 6, `the union parsed to ${PLACES.length} places, so the place check below asserts nothing`);

    for (const { name, body } of FILES) {
      const svgs = body.match(/<Svg[^>]*>/g) ?? [];
      assert.ok(svgs.length > 0, `${name} draws no Svg at all; this test is reading the wrong file`);
      for (const tag of svgs) {
        assert.ok(
          tag.includes('{...decorative}'),
          `${name} draws an Svg a screen reader will announce as an unlabelled image: ${tag}`,
        );
      }

      const weights = body.match(/strokeWidth=\{([^}]*)\}/g) ?? [];
      assert.ok(weights.length > 0, `${name} sets no stroke weight, so every mark is at the SVG default of 1`);
      for (const weight of weights) {
        assert.ok(
          weight.includes('STROKE'),
          `${name} writes its own stroke weight: ${weight}; the app has one pen and it is theme.ts's`,
        );
      }

      // A mark is a line drawing. The one solid allowed is a tiny accent inside
      // a mark that would read as a hole without it, and it takes the mark's own
      // colour rather than inventing a second one.
      const fills = (body.match(/fill=\{?"?[^\s>}]+"?\}?/g) ?? []).filter((f) => !f.startsWith('fill="none"'));
      assert.ok(
        fills.length <= 1 && fills.every((f) => f === 'fill={color}'),
        `${name} fills a glyph with something other than the mark's own colour: ${fills.join(', ')}`,
      );
    }
  });

  test('every place a conversation happens in has a mark of its own', () => {
    for (const place of PLACES) {
      assert.ok(
        GLYPHS.includes(`case '${place}':`),
        `PlaceGlyph has no case for ${place}, so that row's disc is drawn empty`,
      );
    }
    // And no stray default, which is how a missing case stops being a typecheck
    // failure and starts being a blank disc.
    assert.ok(!/default:/.test(GLYPHS), 'PlaceGlyph answers a place it does not know with a default instead of failing to compile');
  });

  test('the row glyphs the revamp asked for are all here, and the speaker is the ear again', () => {
    for (const glyph of [
      'ClockGlyph',
      'CoffeeCupGlyph',
      'ChatGlyph',
      'DocumentGlyph',
      'ReplayGlyph',
      'QuoteGlyph',
      'WaveformGlyph',
      'PlaceGlyph',
    ]) {
      assert.match(GLYPHS, new RegExp(`export function ${glyph}\\b`), `glyphs.tsx no longer draws ${glyph}`);
    }
    assert.match(
      GLYPHS,
      /export \{ EarGlyph as SpeakerGlyph \} from '\.\/components\.tsx'/,
      'the speaker is drawn a second time instead of being the ear the tutor already speaks through',
    );
    // The pair of chevrons stays together in components.tsx, beside the back one.
    assert.ok(!/export function ChevronRight\b/.test(GLYPHS), 'glyphs.tsx draws a second right chevron away from ChevronLeft');
  });
});
