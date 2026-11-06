/**
 * What the Friends screens show when a request fails: Luvani's own sentence,
 * the connection line for a dropped connection, never the library's message.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8');

describe('Friends errors', () => {
  test('a caught message goes through errorCopy at every Friends catch', () => {
    const social = read('./useSocial.ts');
    assert.match(social, /setError\(errorCopy\(e, 'Friends could not connect\. Please try again\.'\)\)/);
    assert.match(social, /setError\(errorCopy\(e, 'That action could not finish\. Please try again\.'\)\)/);
    const invite = read('./InviteFriendsScreen.tsx');
    assert.match(invite, /setNote\(errorCopy\(e, 'Search could not finish\.'\)\)/);
    for (const file of [social, invite]) assert.doesNotMatch(file, /instanceof Error \? e\.message/);
  });

  test('socialRequest throws only LearnerErrors of its own', () => {
    const social = read('./social.ts');
    assert.doesNotMatch(social, /throw new Error\(/, 'a plain Error is replaced by the fallback, so its sentence is never read.');
    assert.equal((social.match(/throw new LearnerError\(/g) ?? []).length, 4);
  });
});
