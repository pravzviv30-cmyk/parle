import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { navigationWidth, screenInsets, screenGeometry, compactPhone, layoutClass, FOOTER_MAX } from './responsiveLayout.ts';

test('phone content respects left and right safe areas', () => {
  assert.deepEqual(screenInsets(390, 0, 0), { paddingLeft: 20, paddingRight: 20 });
  assert.deepEqual(screenInsets(700, 44, 12), { paddingLeft: 64, paddingRight: 32 });
  assert.deepEqual(screenInsets(390, 0, 0, false), { paddingLeft: 0, paddingRight: 0 });
});

test('short safe viewports and large text compress decoration before content', () => {
  assert.equal(compactPhone(375, 812, 44, 34), true);
  assert.equal(compactPhone(390, 844, 47, 34), false);
  assert.equal(compactPhone(430, 932, 59, 34, 1.8), true);
  assert.equal(compactPhone(812, 375, 0, 21), true);
});

test('iPhone-sized, landscape and unfamiliar viewports leave room for content and controls', () => {
  const viewports = [[320, 568], [375, 812], [390, 844], [393, 852], [402, 874], [414, 896], [430, 932], [440, 956], [812, 375], [700, 720]];
  for (const [width, height] of viewports) for (const fontScale of [1, 1.5, 2, 3]) {
    const insets = height! > width! ? { top: 59, bottom: 34, left: 0, right: 0 } : { top: 0, bottom: 21, left: 44, right: 44 };
    const frame = screenGeometry(width!, height!, insets, fontScale);
    assert.equal(frame.usableWidth, width! - insets.left - insets.right);
    assert.equal(frame.usableHeight, height! - insets.top - insets.bottom);
    assert.ok(frame.footerMaxHeight >= 44, 'primary controls keep a touch target');
    assert.ok(frame.footerMaxHeight <= frame.usableHeight * 0.45);
    assert.ok(frame.artMaxHeight <= frame.usableHeight * 0.3, 'art gives space to readable text');
    assert.ok(frame.usableHeight - frame.footerMaxHeight > 100, 'the body remains scrollable');
  }
});

test('iPad reading width is bounded and split view returns to phone geometry', () => {
  for (const width of [834, 1024, 1194, 1366]) {
    const inset = screenInsets(width, 0, 0);
    assert.equal(width - inset.paddingLeft - inset.paddingRight, 760);
  }
  assert.deepEqual(screenInsets(375, 0, 0), { paddingLeft: 20, paddingRight: 20 });
});

test('navigation stays compact on iPad and fits narrow phones', () => {
  assert.equal(navigationWidth(320, 0, 0), 304);
  assert.equal(navigationWidth(390, 0, 0), 374);
  assert.equal(navigationWidth(600, 44, 12), 528);
  assert.equal(navigationWidth(834, 0, 0), 640);
  assert.equal(navigationWidth(1366, 0, 0), 640);
});

test('app tab headers do not render the retired website masthead', () => {
  const layout = readFileSync(new URL('./layout.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(layout, /Le français, pour la vie\./);
  assert.doesNotMatch(layout, /Luvani · Your French journal/);
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /maxWidth: 460/, 'iPad must not be constrained by the retired phone-only shell');
});


test('regular columns follow usable width and return to a stack in split view', () => {
  assert.equal(layoutClass(699, 0, 0), 'compact');
  assert.equal(layoutClass(700, 0, 0), 'regular');
  assert.equal(layoutClass(744, 24, 24), 'compact');
  assert.equal(layoutClass(834, 0, 0), 'regular');
  assert.equal(layoutClass(390, 0, 0), 'compact');
  assert.equal(FOOTER_MAX, 480);
});


test('on a regular-width screen the tabs use two columns and sheets keep the reading width', () => {
  // M2/M3 keeps the learning narrative in one reading column; topic discovery
  // alone forms a grid and returns to a stack for narrow screens/large text.
  const explore=readFileSync(new URL('tabs/ExploreTab.tsx',import.meta.url),'utf8');
  assert.match(explore, /fontScale >= 1\.5/); assert.match(explore, /width < 350/);
  assert.match(explore, /frame=\{\[s\.topicFrame, single && s\.topicFrameSingle\]\}/);
  assert.match(explore, /topicFrame: \{ flexBasis: '47%'/);
  assert.match(explore, /topicFrameSingle: \{ width: '100%', flexBasis: 'auto'/);
  const main=readFileSync(new URL('main/MainUI.tsx',import.meta.url),'utf8');
  assert.match(main, /fontScale >= 1\.5/); assert.match(main, /compact && s\.featureStack/);
  assert.match(main, /<ScrollScreen/);
  const layout=readFileSync(new URL('layout.tsx',import.meta.url),'utf8');
  assert.match(layout,/flexDirection: regular \? 'row' : 'column'/);
  const components=readFileSync(new URL('components.tsx',import.meta.url),'utf8');
  assert.match(components,/maxWidth: READING/);
  });
