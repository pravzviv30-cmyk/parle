/**
 * The icon cleaner, `scripts/icons/svg.mjs`, held from Node.
 *
 * It is pure (no file I/O, no clock), so the whole of what it promises can be
 * shown on small sources written here: the same source always makes the same
 * component, each cleanup step does what the spec says (docs/come-alive/
 * icons-layout.md 1.2), and every hard failure throws rather than guessing.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { IconError, clean, cleanPath, formatNumber, parseSvg, toTsx } from '../../../../scripts/icons/svg.mjs';

const HEADER = '// header';
const svg = (body: string, box = '0 0 24 24') =>
  `<svg width="24" height="24" viewBox="${box}" fill="none" xmlns="http://www.w3.org/2000/svg"> ${body} </svg>`;
const run = (source: string, options: Parameters<typeof clean>[2] = {}) => clean(parseSvg(source, 'case'), 'case', options);
const file = (source: string, options: Parameters<typeof clean>[2] = {}) => toTsx({ name: 'case-icon', header: HEADER, drawings: { linear: run(source, options) } });

const ICONSAX_LIKE = svg(
  [
    '<g clip-path="url(#clip0_1)">',
    '<path d="M9.57 5.92969L3.5 11.9997L9.57 18.0697" stroke="white" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>',
    '<path d="M9.57 5.92969L3.5 11.9997L9.57 18.0697" stroke="white" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>',
    '<path opacity="0.4" d="M2 2H22V22H2Z" fill="white"/>',
    '<g opacity="0.4"><path d="M1 1h1v1H1Z" fill="#292D32"/></g>',
    '</g>',
    '<defs><clipPath id="clip0_1"><rect width="24" height="24" fill="white"/></clipPath></defs>',
  ].join(' '),
);

describe('the icon cleaner — F726', () => {
  test('the icon cleaner turns the same source into the same component every time', () => {
    const first = file(ICONSAX_LIKE);
    const second = file(ICONSAX_LIKE);
    assert.equal(first, second, 'two runs over one source wrote two different files');

    // 1 and 2: the frame, the clip and its defs are gone, and the empty group is unwrapped.
    assert.doesNotMatch(first, /clip|defs|xmlns|width="24"|<G>/, 'the clip, its definition or the empty group survived');
    assert.equal((first.match(/<G\b/g) ?? []).length, 1, 'the clip group was kept beside the second-layer group');
    // 3 and 6: camelCase props, and every stroke is the one pen.
    assert.match(first, /strokeWidth=\{STROKE\} strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit=\{10\}/);
    assert.doesNotMatch(first, /stroke-width|1\.5/, 'the source stroke width survived');
    // 4: numbers rounded to three places, trailing zeros stripped.
    assert.match(first, /d="M9\.57 5\.93L3\.5 12L9\.57 18\.07"/, 'path numbers were not rounded');
    // A path drawn twice is drawn once.
    assert.equal((first.match(/M9\.57 5\.93/g) ?? []).length, 1, 'a repeated path was kept twice');
    // 5: the mark is the caller's colour; the second layer is `secondary` at the shared opacity, on a path or a group.
    assert.match(first, /fill="none" stroke=\{color\}/, 'a stroked mark lost its explicit fill="none"');
    assert.match(first, /<Path d="M2 2H22V22H2Z" fill=\{secondary\} opacity=\{SECONDARY_OPACITY\} \/>/);
    assert.match(first, /<G opacity=\{SECONDARY_OPACITY\}>\s*<Path d="M1 1h1v1H1Z" fill=\{secondary\} \/>/);
    assert.match(first, /import \{ SECONDARY_OPACITY, type IconDrawings \} from '\.\/drawing\.ts';/);
    // The drawing is one decorative Svg on the 24 box.
    assert.match(first, /<Svg width=\{size\} height=\{size\} viewBox="0 0 24 24" \{\.\.\.decorative\}>/);
    assert.ok(first.startsWith(`${HEADER}\n`), 'the header is not the first line');
    assert.match(first, /export const CaseIcon: IconDrawings = \{/);

    // 7: a configured rotate wraps the drawing in one group.
    assert.match(file(svg('<path d="M6 12H18" stroke="white" stroke-width="1.5"/>'), { rotate: 45 }), /<G transform="rotate\(45 12 12\)">/);
    // A source on a smaller box is moved onto the 24 box only when told how.
    assert.match(file(svg('<path d="M0 0H16" stroke="white" stroke-width="1.5"/>', '0 0 16 20'), { translate: [4, 2] }), /<G transform="translate\(4 2\)">/);
    // 8: parts split the top-level marks, each still a whole Svg on the box.
    const parted = run(svg('<path d="M1 1H2" stroke="white"/><path d="M3 3H4" stroke="white"/><path d="M5 5H6" stroke="white"/>'), {
      parts: { body: [0], arcs: [1, 2] },
    });
    assert.deepEqual(Object.keys(parted.parts ?? {}), ['body', 'arcs']);
    assert.equal(parted.parts?.arcs?.length, 2);

    // Number formatting and arc flags are read the way a renderer reads them.
    assert.equal(formatNumber(-0.0001), '0');
    assert.equal(formatNumber(1.23456), '1.235');
    assert.equal(cleanPath('case', 'M1 1a1 1 0 011 1'), 'M1 1a1 1 0 0 1 1 1');
  });

  test('the icon cleaner refuses what a flat token-coloured mark may not carry', () => {
    const refuses = (source: string, pattern: RegExp, options: Parameters<typeof clean>[2] = {}) =>
      assert.throws(() => run(source, options), (error: unknown) => error instanceof IconError && pattern.test(error.message));
    refuses(svg('<text>hi</text>'), /cannot read|effect|may not draw/);
    refuses(svg('<linearGradient id="g"/><path d="M1 1H2" stroke="white"/>'), /gradient/);
    refuses(svg('<path d="M1 1H2" fill="url(#g)"/>'), /url\(\)/);
    refuses(svg('<path d="M1 1H2" fill="#FF0000"/>'), /colour the cleaner does not know/);
    refuses(svg('<ellipse cx="1" cy="1" rx="1" ry="1" fill="white"/>'), /may not draw/);
    refuses(svg('<path d="M1 1H2" stroke="white" filter="blur"/>'), /does not know/);
    refuses(svg('<path d="M1 1H2" fill="white" opacity="0.8"/>'), /neither the mark/);
    refuses(svg('<path d="M1 1H2" stroke="white"/>', '0 0 16 20'), /16 by 20 box/);
    refuses(svg('<path d="M1 1H2" stroke="white"/>'), /names element 3/, { parts: { body: [3] } });
    refuses(svg('<path d="M1 1H2" stroke="white"/><path d="M3 3H4" stroke="white"/>'), /in both/, { parts: { a: [0], b: [0, 1] } });
    refuses(svg('<path d="M1 1H2" stroke="white"/><path d="M3 3H4" stroke="white"/>'), /leave out element 1/, { parts: { a: [0] } });
    refuses(svg('<path d="M1 1H2"/>'), /draws nothing/);
    refuses('<svg viewBox="0 0 24 24"><path d="M1 1H2" stroke="white"/>', /never closed/);
  });
});
