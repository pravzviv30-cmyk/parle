/**
 * How long the wall is this time, and page two's one decision.
 *
 * The agreement test at the bottom is the one worth keeping. `WallPage` and
 * `WallEntry` are also the property values of two analytics events, and a funnel
 * split by a different set of doors than the code has is a funnel nobody can
 * read. The compiler cannot see that, because both sides are string literal
 * unions that happen to agree, so it is read out of the two files instead.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import { canBuy, endsOnPlans, wallPages, type WallEntry } from './wallPages.ts';

const HERE = new URL('.', import.meta.url);
const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, HERE)), 'utf8');

/** The literals one `field: 'a' | 'b'` declaration names, from either file. */
function literals(source: string, field: string): string[] {
  const match = new RegExp(`${field}: ('[^;]*')`).exec(source);
  assert.ok(match?.[1], `no ${field} union found`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((hit) => hit[1]!).sort();
}

describe('the wall is as long as it has something to show', () => {
  // 2026-09-27, notebook Phase 6-E: the wall went from four pages to two, what
  // you get and then the plans. These two replace "with a store there are four
  // pages, and the price is last" and "with no store there are three, and the
  // wall ends on the free promise", and are stricter: exactly two, never more.
  test('with a store there are two pages, what you get and then the price', () => {
    for (const entry of ['path-complete', 'refused', 'recap'] as const) {
      const pages = wallPages({ entry, storeHasPlans: true });
      assert.deepEqual([...pages], ['yours', 'plans'], `${entry} drew the wall at the wrong length`);
      assert.equal(canBuy(pages), true);
      assert.equal(endsOnPlans(pages), true);
    }
  });

  test('with no store there is one page, and the wall ends on the free promise', () => {
    // Web, Expo Go, and every build without a RevenueCat key. A page of appetite
    // ending in a button to nowhere would be worse than not opening the wall at
    // all, so the last word is the promise the page just made.
    for (const entry of ['path-complete', 'refused', 'recap'] as const) {
      const pages = wallPages({ entry, storeHasPlans: false });
      assert.deepEqual([...pages], ['yours'], `${entry} drew a page that cannot exist`);
      assert.equal(canBuy(pages), false);
      assert.equal(endsOnPlans(pages), false);
    }
  });

  test('no door ever draws more than two pages, or the retired map and French pages', () => {
    const doors: readonly WallEntry[] = ['path-complete', 'refused', 'settings', 'recap'];
    for (const entry of doors) {
      for (const storeHasPlans of [true, false]) {
        const pages = wallPages({ entry, storeHasPlans });
        assert.ok(pages.length <= 2, `${entry} drew ${pages.length} pages`);
        for (const retired of ['map', 'french']) {
          assert.ok(!pages.includes(retired as never), `${entry} drew the retired ${retired} page`);
        }
      }
    }
    // The frame no longer draws them either, so a page that came back into the
    // list would render nothing rather than an old four-page wall.
    const screen = read('./WallScreen.tsx');
    assert.doesNotMatch(screen, /<WallMapPage|<WallFrenchPage/, 'the frame still draws a retired page');
  });

  test('somebody who came to buy is not sold to', () => {
    // The Settings row opens the price directly. Walking a decided customer
    // through their own progress first is a pitch delivered to somebody who has
    // already said yes.
    assert.deepEqual([...wallPages({ entry: 'settings', storeHasPlans: true })], ['plans']);
    assert.deepEqual([...wallPages({ entry: 'settings', storeHasPlans: false })], []);
  });

  test('a missing store or failed load draws a recoverable state, never a blank page', () => {
    const screen = read('./WallScreen.tsx');
    assert.doesNotMatch(screen, /if \([^\n]*page === undefined[^\n]*\) return null/);
    assert.match(screen, /Plans aren’t available here yet\./);
    assert.match(screen, /header=\{<ScreenHeader back=\{\{ onPress: \(\) => leave\(\) \}\}/);
    assert.match(screen, /setRetry\(\(value\) => value \+ 1\)/);
    // 2026-09-27, notebook Phase 6-E: the map and French pages left, and with
    // them the wall's only disk read, so there is no progress load left to fail.
    // The store read is the one load, it still cannot leave a blank page, and the
    // wall now reads no progress at all, which is stricter than a failure path.
    assert.match(screen, /if \(unavailable \|\| loading\)/);
    assert.match(screen, /\.catch\(\(\) => \{[\s\S]*setOffering\(\{ available: false \}\)/);
    const code = screen.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const name of ['loadActivity', 'loadDeck', 'loadMissionCompletions', 'momentumFrom', 'missionStates']) {
      assert.doesNotMatch(code, new RegExp(`\\b${name}\\b`), `the wall reads ${name}, so a page could vary by progress`);
    }
  });

  test('no door draws a page that is not there, whatever the door', () => {
    const doors: readonly WallEntry[] = ['path-complete', 'refused', 'settings', 'recap'];
    for (const entry of doors) {
      for (const storeHasPlans of [true, false]) {
        const pages = wallPages({ entry, storeHasPlans });
        assert.equal(canBuy(pages), storeHasPlans && pages.length > 0);
        assert.equal(new Set(pages).size, pages.length, `${entry} drew the same page twice`);
      }
    }
  });

  test('the value pages never vary by what the learner has done', () => {
    // Page one is four rows for everybody and page two has a start line, so
    // nothing here takes a learner's progress as an input at all. The designs
    // this one beat both dropped their opening page for a thin learner, which
    // hands the weakest version of the wall to the cohort it most needs.
    const source = read('./wallPages.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const word of ['progress', 'deck', 'retained', 'timesFinished', 'momentum', 'hasEvidence']) {
      assert.doesNotMatch(source, new RegExp(word, 'i'), `the page list is reading ${word}`);
    }
  });
});

describe('the pages and the funnel name the same things', () => {
  test('WallPage and wall_page_seen name exactly the same pages', () => {
    const union = read('../analytics/track.ts');
    const declared = [...read('./wallPages.ts').matchAll(/export type WallPage = ([^;]+);/g)]
      .flatMap(([, body]) => [...body!.matchAll(/'([^']+)'/g)].map((hit) => hit[1]!))
      .sort();
    assert.deepEqual(declared, literals(union, 'page'), 'a page exists that the funnel cannot report');
  });

  test('WallEntry and wall_shown name exactly the same doors', () => {
    const union = read('../analytics/track.ts');
    const declared = [...read('./wallPages.ts').matchAll(/export type WallEntry = ([^;]+);/g)]
      .flatMap(([, body]) => [...body!.matchAll(/'([^']+)'/g)].map((hit) => hit[1]!))
      .sort();
    // `entry` appears twice in the union: mission_started has one too. The wall's
    // is the four-door one, so it is read off the wall_shown line rather than the
    // first match in the file.
    const wallShown = union.split('\n').find((line) => line.includes("name: 'wall_shown'"));
    assert.ok(wallShown, 'the union has no wall_shown variant');
    assert.deepEqual(declared, literals(wallShown, 'entry'), 'a door exists that the funnel cannot report');
  });
});
