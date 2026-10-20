import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { avatarInitial } from './avatar.ts';
import { homeGreeting } from '../home/greeting.ts';
import { firstNameOf } from '../tutor/dashboard.ts';

// 2026-10-20, sim nits: the avatar and the greeting share one name source.
describe('profile avatar initial', () => {
  test('a skipped name draws the glyph, never a letter', () => {
    assert.equal(avatarInitial(null), null);
    assert.equal(avatarInitial(''), null);
    assert.equal(avatarInitial('   '), null);
  });

  test('a name draws its first letter, from the first name only', () => {
    assert.equal(avatarInitial('élodie martin'), 'É');
    assert.equal(avatarInitial('  Sam  Lee '), 'S');
  });

  test('the avatar agrees with the greeting: a letter only when Today names the learner', () => {
    for (const name of [null, '', '  ', 'Ana', ' bob smith']) {
      const title = homeGreeting(firstNameOf(name)).title;
      const named = title !== homeGreeting(null).title;
      assert.equal(avatarInitial(name) !== null, named, `${JSON.stringify(name)}: "${title}"`);
      if (named) assert.ok(title.includes(firstNameOf(name)!), title);
    }
  });

  test('every tab header draws the one ProfileButton, which reads this module', () => {
    const button = readFileSync(new URL('./ProfileButton.tsx', import.meta.url), 'utf8');
    assert.match(button, /avatarInitial\(profile\.name\)/);
    assert.doesNotMatch(button, /'You'/);
  });
});
