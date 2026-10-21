/**
 * Profile, Settings and the memory screen each own what they say they own — Stage 3.
 *
 * Profile is who the learner is and how they learn. Settings is the account,
 * the plan, privacy and help. The tutor memory screen is what the tutor holds.
 * Three rules keep those apart, and each is one a later edit can quietly break:
 *
 * - A preference edited in two places reads the same in both, over one stored
 *   value. Correction style is on Profile and on the memory screen, on purpose
 *   (how the tutor treats you belongs beside what it knows about you), so the
 *   two rows are held to being the same row. The speaking target has exactly
 *   one editor: Home's tile opens Profile rather than growing a second one.
 * - Delete account is not a routine row. It sits in a group of its own at the
 *   foot of Settings, away from Email and Sign out, with the same confirmation.
 * - Profile's own comments say where the way to Settings is: the gear.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (path: string): string => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sources(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const PROFILE_RAW = read('../tabs/ProfileTab.tsx');
const PROFILE = stripComments(PROFILE_RAW);
const MEMORY = stripComments(read('../profile/TutorMemoryScreen.tsx'));
// Since P2 (2026-10-19) the learner's standing choices are one row away from
// Profile, on Learning preferences, so that is where Profile's half is read.
const LEARNING = stripComments(read('./LearningPreferencesScreen.tsx'));
const SETTINGS = stripComments(read('./SettingsScreen.tsx'));

/** The `<ChoiceRow<Strictness> … />` element, whitespace folded and `first` dropped. */
function strictnessRow(source: string, where: string): string {
  const at = source.indexOf('<ChoiceRow<Strictness>');
  assert.notEqual(at, -1, `${where} has no correction-style row`);
  const end = source.indexOf('/>', source.indexOf('accessibilityLabel={STRICTNESS_ROW}', at));
  assert.ok(end > at, `${where}'s correction-style row is never closed`);
  return source.slice(at, end).replace(/\s+/g, ' ').replace(/ first\b/, '').trim();
}

describe('one stored value, one way of saying it — Stage 3', () => {
  test('correction style reads the same on Learning preferences and on the memory screen, over the one stored value', () => {
    const profile = strictnessRow(LEARNING, 'Learning preferences');
    const memory = strictnessRow(MEMORY, 'the memory screen');
    assert.equal(memory, profile, 'the two correction-style rows have drifted apart in wording, options or what they write');
    assert.match(profile, /onChange=\{\(value\) => update\(withStrictness\(profile, value\)\)\}/, 'the row writes somewhere other than the one door');
    assert.match(profile, /title=\{STRICTNESS_ROW\}/, 'the row spells its own name');

    // The bite: a row with a different title is caught.
    const drifted = profile.replace('title={STRICTNESS_ROW}', "title={'Corrections'}");
    assert.notEqual(drifted, profile, 'the comparison cannot see a changed title');
  });

  test('the speaking target has exactly one editor, and it is on Learning preferences', () => {
    const writers = sources(SRC)
      .filter((file) => /\bwithDailyGoal\(/.test(stripComments(readFileSync(file, 'utf8'))))
      .map((file) => relative(SRC, file))
      .filter((file) => file !== join('profile', 'store.ts'))
      // 2026-10-20 UI-008: the development-only canvas learner seeds the mock
      // account's goal once for screenshots; it is a fixture, not an editor.
      .filter((file) => file !== join('dev', 'canvasLearner.ts'))
      .sort();
    assert.deepEqual(writers, [join('settings', 'LearningPreferencesScreen.tsx')], 'a second screen edits the speaking target');
    // 2026-10-07, come alive Phase 4 (F769): the goal is five choices under the
    // row's name, drawn as its heading and its group's spoken name.
    const rows = sources(SRC)
      .filter((file) => /accessibilityLabel=\{DAILY_GOAL_ROW\}/.test(stripComments(readFileSync(file, 'utf8'))))
      .map((file) => relative(SRC, file));
    assert.deepEqual(rows, [join('settings', 'LearningPreferencesScreen.tsx')], 'the speaking target row is drawn somewhere other than Learning preferences');
  });
});

describe('Delete account stands apart from routine rows — Stage 3', () => {
  test('the delete row is alone in its own group at the foot of Settings, and still opens the confirmation', () => {
    const list = SETTINGS.slice(SETTINGS.lastIndexOf('  return ('));
    const groups = list.match(/<SettingsGroup\b[\s\S]*?<\/SettingsGroup>/g) ?? [];
    const holding = groups.filter((group) => group.includes('label={DELETE_ROW}'));
    assert.equal(holding.length, 1, 'the delete row is in no group, or in two');
    const own = holding[0]!;
    assert.equal((own.match(/<SettingsRow\b/g) ?? []).length, 1, 'the delete row shares its group with a routine row');
    assert.match(own, /destructive/, 'the delete row is not drawn as a destructive row');
    assert.doesNotMatch(own, /title=/, 'the delete group carries a heading, which makes it read as one more routine group');

    // Not in the Account group beside Email and Sign out.
    const account = groups.find((group) => group.includes('label={EMAIL_ROW}'));
    assert.ok(account, 'the Account group is gone');
    assert.ok(account.includes('label={SIGN_OUT_ROW}'), 'Sign out left the Account group');
    assert.ok(!account.includes('DELETE_ROW'), 'Delete account still sits beside the routine account rows');

    // Last on the screen: after every group, including Help and about.
    assert.ok(list.indexOf('title={HELP_GROUP}') !== -1 && list.indexOf('title={HELP_GROUP}') < list.indexOf('label={DELETE_ROW}'), 'the delete group is drawn among the routine groups');
    assert.equal(groups[groups.length - 1], own, 'something is drawn after the delete group');

    // Same door into the same confirmation.
    const row = SETTINGS.slice(SETTINGS.indexOf('label={DELETE_ROW}'), SETTINGS.indexOf('label={DELETE_ROW}') + 300);
    assert.ok(row.indexOf('forgetDeleteDraft()') !== -1 && row.indexOf('forgetDeleteDraft()') < row.indexOf("setSheet('delete')"), 'the delete row no longer opens a clean confirmation');
    assert.match(SETTINGS, /label=\{deleting \? 'Verifying…' : 'Verify and delete permanently'\}/, 'the confirmation changed');
  });
});

describe('Profile says where its way to Settings is — P2', () => {
  test('the gear is drawn first, beside the title, and the comments say it is the one way there', () => {
    // 2026-10-20 UI-008, artboard B-Profile: the screen's own return, not a hook's cleanup below it.
    const body = PROFILE.slice(PROFILE.indexOf('<SettingsAppearance b>'));
    // 2026-10-20 UI-008, artboard B-Profile: the gear is the IconDisc labelled with the row's word.
    const gear = body.indexOf('label={SETTINGS_ROW}');
    assert.ok(gear !== -1 && gear < body.indexOf('{initialOf(profile.name)}'), 'the gear is no longer drawn above the learner');
    assert.doesNotMatch(PROFILE_RAW, /last on the screen/i, 'a comment still says the Settings row is last');
    assert.doesNotMatch(PROFILE_RAW, /the row at the foot/i, 'a comment still says the Settings row is at the foot');
    assert.match(PROFILE_RAW, /The gear is the one way to Settings/, 'no comment says where the way to Settings actually is');
  });
});

describe('the memory screen says what clearing does and does not touch — Stage 3', () => {
  test('clearing remembered details is confirmed and says saved conversations stay', () => {
    const flat = MEMORY.replace(/\s+/g, ' ');
    assert.match(flat, /<ConfirmSheet visible=\{clearing\}/, 'clearing is not confirmed');
    assert.match(flat, /body="[^"]*saved conversations will stay\."/, 'the confirmation does not say saved conversations are kept');
    assert.match(flat, /Clearing details keeps your goals, correction preferences and saved conversations\./, 'the screen does not say what clearing keeps');
  });
});
