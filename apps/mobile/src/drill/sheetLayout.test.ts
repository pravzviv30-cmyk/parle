/**
 * A waiting sheet's Continue is always on screen (drill B v2): the sheet is
 * capped, its body scrolls under the cap, and Continue sits outside that
 * scroll, at 320x640 and at accessibility-large text alike.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SHEET_BODY_FLOOR, SHEET_MIN, sheetMaxHeight } from './sheetLayout.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8').replace(/\s+/g, ' ');

describe('sheetLayout', () => {
  test('the cap leaves the exercise a floor and never drops under a headline and Continue', () => {
    for (const usable of [480, 568, 640, 700, 812, 932]) {
      const cap = sheetMaxHeight(usable);
      assert.ok(cap >= SHEET_MIN, `${usable}: cap ${cap} under the minimum`);
      assert.ok(usable - cap >= SHEET_BODY_FLOOR || cap === SHEET_MIN, `${usable}: cap ${cap} leaves no room for the exercise`);
    }
    // 320x640 with no insets: room for the miss sheet's headline, French, Notice, after-line and Continue.
    assert.ok(sheetMaxHeight(640) >= 400);
    assert.equal(sheetMaxHeight(100), SHEET_MIN);
  });

  test('the frame lifts the footer cap to the sheet cap, and the sheet scrolls its body with Continue outside it', () => {
    const frame = read('./DrillFrame.tsx');
    assert.match(frame, /footerMaxHeight=\{sheet != null \? sheetCap : undefined\}/, 'the frame leaves the sheet under the generic footer cap');
    assert.match(frame, /<Foot\.Provider value=\{\{ inset: insets\.bottom, maxHeight: sheetCap \}\}>/);
    const sheet = read('./AnswerSheet.tsx');
    assert.match(sheet, /maxHeight: foot\.maxHeight/, 'the sheet grows past the cap');
    const scroll = sheet.indexOf('<ScrollView');
    const close = sheet.indexOf('</ScrollView>');
    const cont = sheet.indexOf('<PillButton ref={continueRef}');
    assert.ok(scroll > 0 && close > scroll, 'the sheet body does not scroll');
    assert.ok(cont > close, 'Continue scrolls with the body instead of staying pinned');
    assert.match(sheet, /scroll: \{ flexGrow: 0, flexShrink: 1, minHeight: 0 \}/, 'the body cannot shrink under the cap');
    const layout = read('../layout.tsx');
    assert.match(layout, /maxHeight: footerMaxHeight \?\? geometry\.footerMaxHeight/);
  });
});
