/**
 * The Friends tab before anybody has joined — Stage 3.
 *
 * The empty tab used to offer three doors onto the same setup: "Add friends"
 * and "Privacy & notifications" above the card, and "Set up Friends" inside
 * it. Two of the three opened the same screen. Now a learner who has not
 * joined meets one opt-in start, with privacy one quiet link below it, and the
 * two circle doors appear once there is a circle for them to manage.
 *
 * Nothing else about Friends changes here: no new feature, no ranking change,
 * no moderation change. The last test pins that the joined tab keeps the doors
 * and the board it already had.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { DEFAULT_SOCIAL_SETTINGS, type SocialSnapshot } from './socialModel.ts';
import {
  FRIENDS_COPY,
  FRIENDS_PRIVACY_LINK,
  FRIENDS_START,
  FRIENDS_START_BODY,
  FRIENDS_START_TITLE,
  friendsEntry,
} from './friendsView.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const TAB = stripComments(read('../tabs/FriendsTab.tsx')).replace(/\s+/g, ' ');
const PRIVACY = stripComments(read('./SocialSettingsScreen.tsx')).replace(/\s+/g, ' ');

const person = (id: string) => ({ id, username: id, name: id, points: 0, days: 0, conversations: 0 });
const snapshot = (enabled: boolean): SocialSnapshot => ({
  self: person('me'), friends: [], requests: [], challenges: [], notices: [], blocked: [],
  settings: { ...DEFAULT_SOCIAL_SETTINGS, enabled }, week: '2026-09-21', resets: '2026-09-28',
});

/** The JSX from `{entry === '<name>' &&` to the matching close of that expression. */
function block(source: string, name: string): string {
  const open = `{entry === '${name}' && `;
  const start = source.indexOf(open);
  assert.notEqual(start, -1, `the tab draws no ${name} block`);
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`the ${name} block is never closed`);
}

describe('Friends starts with one clear opt-in — Stage 3', () => {
  test('which Friends a learner is shown is decided in one place', () => {
    assert.equal(friendsEntry(null), 'loading', 'an unanswered read is drawn as a choice');
    assert.equal(friendsEntry(snapshot(false)), 'start', 'somebody who has not joined is shown a circle');
    assert.equal(friendsEntry(snapshot(true)), 'circle', 'somebody who joined is asked to set up again');

    for (const line of FRIENDS_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—|\d/, `"${line}" carries an em dash or a count`);
    }
    for (const line of [FRIENDS_START_TITLE, FRIENDS_START_BODY, FRIENDS_START, FRIENDS_PRIVACY_LINK]) {
      assert.ok(FRIENDS_COPY.includes(line), `left out of the scanned list: ${line}`);
    }
    assert.match(FRIENDS_START_BODY, /optional/i, 'the start no longer says joining is a choice');
  });

  test('before joining there is one start, and privacy is a quiet link beneath it', () => {
    assert.match(TAB, /const entry = friendsEntry\(s\);/, 'the tab decides for itself which Friends to draw');
    const start = block(TAB, 'start');
    assert.equal((start.match(/<PillButton\b/g) ?? []).length, 1, 'the start offers more than one strong action, or none');
    assert.equal((start.match(/nav\.navigate\('AddFriends'\)/g) ?? []).length, 1, 'the start has more than one door onto setup');
    assert.match(start, /<PillButton label=\{FRIENDS_START\} onPress=\{\(\) => nav\.navigate\('AddFriends'\)\} \/>/, 'the one start is not the setup door');
    assert.match(start, /<GhostButton label=\{FRIENDS_PRIVACY_LINK\} onPress=\{\(\) => nav\.navigate\('SocialSettings'\)\} \/>/, 'privacy is not reachable from the start');
    assert.ok(start.indexOf('<PillButton') < start.indexOf('FRIENDS_PRIVACY_LINK'), 'privacy is drawn above the start it is secondary to');
    assert.match(start, /\{FRIENDS_START_TITLE\}/, 'the start spells its own heading');
    assert.match(start, /\{FRIENDS_START_BODY\}/, 'the start spells its own line');

    // The two circle doors are drawn only once there is a circle.
    const circle = block(TAB, 'circle');
    assert.ok(circle.includes("nav.navigate('SocialSettings')"), 'a joined learner lost the privacy door');
    assert.ok(circle.indexOf("label={s.requests.some(") !== -1 || circle.includes('Add friends'), 'a joined learner lost the add door');
    const outside = TAB.replace(start, '').replace(circle, '');
    assert.ok(!outside.includes("nav.navigate('AddFriends')"), 'a setup door is drawn outside both states, so the empty tab offers it twice');
    assert.ok(!outside.includes("nav.navigate('SocialSettings')"), 'the privacy door is drawn outside both states, so the empty tab offers it twice');

    // The privacy screen names the same start the tab does.
    assert.match(PRIVACY, /<GhostButton label=\{FRIENDS_START\} onPress=\{\(\) => nav\.navigate\('AddFriends'\)\} \/>/, 'the privacy screen calls the same start something else');
  });

  test('the joined tab keeps its board and doors, and nothing new is added', () => {
    // Exactly the three setup doors that existed: the toolbar, the empty
    // board's invite, and the one start. A fourth is a new feature by the back door.
    assert.equal((TAB.match(/nav\.navigate\('AddFriends'\)/g) ?? []).length, 3, 'the tab grew or lost a door onto setup');
    for (const kept of ['friendsByName(', "act('inviteChallenge'", "act('report'", "act('block'", 'REACTIONS.map(']) {
      assert.ok(TAB.includes(kept), `the joined tab lost ${kept}`);
    }
    assert.ok(!/global|leaderboard/i.test(TAB), 'the tab reaches beyond the learner’s own circle');
  });
});
