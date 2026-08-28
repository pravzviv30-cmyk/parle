/**
 * Nothing a server says reaches the learner in the server's own words — F153.
 *
 * The translations are a pure module and are called directly, with the real
 * GoTrue and token-server sentences as input. The two places the app used to
 * pass a message straight through are held by a source walk, because there is
 * no renderer here and no live Supabase project: the walk can see that
 * `deleteAccount` never reads a message out of the response body and that the
 * Google failure copy is the shared constant, and it cannot see a real 403.
 *
 * The raw strings below are quoted from GoTrue and from
 * `services/token-server/src/server.ts`, so if either changes its wording the
 * mapping tests keep passing while describing something that no longer arrives.
 * That is the ceiling: this proves what the app does with a message, not that
 * the message still looks like this.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { friendly, deletionFailure, GENERIC_FAILURE, GOOGLE_START_FAILED } from './friendly.ts';

const AUTH_DIR = import.meta.dirname;
const read = (name: string): string => readFileSync(path.join(AUTH_DIR, name), 'utf8');

/** Every `message: '…'` value in a file. Import lines name the vendor legitimately; copy does not. */
const messages = (source: string): string[] => [...source.matchAll(/message:\s*'([^']*)'/g)].map((m) => m[1]!);

describe('a provider error, translated — F153', () => {
  test('an unmapped provider error never reaches the learner raw', () => {
    // Every one of these is a real GoTrue response under 120 characters, which
    // is exactly the length test that used to wave them through to the screen.
    const raw = [
      'Database error saving new user',
      'Signups not allowed for this instance',
      'Anonymous sign-ins are disabled',
      'AuthApiError: unexpected_failure',
      'invalid claim: missing sub claim',
      'User from sub claim in JWT does not exist',
      'unable to fetch records: sql: no rows in result set',
    ];
    for (const message of raw) {
      assert.equal(
        friendly(message),
        GENERIC_FAILURE,
        `"${message}" reached the learner in the provider's words`,
      );
      // And not a fragment of it either.
      for (const word of message.split(/[^A-Za-z]+/).filter((w) => w.length >= 5)) {
        assert.ok(
          !friendly(message).toLowerCase().includes(word.toLowerCase()),
          `the word "${word}" survived the translation of "${message}"`,
        );
      }
    }

    // The empty and the missing take the same door, and so does a long one.
    assert.equal(friendly(undefined), GENERIC_FAILURE);
    assert.equal(friendly(''), GENERIC_FAILURE);
    assert.equal(friendly('x'.repeat(400)), GENERIC_FAILURE);

    // The fallthrough is closed by construction: the generic sentence is the
    // only thing an unrecognised message can become, whatever its length.
    assert.doesNotMatch(read('friendly.ts'), /message\.length\s*<\s*\d+/, 'the length test that let messages through is back');
  });

  test('the known provider errors keep their translations', () => {
    // The five that were already translated, in the shape GoTrue sends them.
    assert.equal(friendly('Invalid login credentials'), 'That email and password do not match an account.');
    assert.equal(friendly('User already registered'), 'That email already has an account. Sign in instead.');
    // No duration in this one: the window belongs to the project's GoTrue
    // settings, which this repo does not hold. See F163 below.
    assert.equal(friendly('email rate limit exceeded'), 'Too many tries in a row. Wait a while, then try again.');
    assert.equal(friendly('Network request failed'), 'The connection dropped. Check your internet and try again.');
    assert.equal(
      friendly('Email not confirmed'),
      'That email has not been confirmed yet. Check your inbox for the confirmation link.',
    );

    // Two more earned a translation in the same round rather than a generic.
    // Both used to arrive raw, both are the learner's own doing, and both carry
    // a true instruction that would be lost by flattening them: closing a leak
    // must not cost a learner the one sentence that tells them what to fix.
    assert.equal(
      friendly('Password should be at least 6 characters.'),
      'That password is too short. Try a longer one.',
    );
    assert.equal(
      friendly('Password is known to be weak and easy to guess, please choose a different one.'),
      'That password is easy to guess. Try a different one.',
    );

    // Matching is on the provider's wording, which does not keep its case.
    assert.equal(friendly('INVALID LOGIN CREDENTIALS'), friendly('invalid login credentials'));

    for (const message of [
      'Invalid login credentials',
      'User already registered',
      'email rate limit exceeded',
      'Network request failed',
      'Email not confirmed',
      'Password should be at least 6 characters.',
      'Password is known to be weak and easy to guess, please choose a different one.',
      'Database error saving new user',
    ]) {
      const line = friendly(message);
      assert.ok(!/—/.test(line), `"${line}" carries an em dash`);
      assert.ok(!/\d/.test(line), `"${line}" carries a number the learner did not ask for`);
      assert.doesNotMatch(line, /supabase|gotrue|auth ?api|sql|token|jwt/i, `"${line}" names the plumbing`);
    }
  });

  test("account deletion failure speaks the app's words, not the server's", () => {
    // Every status the token server can answer /account/delete with, plus the
    // ones a proxy in front of it can invent.
    const statuses = [400, 401, 403, 404, 409, 429, 500, 502, 503, 504];
    for (const status of statuses) {
      const line = deletionFailure(status);
      assert.ok(line.length > 0 && line.length <= 160, `the ${status} line is not a sentence a learner reads`);
      assert.ok(!/\d/.test(line), `the ${status} line carries a number, and a status code is not the learner's business`);
      assert.ok(!/—/.test(line), `the ${status} line carries an em dash`);
      assert.doesNotMatch(line, /supabase|postgres|server|http|json|token|service role/i, `the ${status} line names the plumbing`);
      // Nobody is left standing in front of a dead button: every line either
      // says the account is untouched or says what to do next.
      assert.match(line, /again|later|nothing/i, `the ${status} line leaves the learner with nowhere to go`);
    }

    // The one refusal that carries a true instruction keeps it, in our words.
    // The server says "Sign in again to confirm it is you, then delete the
    // account within five minutes." A learner who is told only "that did not
    // work" would sit there re-tapping a button that cannot succeed yet.
    const recent = deletionFailure(403);
    assert.match(recent, /sign in again/i, 'the fresh-sign-in instruction was flattened into a generic apology');
    assert.match(recent, /five minutes/i, 'the window the learner has to act in was dropped');

    assert.match(deletionFailure(401), /sign in again/i);
    assert.match(deletionFailure(429), /minute|soon|again/i);
    assert.match(deletionFailure(503), /nothing/i);

    // And the adapter never reads a sentence out of the response at all. This
    // is the leak itself: the token server's JSON body used to be rendered.
    const adapter = read('supabaseAdapter.ts');
    const deleteFn = adapter.slice(adapter.indexOf('async deleteAccount('), adapter.indexOf('async signOut('));
    assert.ok(deleteFn.length > 0, 'deleteAccount moved or was renamed; this test is reading nothing');
    assert.doesNotMatch(
      deleteFn,
      /body\??\.\s*message/,
      'the token server\'s JSON body is being rendered to the learner again',
    );
    assert.doesNotMatch(deleteFn, /response\.json\(/, 'deleteAccount parses a body it must not show, which is the only reason it had one');
    assert.match(
      deleteFn,
      /deletionFailure\(response\.status\)/,
      'the deletion failure is written somewhere other than the one place that owns those words',
    );
  });

  test('the google error tells the learner what to do, not which vendor to configure', () => {
    // The old sentence was "Check the Supabase Google provider setup", which is
    // an instruction to an operator, handed to somebody who cannot act on it.
    assert.doesNotMatch(GOOGLE_START_FAILED, /supabase|provider|setup|configur|dashboard|console/i);
    assert.match(GOOGLE_START_FAILED, /try again/i, 'the learner is not told they can simply try again');
    assert.match(GOOGLE_START_FAILED, /email|password/i, 'the learner is not pointed at the door that is still open');
    assert.ok(!/—/.test(GOOGLE_START_FAILED));
    assert.ok(GOOGLE_START_FAILED.length <= 120);

    // Both halves of the platform split say it, and neither writes its own.
    for (const name of ['oauth.ts', 'oauth.native.ts']) {
      const source = read(name);
      assert.match(source, /GOOGLE_START_FAILED/, `${name} writes its own Google failure copy`);
      for (const line of messages(source)) {
        assert.doesNotMatch(
          line,
          /supabase|provider setup|configur|dashboard/i,
          `${name} tells the learner to go and configure something: "${line}"`,
        );
      }
    }
  });
});

/**
 * Four repairs to the round that closed F153 — F163, F164, F166, F167.
 *
 * Three of them are the same mistake in different clothes: a sentence that is
 * shorter, looser or tighter than the rule it describes, so a learner who obeys
 * it gets refused again. The fourth is the leak's return path: `friendly.ts`
 * being right does not keep the adapter honest, so the binding between them is
 * pinned here rather than assumed.
 *
 * The rate-limit and fresh-sign-in numbers are read out of the token server's
 * own source, not copied into this file. If a window moves, this test fails
 * instead of quietly describing a promise the server stopped keeping.
 */
const REPO_ROOT = path.join(AUTH_DIR, '..', '..', '..', '..');
const serverSource = (name: string): string =>
  readFileSync(path.join(REPO_ROOT, 'services', 'token-server', 'src', name), 'utf8');

/** A `{ limit: n, windowSec: n }` rule, read from RATE_LIMITS by name. */
const rateLimitRule = (source: string, key: string): { limit: number; windowSec: number } => {
  const found = new RegExp(`${key}:\\s*\\{[^}]*limit:\\s*([\\d_]+)[^}]*windowSec:\\s*([\\d_]+)`).exec(source);
  assert.ok(found, `RATE_LIMITS.${key} is gone or reshaped, so this test is reading nothing`);
  return { limit: Number(found[1]!.replace(/_/g, '')), windowSec: Number(found[2]!.replace(/_/g, '')) };
};

/** Copy only. Comments explain the promises; they do not make them. */
const copyLiterals = (source: string): string[] => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  return [...code.matchAll(/'([^']*)'/g)].map((m) => m[1]!);
};

describe('the words are true at the window the server keeps — F163, F164, F166, F167', () => {
  test('a rate limited deletion does not promise a shorter wait than the server keeps', () => {
    const limits = serverSource('rateLimit.ts');
    const perUser = rateLimitRule(limits, 'deletionUser');
    const perAddress = rateLimitRule(limits, 'deletionIp');

    // Three tries per account per day, twenty per address per day. Both budgets
    // refill on a day-long window, so a learner who has spent one is refused
    // for up to a day, not for a minute.
    assert.equal(perUser.windowSec, 86_400);
    assert.equal(perAddress.windowSec, 86_400);
    const refused = deletionFailure(429);
    assert.ok(
      perUser.windowSec >= 3_600 && perAddress.windowSec >= 3_600,
      'the deletion windows shrank below an hour; the line below now understates how soon a learner can retry',
    );
    assert.doesNotMatch(
      refused,
      /\b(a|one) (minute|moment)\b|\bminutes\b|\bseconds?\b|\bshortly\b|\bsoon\b|\bin a moment\b/i,
      `"${refused}" promises a wait shorter than the day the server holds the door shut for`,
    );
    assert.match(refused, /\bday\b/i, 'the line does not say how long the door is shut, so a learner keeps tapping');
    assert.match(refused, /nothing was changed/i, 'a refused deletion must say the account is untouched');

    // The provider's own rate limit is a project setting this repo does not
    // hold, so that line names no duration at all rather than inventing one.
    for (const message of ['email rate limit exceeded', 'Request rate limit reached']) {
      const line = friendly(message);
      assert.doesNotMatch(
        line,
        /\b(second|minute|hour|day|week)s?\b/i,
        `"${line}" names a wait, and no window in this repo backs it`,
      );
      assert.match(line, /try again/i, 'the learner is left with nowhere to go');
    }

    // The one duration the app does keep is read from the server that enforces
    // it. Every other wait in the file has to be one of these two lines.
    const deletionRules = serverSource('accountDeletion.ts');
    assert.match(
      deletionRules,
      /maximumAgeMs\s*=\s*5\s*\*\s*60\s*\*\s*1_000/,
      'the fresh sign-in window moved, and the 403 line still tells the learner five minutes',
    );
    assert.match(deletionFailure(403), /five minutes/i);
    for (const line of copyLiterals(read('friendly.ts'))) {
      if (!/\b(second|minute|hour|day|week)s?\b/i.test(line)) continue;
      assert.ok(
        line === deletionFailure(403) || line === deletionFailure(429),
        `"${line}" names a wait that nothing in this repo backs`,
      );
    }
  });

  test('the adapter translates through friendly.ts and owns no translator of its own', () => {
    const adapter = read('supabaseAdapter.ts');

    // One translator, imported. With friendly.ts intact and this import gone,
    // both F153 headline tests still pass while the raw GoTrue message ships.
    assert.match(
      adapter,
      /import\s*\{[^}]*\bfriendly\b[^}]*\}\s*from\s*'\.\/friendly\.ts'/,
      'the adapter does not import friendly.ts, so whatever it shows the learner comes from somewhere else',
    );
    assert.ok(
      (adapter.match(/\bfriendly\(/g) ?? []).length >= 5,
      'the provider errors are no longer all going through friendly(); one of them is being handled some other way',
    );

    // Every sentence this file hands a screen is either its own fixed copy or a
    // call to the module that owns the translations. Nothing is assembled here.
    for (const [, value] of adapter.matchAll(/message:\s*([^\n]+?),?\s*\n/g)) {
      const written = value!.trim().replace(/,$/, '');
      assert.ok(
        written.startsWith("'") || written.startsWith('friendly(') || written.startsWith('deletionFailure('),
        `supabaseAdapter.ts builds a learner-facing sentence of its own: "${written}"`,
      );
    }

    // And it owns no second translator under any name. Every hand-rolled one
    // starts the same way — lowercase the provider's English, then match a
    // substring of it — so both moves are refused here.
    assert.doesNotMatch(
      adapter,
      /(function|const)\s+friendly\b/,
      'supabaseAdapter.ts defines its own friendly(); there are now two sets of words for the same failure',
    );
    assert.doesNotMatch(
      adapter,
      /\.toLowerCase\(\)/,
      'supabaseAdapter.ts lowercases something, which is the first move of a provider-message translator',
    );
    assert.doesNotMatch(
      adapter,
      /\b(error|err|message|msg)\b[^\n;]{0,40}\.includes\(/,
      'supabaseAdapter.ts matches a substring of a provider message, which is friendly.ts\'s job and only its job',
    );
    assert.doesNotMatch(
      adapter,
      /\berror\.message\b/,
      'the adapter reads error.message itself; the code and the weak-password reasons are lost before friendly() sees them',
    );
  });

  test('typing the current password on the reset screen says to choose a different one', () => {
    // GoTrue's refusal when the new password equals the old one. It matched no
    // branch and became "Something went sideways. Try again in a moment.",
    // which is advice that cannot ever succeed for this learner.
    const raw = 'New password should be different from the old password.';
    const byCode = friendly({ message: raw, code: 'same_password' });
    const byProse = friendly(raw);

    for (const line of [byCode, byProse]) {
      assert.notEqual(line, GENERIC_FAILURE, 'the learner is told to try again, and trying again cannot work');
      assert.match(line, /different/i, 'the line does not say the one thing that fixes it');
      assert.ok(!/—/.test(line));
      assert.ok(!/\d/.test(line));
      assert.doesNotMatch(line, /supabase|gotrue|auth ?api|token|jwt/i);
    }
    assert.equal(byCode, byProse, 'the same refusal gets two different sentences depending on which half read it');

    // It is a `completePasswordReset` failure, and that screen shows the
    // adapter's message rather than one of its own.
    const screen = read('SetNewPasswordScreen.tsx');
    assert.match(
      screen,
      /setFormMessage\(result\.message\)/,
      'the reset screen no longer shows what the adapter said, so this translation reaches nobody',
    );
    assert.match(screen, /\{formMessage\}/, 'the message is held but never rendered');
  });

  test('a password refused for missing character classes is not called too short', () => {
    // A project with password_required_characters set answers with this. It
    // carries both "password" and "at least", so the old length branch caught
    // it and told the learner to type a longer password, which fails again at
    // any length.
    const raw = 'Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ.';
    const byReason = friendly({ message: raw, code: 'weak_password', reasons: ['characters'] });
    const byProse = friendly(raw);

    for (const line of [byReason, byProse]) {
      assert.doesNotMatch(line, /short|longer/i, `"${line}" tells the learner to lengthen a password that is long enough`);
      assert.notEqual(line, GENERIC_FAILURE, 'a refusal the learner can fix was flattened into an apology');
      assert.match(line, /capital|number|symbol|mix/i, 'the line does not say what to add');
      assert.doesNotMatch(line, /abcdef|ABCDEF/, 'the provider\'s alphabet came along for the ride');
      assert.ok(!/\d/.test(line));
      assert.ok(!/—/.test(line));
    }
    assert.equal(byReason, byProse, 'the code and the English disagree about the same refusal');

    // The other two weak-password refusals still say their own true thing, and
    // the length one still says short.
    assert.equal(
      friendly({ message: 'Password should be at least 6 characters.', code: 'weak_password', reasons: ['length'] }),
      'That password is too short. Try a longer one.',
    );
    assert.equal(
      friendly({
        message: 'Password is known to be weak and easy to guess, please choose a different one.',
        code: 'weak_password',
        reasons: ['pwned'],
      }),
      'That password is easy to guess. Try a different one.',
    );
    // A reason this SDK has never seen still leaves the learner somewhere to go
    // rather than telling them to lengthen or shorten anything.
    const unknown = friendly({ message: 'Password does not meet the policy.', code: 'weak_password', reasons: ['galaxy'] });
    assert.notEqual(unknown, GENERIC_FAILURE);
    assert.doesNotMatch(unknown, /short|longer/i);
    assert.match(unknown, /different/i);
  });
});
