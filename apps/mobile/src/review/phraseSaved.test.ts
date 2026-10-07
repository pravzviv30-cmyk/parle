/**
 * A phrase is called saved only once the phrasebook's write is durable (F762).
 *
 * The drill's own-words keep used to `.then(() => setKept(true))` and ignore
 * the acknowledgement `addPhrases` returns, so a full phone was told "In your
 * phrase bank" about a phrase that was never kept. The keep runs here through
 * the real review store against an in-memory disk that can refuse a write the
 * way a full phone does, and the moment it hands the celebration host is
 * caught at the host's own seam. The screen is read as text, because this
 * workspace has no renderer (docs/TESTING.md).
 */

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { phraseKeyOf, type ConvoPhrase } from '@luvani/core';

import { attachCelebrationListener, celebrationKey, isRememberedInSeen, type CelebrationEvent } from '../celebrate/events.ts';
import { setActiveUser } from '../storage/scope.ts';
import { resetSyncRegistry } from '../sync/registry.ts';
import { announcePhraseSaved, keepPhrase } from './phraseSaved.ts';
import { loadDeck } from './store.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const stripComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const PHRASE: ConvoPhrase = { fr: 'Je peux avoir le code wifi ?', frWritten: null, en: 'Ask for the wifi password', enLiteral: null, register: 'courant', note: null };

let full = false;
let uids = 0;
const published: CelebrationEvent[] = [];
let detach: () => void = () => {};

beforeEach(() => {
  const map = new Map<string, string>();
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = async (key: string): Promise<string | null> => map.get(key) ?? null;
  shared.setItem = async (key: string, value: string): Promise<void> => {
    if (full) throw new Error('QuotaExceededError');
    map.set(key, value);
  };
  shared.removeItem = async (key: string): Promise<void> => {
    map.delete(key);
  };
  full = false;
  resetSyncRegistry();
  setActiveUser(`66666666-6666-4666-8666-${String(++uids).padStart(12, '0')}`);
  published.length = 0;
  detach = attachCelebrationListener((events) => published.push(...events));
});

afterEach(() => detach());

describe('saved means durable — F762', () => {
  test('a kept own-words phrase is called saved only on a durable acknowledgement', async () => {
    // A full phone: the write is refused, nothing is called saved, nothing is celebrated.
    full = true;
    assert.equal(await keepPhrase(PHRASE), false, 'a refused write was called saved');
    assert.equal(published.length, 0, 'a refused write was celebrated');
    // A write that throws is the same answer.
    assert.equal(await keepPhrase(PHRASE, () => Promise.reject(new Error('gone'))), false);
    assert.equal(published.length, 0, 'a write that threw was celebrated');

    // The phone has room: saved, once, with the phrase's own key and never the learner's words.
    full = false;
    assert.equal(await keepPhrase(PHRASE), true);
    assert.ok((await loadDeck()).some((card) => card.id === phraseKeyOf(PHRASE.fr)), 'called saved, and the phrasebook does not hold it');
    assert.equal(published.length, 1);
    const moment = published[0]!;
    assert.equal(moment.type, 'phrase-saved');
    assert.equal(moment.key, celebrationKey.saved(phraseKeyOf(PHRASE.fr)));
    assert.deepEqual(moment.data, { phraseKey: phraseKeyOf(PHRASE.fr) }, 'the moment carries more than the stored phrase\'s own key');
    // A toast is confirmed in memory only: the key never reaches the synced seen list.
    assert.equal(isRememberedInSeen(moment), false, 'a saved phrase would be written to the synced seen list');
    // The announcement alone follows the same rule.
    assert.equal(announcePhraseSaved('failed', PHRASE.fr), false);
    assert.equal(published.length, 1);

    // The drill: kept, the filled bookmark and the saved label only on that answer.
    const screen = stripComments(read('../DrillScreen.tsx')).replace(/\s+/g, ' ');
    const keep = screen.slice(screen.indexOf('const keepPhrase = useCallback('), screen.indexOf('const sheet = feedback !== null'));
    assert.ok(keep.length > 0, 'the keep handler moved; this test is reading the wrong thing');
    assert.match(keep, /void keepInPhrasebook\(\{ fr: exercise\.fr,/, 'the drill keeps the phrase some other way');
    assert.match(keep, /\.then\(\(saved\) => \{ if \(!attemptAlive\.current\) return; if \(saved\) setKept\(true\); else setKeepFailed\(true\); \}\)/, 'kept is set without a durable answer');
    assert.equal((screen.match(/setKept\(true\)/g) ?? []).length, 1, 'something else calls the phrase kept');
    assert.doesNotMatch(screen, /addPhrases\(/, 'the drill writes the phrasebook beside the one keep');
    const view = screen.slice(screen.indexOf('function OwnWordsView('), screen.indexOf('export function DrillScreen('));
    assert.match(view, /<IconAction layout="inline" ground=\{look\.tone === 'good' \? 'mint' : 'paper'\} icon="bookmark" animate="bookmark-fill" selected=\{kept\} busy=\{keeping\} label=\{kept \? MADE_FROM\.phrase\.saved : MADE_FROM\.phrase\.save\} onPress=\{onKeep\} \/>/, 'the bookmark fills, or the label says saved, on something other than kept');
    assert.match(view, /\{outcome\.keep && keepFailed && !kept && \(/, 'a refused keep is not said');

    // Today's phrase added to review announces only a durable write too.
    const daily = stripComments(read('../daily/DailyPracticeScreen.tsx')).replace(/\s+/g, ' ');
    assert.match(daily, /const ack = await addPhrases\(\[[^\]]*\]\); announcePhraseSaved\(ack, item\.fr\);/, 'today\'s phrase announces a save it did not check');
  });
});
