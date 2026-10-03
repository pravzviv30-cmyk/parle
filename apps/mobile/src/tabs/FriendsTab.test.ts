/**
 * Friends in the notebook system (Phase 3, 2026-09-27): restyled only.
 *
 * The board, the points and the moderation are exactly what they were; what
 * changed is the paper they sit on. No chartreuse (the learner's own row used
 * to be a highlighter-green panel), no tinted or journal cards, the doors as
 * ledger rows, and no more than one ink pill. `friends/friendsView.test.ts`
 * still holds the opt-in and the door counts.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const SCREEN = stripComments(read('./FriendsTab.tsx'));
const FLAT = SCREEN.replace(/\s+/g, ' ');

describe('Friends is restyled in the notebook system, and nothing else moved — notebook Phase 3', () => {
  test('no highlighter, no tint and no coloured card anywhere on the tab', () => {
    for (const loud of ['accent.feature', 'highlight', 'tone="feature"', 'tone="journal"', '<TintRow', 'tint=', '<Highlight']) {
      assert.ok(!SCREEN.includes(loud), `Friends draws ${loud}; the chartreuse is a highlighter and this tab has nothing to highlight`);
    }
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(SCREEN), 'the tab spells a colour by hand');
    assert.ok(!/borderRadius: \d/.test(SCREEN), 'a row draws its own rounded panel instead of a ledger line');
  });

  test('at most one ink pill, and the doors are ledger rows', () => {
    assert.ok((SCREEN.match(/<PillButton\b/g) ?? []).length <= 1, 'Friends draws more than one primary pill');
    assert.match(FLAT, /<Ledger\b/, 'the tab lists nothing as a ledger');
    assert.match(FLAT, /<LedgerRow [^>]*title=\{s\.requests\.some\(/, 'adding friends is not a ledger row');
    assert.match(FLAT, /<LedgerRow [^>]*onPress=\{\(\) => nav\.navigate\('SocialSettings'\)\}/, 'privacy is not a ledger row');
  });

  test('Friends removes visible ranks while keeping shared challenges and moderation', () => {
    assert.match(SCREEN, /friendsByName\(s\.friends\)/);
    assert.doesNotMatch(SCREEN, /person\.points|person\.rank|POINTS_EXPLANATION|rankedFriends|weekly board/i);
    for (const kept of ["act('inviteChallenge'", "act('acceptChallenge'", "act('leaveChallenge'", "act('remove'", "act('block'", "act('report', { id: f.id, reason: reason.trim() })", 'maxLength={500}', 'REACTIONS.map(', "act('react'"]) {
      assert.ok(SCREEN.includes(kept), `the change lost ${kept}`);
    }
    assert.match(SCREEN, /notices\.filter\(n => n\.kind !== 'result'\)/);
    const privacy = read('../friends/SocialSettingsScreen.tsx');
    assert.doesNotMatch(privacy, /key: 'showScore'|key: 'results'/);
    assert.match(privacy, /key: 'shareMilestones'/);
  });

  test('English is never set in the French face', () => {
    // The challenge count used to be set in Fraunces. Only the French line is now.
    assert.doesNotMatch(FLAT, /type\.french[^}]*\}\]\}>\{c\.count >= c\.target \? 'Un peu/, 'the count is set in the French face beside the French line');
    assert.match(FLAT, /'Un peu de français, ensemble\.'/, 'the shared line left the finished challenge');
  });
});
