import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  asUsername,
  defaultUsername,
  emptyState,
  searchRoster,
  withAccepted,
  withDeclined,
  withRequest,
  withoutFriend,
  type FriendsState,
} from './logic.ts';

const NOW = Date.parse('2026-08-19T10:00:00Z');
const SELF = 'pravz.1234';

/** A state one outgoing sample request deep, the way the adapter builds it. */
function askedTheo(): { state: FriendsState; id: string } {
  const { state, result } = withRequest(
    emptyState(),
    { username: 'theo.lyon', displayName: 'Théo', preview: true },
    SELF,
    NOW,
  );
  assert.equal(result.ok, true);
  const first = state.requests[0];
  assert.ok(first, 'the ask must land as a request');
  return { state, id: first.id };
}

describe('asking to be friends', () => {
  test('a request lands once and pressing Add again changes nothing', () => {
    const { state } = askedTheo();
    const again = withRequest(state, { username: 'theo.lyon', displayName: 'Théo', preview: true }, SELF, NOW);
    assert.equal(again.result.ok, true, 'a duplicate ask is impatience, not an error');
    assert.equal(again.state.requests.length, 1, 'no second request for the same person');
    assert.deepEqual(again.state, state);
  });

  test('dedupe reads through case and accents', () => {
    const { state } = askedTheo();
    const again = withRequest(state, { username: 'THÉO.LYON', displayName: null, preview: true }, SELF, NOW);
    assert.equal(again.state.requests.length, 1);
  });

  test('your own username is turned away gently', () => {
    const { state, result } = withRequest(
      emptyState(),
      { username: SELF, displayName: null, preview: false },
      SELF,
      NOW,
    );
    assert.equal(result.ok, false);
    assert.equal(state.requests.length, 0);
  });

  test('someone already on your board cannot be asked again', () => {
    const asked = askedTheo();
    const friends = withAccepted(asked.state, asked.id, NOW).state;
    const { state, result } = withRequest(
      friends,
      { username: 'theo.lyon', displayName: 'Théo', preview: true },
      SELF,
      NOW,
    );
    assert.equal(result.ok, false);
    assert.equal(state.requests.length, 0, 'no request rides alongside an existing friendship');
  });

  test('a name outside the roster is saved honestly, not sent', () => {
    const { state, result } = withRequest(
      emptyState(),
      { username: 'marie.curie', displayName: null, preview: false },
      SELF,
      NOW,
    );
    assert.equal(result.ok, true);
    assert.ok(result.ok && result.message?.includes('friend servers'), 'the copy says when it will really go');
    assert.equal(state.requests[0]?.preview, false);
    assert.equal(state.requests[0]?.direction, 'outgoing');
  });
});

describe('answering a request', () => {
  test('accepting moves it from requests to friends and keeps the Sample label', () => {
    const asked = askedTheo();
    const { state, result } = withAccepted(asked.state, asked.id, NOW);
    assert.equal(result.ok, true);
    assert.equal(state.requests.length, 0);
    assert.equal(state.friends.length, 1);
    const friend = state.friends[0];
    assert.equal(friend?.username, 'theo.lyon');
    assert.equal(friend?.preview, true, 'the preview flag must survive the move');
    assert.equal(friend?.xp, 480, 'a sample friend arrives with their roster score');
    assert.equal(friend?.since, new Date(NOW).toISOString());
  });

  test('accepting a request that is gone says so instead of inventing one', () => {
    const { state, result } = withAccepted(emptyState(), 'req:nobody', NOW);
    assert.equal(result.ok, false);
    assert.equal(state.friends.length, 0);
  });

  test('declining removes the request and makes no friend', () => {
    const asked = askedTheo();
    const { state, result } = withDeclined(asked.state, asked.id);
    assert.equal(result.ok, true);
    assert.equal(state.requests.length, 0);
    assert.equal(state.friends.length, 0);
  });
});

describe('removing a friend', () => {
  test('unfriending removes exactly that row', () => {
    const asked = askedTheo();
    const friends = withAccepted(asked.state, asked.id, NOW).state;
    const friendId = friends.friends[0]?.id;
    assert.ok(friendId);
    const { state, result } = withoutFriend(friends, friendId);
    assert.equal(result.ok, true);
    assert.equal(state.friends.length, 0);
  });

  test('unfriending someone already gone reports it', () => {
    assert.equal(withoutFriend(emptyState(), 'friend:ghost').result.ok, false);
  });
});

describe('the starting username', () => {
  test('name plus seed makes a slug and four digits', () => {
    const u = defaultUsername('Camille Rousseau', 'user-abc-123');
    assert.match(u, /^camille\.\d{4}$/);
  });

  test('the same account always lands on the same handle', () => {
    assert.equal(defaultUsername('Camille', 'seed-1'), defaultUsername('Camille', 'seed-1'));
    assert.notEqual(defaultUsername('Camille', 'seed-1'), defaultUsername('Camille', 'seed-2'));
  });

  test('accents fold and a nameless learner is still someone', () => {
    assert.match(defaultUsername('Éloïse', 'x'), /^eloise\.\d{4}$/);
    assert.match(defaultUsername(null, 'x'), /^parler\.\d{4}$/);
    assert.match(defaultUsername('   ', 'x'), /^parler\.\d{4}$/);
  });
});

describe('searching the sample roster', () => {
  test('accents are optional in both directions', () => {
    assert.equal(searchRoster('theo').length, 1, 'plain letters find Théo');
    assert.equal(searchRoster('amelie')[0]?.username, 'amelie.b');
    assert.equal(searchRoster('Théo')[0]?.username, 'theo.lyon', 'typed accents also match');
  });

  test('case does not matter and substrings hit both name fields', () => {
    assert.equal(searchRoster('CAMILLE')[0]?.username, 'camille.paris');
    assert.equal(searchRoster('dubois')[0]?.displayName, 'Marc');
  });

  test('an empty search finds nobody rather than everybody', () => {
    assert.equal(searchRoster('').length, 0);
    assert.equal(searchRoster('   ').length, 0);
  });

  test('every sample user is labelled a sample', () => {
    for (const hit of searchRoster('.')) {
      assert.equal(hit.preview, true, `${hit.username} must carry its Sample label`);
    }
    assert.ok(searchRoster('.').length >= 4, 'the dot appears in most sample usernames');
  });
});

describe('what typed text is worth as a username', () => {
  test('folds accents, drops spaces and junk, keeps the username alphabet', () => {
    assert.equal(asUsername('  Théo.Lyon '), 'theo.lyon');
    assert.equal(asUsername('marie curie!'), 'mariecurie');
    assert.equal(asUsername('***'), '');
  });
});
