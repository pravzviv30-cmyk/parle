/**
 * The one line where a finished conversation reaches the disk.
 *
 * apps/mobile has no renderer (docs/TESTING.md), and this hook cannot even be
 * imported here: it reaches expo-modules-core through globals.ts, which node's
 * type stripping refuses to load. So the message handler cannot be driven the
 * way a test would like to drive it.
 *
 * What this does instead is lift the call to the journal out of `case 'recap':`
 * exactly as the file writes it, and run that one expression against the real
 * journal and a real recap message, on a disk this test can read afterwards.
 * Narrower than driving the hook, and far wider than matching a string: what it
 * checks is the arguments the production callsite actually passes, and what the
 * journal makes of them.
 *
 * The defect it exists for was silent in exactly that way. `journalRecap` grew
 * a second argument for the learner model, the journal and the review store
 * were both tested end to end through it, and this handler went on calling the
 * one-argument version while holding the profile on the line above. Every test
 * passed and the feature did nothing on a phone.
 *
 * If the call ever refers to something built earlier in the case block, this
 * throws instead of passing. That is the right way round: a harness that cannot
 * see the callsite should say so rather than quietly certify it.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecapPayload } from '@parle/core';
import { createProfile } from '@parle/brain/profile';

import { setActiveUser } from '../storage/scope.ts';
import { journalRecap } from './journal.ts';
import { recoveryPlan } from './journalRules.ts';

const NOW = new Date(2026, 7, 27, 14).getTime();

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const phrase = (fr: string, en: string) => ({ fr, frWritten: null, en, enLiteral: null, register: 'familier', note: null });

const recap = (): RecapPayload => ({
  headline: 'You ordered a coffee.',
  wins: ['You said it without help.'],
  fixes: [],
  phrases: [phrase('Ça marche', 'coming up'), phrase('Autre chose', 'something else')],
  nextFocus: 'The u sound',
  topics: [{ fr: 'Au café', en: 'Ordering at the café' }],
  cefr: { estimate: 'A1', confidence: 'low' },
  stats: { turns: 6, rescues: 1, unassistedRate: 0.7 },
});

/**
 * The learner model as the recap carries it, built through `createProfile` so
 * this test cannot drift away from what `repairProfile` accepts.
 */
function profileWith(used: Record<string, number>): unknown {
  const profile = createProfile();
  for (const [fr, timesUsedWell] of Object.entries(used)) {
    profile.phrases[fr.toLowerCase()] = {
      fr,
      frWritten: null,
      en: 'used in conversation',
      register: 'familier',
      introducedAt: new Date(NOW).toISOString(),
      timesUsedWell,
      mastered: false,
    };
  }
  return profile;
}

/**
 * AsyncStorage resolves under plain node and has no implementation off a
 * device, so the module object every store shares is given one. Same
 * arrangement as journal.test.ts and storage/storeBinding.test.ts.
 */
function installDisk(): Map<string, string> {
  const map = new Map<string, string>();
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null);
  shared.setItem = (key: string, value: string): Promise<void> => {
    map.set(key, value);
    return Promise.resolve();
  };
  shared.removeItem = (key: string): Promise<void> => {
    map.delete(key);
    return Promise.resolve();
  };
  return map;
}

/** The body of `case 'recap':`, which is everything the app does with a recap. */
function recapCase(source: string): string {
  const open = source.indexOf("case 'recap':");
  assert.ok(open >= 0, 'the hook still handles the recap message');
  const close = source.indexOf("case '", open + 1);
  assert.ok(close > open, 'the recap case still ends where the next one begins');
  return source.slice(open, close);
}

/** The call to the journal inside it, parentheses matched, written as it is written. */
function journalCall(block: string): string {
  const start = block.indexOf('journalRecap(');
  assert.ok(start >= 0, 'the recap is still written down before the session can be closed');
  let depth = 0;
  for (let i = start; i < block.length; i += 1) {
    if (block[i] === '(') depth += 1;
    else if (block[i] === ')') {
      depth -= 1;
      if (depth === 0) return block.slice(start, i + 1);
    }
  }
  throw new Error('the call to the journal is never closed');
}

/** Run that call, with the real journal and one recap message off the wire. */
function makeTheCall(call: string, msg: unknown): Promise<void> {
  const run = new Function('journalRecap', 'msg', `"use strict"; return ${call};`) as (
    journal: typeof journalRecap,
    message: unknown,
  ) => Promise<void>;
  return run(journalRecap, msg);
}

describe('the recap message, on its way to the disk', () => {
  test('the counts a conversation earned reach the journal, not just the end card', async () => {
    // The agent sends the recap and the updated learner model on one message.
    // The card renders the recap; the counts of what was used well live on the
    // model, and the journal is where they turn into practice.
    const uid = '33333333-3333-4333-8333-000000000001';
    const disk = installDisk();
    setActiveUser(uid);

    const message = {
      t: 'recap' as const,
      recap: recap(),
      profile: profileWith({ 'Ça marche': 3 }),
    };
    await makeTheCall(journalCall(recapCase(read('./useLiveSession.ts'))), message);

    const raw = disk.get(`parle.u.${uid}.journal`);
    assert.ok(raw, 'the recap never reached the disk at all');

    // Read back the way a launch reads it, so this is the batch the deck is
    // actually built from rather than a shape agreeing with itself.
    const batch = recoveryPlan(JSON.parse(raw));
    assert.ok(batch, 'the journalled session is not recoverable');
    assert.deepEqual(batch.phrases.map((p) => p.fr), ['Ça marche', 'Autre chose'], 'the recap itself still rides');
    assert.deepEqual(
      batch.convoUses,
      [{ fr: 'Ça marche', uses: 3 }],
      'a phrase the learner has started using must reach review as one, not as a phrase they read once',
    );
  });
});
