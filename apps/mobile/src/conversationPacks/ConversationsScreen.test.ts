/**
 * The Conversations route, read as source — F574.
 *
 * The archive left the foot of Practice for a screen of its own, and the pack
 * library came with it. Two things are worth holding. The delete flow is passed
 * through rather than rebuilt, because a second confirmation is how two of them
 * come to disagree about what a learner just agreed to. And the feed is drawn
 * once: `archiveFrom` is built out of the same packs the library lists, so a
 * page that drew both would show the same conversations twice.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import {
  CONVERSATIONS_PURPOSE,
  CONVERSATIONS_TITLE,
  LIBRARY_LABEL,
  LIBRARY_LINE,
  libraryDoorLabel,
} from './conversationsView.ts';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const SCREEN = stripComments(read('./ConversationsScreen.tsx'));
const FLAT = SCREEN.replace(/\s+/g, ' ');
const LIBRARY = stripComments(read('./ConversationPackLibrary.tsx'));

describe('your conversations, as a route of its own — F574', () => {
  test('the conversations screen carries the feed, the filters and the delete flow', () => {
    // The three pieces that left Practice, each still drawn by the component
    // that owns it and fed by the module that decided it.
    assert.match(FLAT, /setArchive\(archiveFrom\(\{ packs: marked, deck, now: Date\.now\(\) \}\)\)/, 'the screen builds the archive itself instead of asking archive.ts');
    assert.match(FLAT, /<SessionFilters filters=\{archive\.filters\} active=\{filter\} onChange=\{setFilter\} \/>/, 'the filter chips are gone, or no longer draw the filters archive.ts handed over');
    assert.match(FLAT, /archive\.filters\.length > 0 &&/, 'the filter row is drawn before it would do any work');
    assert.match(FLAT, /<VaultCard vault=\{archive\.vault\} \/>/, 'the counts-in-words card is gone');
    assert.match(FLAT, /archive\.vault !== null &&/, 'the vault card is drawn from an unanswered read, so a first morning is shown to somebody who has had thirty conversations');
    assert.match(FLAT, /const shown = archive === null \? \[\] : sessionsUnder\(archive, filter\)/, 'the screen filters the feed itself instead of asking archive.ts');
    assert.match(FLAT, /<SessionRow key=\{session\.id\} session=\{session\}/, 'the feed no longer draws the shared session card');
    assert.match(FLAT, /onRevisit=\{\(\) => nav\.navigate\('ConversationPractice', \{ packId: session.id \}\)/, 'a feed row must open practice from that saved conversation');

    // The whole delete flow, handed to the library rather than written twice.
    assert.match(FLAT, /<ConversationPackLibrary packs=\{packs\}/, 'the library is gone, so the detail view and the delete flow are unreachable');
    for (const handler of ['onDeleteOne', 'onDeleteAll', 'onReview', 'onContinue', 'onBack']) {
      assert.ok(SCREEN.includes(`${handler}=`), `the library is mounted without ${handler}, so that door is dead`);
    }
    assert.match(FLAT, /deleteConversationPackForLearner\(user, adapter, pack\.id\)/, 'deleting one conversation no longer goes through the learner-scoped store');
    assert.match(FLAT, /deleteAllConversationPacksForLearner\(user, adapter\)/, 'deleting every conversation no longer goes through the learner-scoped store');
    // Passed through, never copied: the confirmations, the busy words and the
    // refusal message all stay in the one file that has always owned them.
    assert.match(LIBRARY, /Delete all curated Tutor conversations\?/, 'the library lost the delete-all confirmation this screen relies on');
    for (const copied of ['Delete this conversation', 'Keep conversations', 'Delete all conversations']) {
      assert.ok(!SCREEN.includes(copied), `the screen writes "${copied}" itself, so there are two delete flows to keep in step`);
    }

    // Android's hardware back closes the sub-view rather than popping the whole
    // route out from under the learner (F312).
    assert.match(FLAT, /useHardwareBack\(showingLibrary, \(\) => setShowingLibrary\(false\)\)/, 'the hardware back pops the route while the library is open');
  });

  test('the screen says what it is for without counting, and the door says what is behind it', () => {
    for (const line of [CONVERSATIONS_TITLE, CONVERSATIONS_PURPOSE, LIBRARY_LABEL, LIBRARY_LINE]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /\d/, `"${line}" counts something; the only count on this screen is the vault's, in words`);
      assert.doesNotMatch(line, /—/, `"${line}" carries an em dash`);
    }
    // Named rather than implied. A learner looking for the way to delete
    // something should not have to guess which euphemism we chose.
    assert.match(LIBRARY_LINE, /delete/, 'the door into the delete flow does not mention deleting');
    assert.equal(libraryDoorLabel(), `${LIBRARY_LABEL}. ${LIBRARY_LINE}`, 'the door reaches a screen reader as two loose lines');
    assert.match(FLAT, /accessibilityLabel=\{libraryDoorLabel\(\)\}/, 'the door names itself, or does not name itself at all');
    for (const typed of ["'Your conversations'", "'Return to any of them.'"]) {
      assert.ok(!SCREEN.includes(typed), `the screen types ${typed} itself, so nothing can read the copy back`);
    }
  });

  test('the route wears the one frame and shows one way back', () => {
    assert.equal((SCREEN.match(/<ScrollScreen\b/g) ?? []).length, 1, 'the route is not built on the shared scrolling frame');
    assert.equal((SCREEN.match(/<ScreenHeader\b/g) ?? []).length, 1, 'a pushed screen shows exactly one way back');
    assert.match(FLAT, /<ScreenHeader back=\{\{ onPress: onBack \}\} \/>/, 'the header is not the shared back');
    for (const own of ['useSafeAreaInsets', '<ScrollView', '<ChevronLeft', 'accessibilityLabel="Back"']) {
      assert.ok(!SCREEN.includes(own), `the route re-derives ${own} instead of taking it from the frame`);
    }
    for (const raw of ['fontSize', 'fontFamily', 'lineHeight']) {
      assert.ok(!SCREEN.includes(raw), `the route writes ${raw} itself; the type scale lives in theme.ts`);
    }
    assert.doesNotMatch(SCREEN, /#[0-9A-Fa-f]{6}/, 'the route writes a raw colour; every hex lives in palette.ts');
    for (const clip of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling', 'adjustsFontSizeToFit']) {
      assert.ok(!SCREEN.includes(clip), `the route uses ${clip}, so a learner who turns the text up loses words`);
    }
    // No number a learner could read is typed here. Layout takes its numbers
    // from the tokens; every figure on the page belongs to the module that
    // counted it.
    for (const quoted of SCREEN.match(/'[^']*'/g) ?? []) {
      assert.doesNotMatch(quoted, /\d/, `the route types ${quoted}; every figure here belongs to the module that counted it`);
    }
    assert.doesNotMatch(SCREEN, /—/, 'the route carries an em dash, which no learner-facing file may');
  });
});
