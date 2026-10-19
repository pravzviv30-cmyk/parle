/**
 * The daily collection's own words and choices, out of the screen — Stage 3.
 *
 * The Saved tab used to open on an inventory line, "1,000 words and 1,000
 * phrases", above an empty list and a sentence sending the learner back to
 * Home. A count of what the app ships is not something a learner can do
 * anything with. So an empty Saved tab now leads with a few starters that can
 * be heard and saved right here, the inventory line moves to the two browsing
 * tabs where it describes what is being browsed, and each card says whether it
 * has tutor audio before anybody taps anything.
 *
 * No renderer here (docs/TESTING.md): the rules are pure functions and the two
 * files that draw them are read as text.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { DAILY_PHRASES } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { DAILY_ITEMS } from './catalogue.ts';
import { VOICED_PHRASE_IDS, VOICED_WORD_IDS } from './voicedSelection.ts';
import {
  AUDIO_NO,
  AUDIO_YES,
  LIBRARY_COPY,
  NO_MATCH,
  STARTER_NOTE,
  STARTER_TITLE,
  audioLine,
  inventoryLine,
  libraryItems,
  libraryLead,
  starterItems,
} from './libraryView.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const LIBRARY = stripComments(read('./DailyLibraryScreen.tsx')).replace(/\s+/g, ' ');
const CARD = stripComments(read('./DailyCard.tsx')).replace(/\s+/g, ' ');

describe('the daily collection leads with something to do — Stage 3', () => {
  test('an empty Saved tab leads with starters, and the inventory belongs to the browsing tabs', () => {
    assert.equal(libraryLead('saved', 0, ''), 'starter', 'an empty Saved tab does not offer anything to start with');
    assert.equal(libraryLead('saved', 0, '   '), 'starter', 'a blank search hides the starters');
    assert.equal(libraryLead('saved', 2, ''), 'none', 'somebody with saved items is shown starters over their own');
    assert.equal(libraryLead('saved', 0, 'café'), 'none', 'a search on an empty Saved tab answers with starters rather than the search');
    assert.equal(libraryLead('words', 0, ''), 'inventory', 'the words tab does not say what it holds');
    assert.equal(libraryLead('phrases', 3, 'x'), 'inventory', 'the phrases tab does not say what it holds');

    // The starters are ones that can be heard, so the first thing a learner
    // meets here plays in their tutor's voice, and the easiest tier.
    const starters = starterItems();
    assert.equal(starters.length, 3, 'the starter set is not a small handful');
    assert.deepEqual(starterItems().map((i) => i.id), starters.map((i) => i.id), 'the starters change between two reads');
    const tier = new Map(DAILY_PHRASES.map((p) => [p.id, p.tier]));
    for (const item of starters) {
      assert.ok(VOICED_PHRASE_IDS.includes(item.id), `${item.id} is a starter with no tutor audio`);
      assert.equal(tier.get(item.id), 1, `${item.id} is not a first-tier phrase`);
    }

    // The inventory is computed, not typed: the counts are what ships.
    const line = inventoryLine(VOICED_WORD_IDS.length, VOICED_PHRASE_IDS.length);
    const words = DAILY_ITEMS.filter((i) => i.id.startsWith('word:')).length;
    const phrases = DAILY_ITEMS.filter((i) => i.id.startsWith('phrase:')).length;
    assert.equal(line, `${words.toLocaleString('en-GB')} words and ${phrases.toLocaleString('en-GB')} phrases. Tutor audio is included for ${VOICED_WORD_IDS.length} words and ${VOICED_PHRASE_IDS.length} phrases.`);
  });

  test('search reads French and English, on every tab', () => {
    const sample = DAILY_ITEMS.find((i) => i.id.startsWith('phrase:'))!;
    const none = new Set<string>();
    assert.ok(libraryItems('phrases', none, sample.fr.slice(0, 6)).some((i) => i.id === sample.id), 'a French search misses the phrase');
    assert.ok(libraryItems('phrases', none, sample.en.toUpperCase()).some((i) => i.id === sample.id), 'an English search misses the phrase, or is case-sensitive');
    assert.equal(libraryItems('words', none, '').every((i) => i.id.startsWith('word:')), true, 'the words tab shows phrases');
    const saved = new Set([sample.id]);
    assert.deepEqual(libraryItems('saved', saved, '').map((i) => i.id), [sample.id], 'the Saved tab shows something the learner did not save');
    assert.deepEqual(libraryItems('saved', saved, 'zzzz-no-such-thing'), [], 'a search that matches nothing still returns saved items');
  });

  test('every card says whether it has tutor audio before it is tapped', () => {
    assert.equal(audioLine(true), AUDIO_YES);
    assert.equal(audioLine(false), AUDIO_NO);
    assert.notEqual(AUDIO_YES, AUDIO_NO);
    // A missing recording is not a promise about a future pack, and not the
    // learner's fault: it says what is true and what still works.
    assert.doesNotMatch(AUDIO_NO, /future|coming|soon|pack/i, 'the text-only line promises audio nobody has made');
    assert.match(AUDIO_NO, /record/i, 'the text-only line does not say what still works');

    for (const line of LIBRARY_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—/, `"${line}" carries an em dash`);
      assert.doesNotMatch(line, /\d/, `"${line}" counts something`);
    }
    for (const line of [AUDIO_YES, AUDIO_NO, STARTER_TITLE, STARTER_NOTE, NO_MATCH]) {
      assert.ok(LIBRARY_COPY.includes(line), `left out of the scanned list: ${line}`);
    }
  });

  test('the screen and the card draw these rules rather than their own', () => {
    // The screen: the lead is the module's, the starters are real cards, and
    // the inventory line is drawn only where the module says.
    assert.match(LIBRARY, /const lead = saved === null \? 'none' : libraryLead\(filter, saved\.size, query\);/, 'the screen decides its own lead or treats an unread list as empty');
    assert.match(LIBRARY, /const items = saved === null \? \[\] : libraryItems\(filter, saved, query\);/, 'the screen filters for itself');
    assert.match(LIBRARY, /loaded\?\.scope === scope \? loaded\.saved : null/, 'the previous account’s saved list can appear during a new read');
    assert.match(LIBRARY, /const unread = unreadScope === scope/, 'a previous account’s failed read must not become this account’s error state');
    assert.match(LIBRARY, /placeScope !== scope \? <Text/, 'a previous account’s search and page position must not render before their scoped state resets');
    assert.match(LIBRARY, /setFilter\(next\.filter\); setQuery\(next\.query\); setLimit\(next\.limit\); setPlaceScope\(scope\)/, 'search and page position are not restored for the new owner');
    assert.match(LIBRARY, /Retry saved items/, 'a failed read has no retry');
    assert.match(LIBRARY, /lead === 'inventory' && <Text[^>]*>\{inventoryLine\(VOICED_WORD_IDS\.length, VOICED_PHRASE_IDS\.length\)\}<\/Text>/, 'the inventory line is drawn on the Saved tab, or spelled in JSX');
    assert.match(LIBRARY, /lead === 'starter' && /, 'the starters are not drawn');
    assert.match(LIBRARY, /starterItems\(\)\.map\(item => <DailyCard /, 'the starters are not cards that can be heard and saved');
    assert.match(LIBRARY, /\{STARTER_TITLE\}/, 'the starter heading is spelled in JSX');
    assert.match(LIBRARY, /\{NO_MATCH\}/, 'an empty search says nothing');
    assert.ok(!LIBRARY.includes('1,000'), 'the inventory is typed into the screen again');
    assert.ok(!LIBRARY.includes('Save an item on Home'), 'the empty tab still sends the learner back to Home');
    assert.match(LIBRARY, /<Field [^>]*placeholder=\{SEARCH_PLACEHOLDER\}/, 'search is gone, or spells its own placeholder');

    // The card: the audio line is drawn from the manifest's answer, above the
    // buttons, and the old promise is gone.
    assert.match(CARD, /\{audioLine\(asset != null\)\}/, 'the card does not say whether it has tutor audio');
    assert.ok(CARD.indexOf('audioLine(asset != null)') < CARD.indexOf('label="Hear"'), 'the audio line is drawn below the button it describes');
    assert.ok(!CARD.includes('future pack'), 'the card still promises audio in a future pack');
  });
});

test('daily collection uses the chosen canvas without making its light controls unreadable', () => {
  assert.match(LIBRARY, /const \{ colors, mode \} = useMainAppearance\(\)/);
  assert.match(LIBRARY, /<ScrollScreen bottom="inset" ground=\{colors\.background\}/);
  assert.match(LIBRARY, /<ScreenHeader ink=\{colors\.text\} muted=\{colors\.muted\} title="Daily collection"/);
  const controls = LIBRARY.slice(LIBRARY.indexOf('<View style={{ backgroundColor: paper.card'), LIBRARY.indexOf('</View>'));
  assert.match(controls, /<TabBar appearance="underline"/);
  assert.match(controls, /<Field placeholder=\{SEARCH_PLACEHOLDER\}/);
  for (const label of ['Retry saved items', 'Previous page', 'Next page']) {
    const action = LIBRARY.slice(0, LIBRARY.indexOf(`label="${label}"`)).split('<IconAction').at(-1);
    assert.ok(action?.includes("ground={mode === 'dark' ? 'blue' : 'paper'}"), `${label} must remain readable on the dark canvas`);
  }
  assert.match(LIBRARY, /<Label color=\{colors\.muted\}>\{STARTER_TITLE\}/);
  assert.match(CARD, /type\.frenchLg, \{ color: paper\.ink \}/);
});
