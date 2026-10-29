/**
 * The Help and feedback sheet (F922), read as a plain view and out of the two
 * screens that open it. No renderer: the copy and the rules live in
 * `helpSheet.ts`, and the screens are held to using them.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { PLANS } from '@luvani/core';
import { guiltIn } from '../copy/guilt.ts';
import { PRIMER_REFUSED, PRIMER_REFUSED_WEB } from '../onboarding/micPrimer.ts';
import { TYPE_INSTEAD } from '../tutor/speakView.ts';
import { LEAVE_KEEPS_WORK } from '../live/leaveConfirm.ts';
import { PREVIEW_COPY } from '../scenes/scenePreview.ts';
import { LOCAL_PRACTICE_ROW, LOCAL_PRACTICE_SUB, LINK_TROUBLE } from './sections.ts';
import { YOURS_ROWS, conversationLength, trialAllowance } from '../wall/wallCopy.ts';
import { conversationsIn } from '../wall/wallPlans.ts';
import { contactRow } from '../legal/company.ts';
import { CONNECTED_TYPING, HELP_WRITE_ACTION, helpSheet, helpTrouble } from './helpSheet.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}
const allText = (web: boolean): string[] => {
  const v = helpSheet(web, 'hello@example.com');
  return [v.title, ...v.answers.flatMap((a) => [a.heading, ...a.lines]), v.write.heading, v.write.line, v.write.address, v.write.action];
};

describe('help and feedback', () => {
  test('help opens an in-app sheet with the mail address shown as text', () => {
    const profile = stripComments(read('../tabs/ProfileTab.tsx'));
    const settings = stripComments(read('./SettingsScreen.tsx'));
    for (const [name, src] of [['Profile', profile], ['Settings', settings]] as const) {
      assert.match(src, /label=\{HELP_FEEDBACK_ROW\}[^\n]*onPress=\{\(\) => (?:\{ setContactTrouble\(null\); )?setSheet\('help'\);? ?\}?\}/, `${name}: the help row does not open the sheet`);
      assert.match(src, /<HelpSheet visible=\{sheet === 'help'\}/, `${name}: the help sheet is not drawn`);
    }
    assert.doesNotMatch(profile, /HELP_FEEDBACK_ROW\}[^\n]*openMail/, 'Profile still hands the help row straight to mail');
    const sheet = stripComments(read('./HelpSheet.tsx'));
    assert.match(sheet, /selectable[^\n]*\{view\.write\.address\}/, 'the address is not drawn as selectable text');
    assert.match(sheet, /<TroubleLine message=\{trouble\} \/>/, 'a mail app that will not open says nothing');
    const v = helpSheet(false, 'hello@luvani.app');
    assert.equal(v.write.address, 'hello@luvani.app');
    assert.equal(v.answers.length, 5);
  });

  test('every answer is built from the copy the app already says', () => {
    const native = helpSheet(false, 'a@b.c');
    const web = helpSheet(true, 'a@b.c');
    assert.deepEqual(native.answers[0]!.lines, [PRIMER_REFUSED]);
    assert.deepEqual(web.answers[0]!.lines, [PRIMER_REFUSED_WEB]);
    assert.ok(native.answers[1]!.lines.some((l) => l.includes(TYPE_INSTEAD)));
    assert.ok(native.answers[1]!.lines.includes(CONNECTED_TYPING));
    assert.ok(conversationLength(10).endsWith(CONNECTED_TYPING), 'the typing line drifted from the wall');
    assert.ok(native.answers[2]!.lines.includes(PREVIEW_COPY.footnote));
    assert.ok(native.answers[2]!.lines.some((l) => l.includes(LOCAL_PRACTICE_ROW) && l.toLowerCase().includes(LOCAL_PRACTICE_SUB.toLowerCase())));
    assert.ok(native.answers[3]!.lines.includes(LEAVE_KEEPS_WORK));
    for (const row of YOURS_ROWS) assert.ok(native.answers[4]!.lines.includes(row), `Free leaves out "${row}"`);
    const minutes = Math.floor(PLANS.trial.secondsPerPeriod / 60);
    assert.equal(native.answers[4]!.lines[0], trialAllowance(minutes, conversationsIn(minutes)));
  });

  test('the trouble line is the shared one, and only after a failure', () => {
    assert.equal(helpTrouble('failed'), LINK_TROUBLE);
    assert.equal(helpTrouble('done'), null);
    assert.equal(HELP_WRITE_ACTION, helpSheet(false, 'a@b.c').write.action);
  });

  test('a trouble line from an earlier tap never greets a reopened sheet', () => {
    const settings = stripComments(read('./SettingsScreen.tsx'));
    assert.match(settings, /label=\{HELP_FEEDBACK_ROW\}[^\n]*onPress=\{\(\) => \{ setContactTrouble\(null\); setSheet\('help'\); \}\}/, 'Settings opens the sheet on a stale trouble line');
    assert.match(settings, /<HelpSheet visible=\{sheet === 'help'\} onClose=\{\(\) => \{ setContactTrouble\(null\); setSheet\('none'\); \}\}/, 'Settings closes the sheet and keeps the trouble line');
    const profile = stripComments(read('../tabs/ProfileTab.tsx'));
    assert.match(profile, /case 'help':\s*setHelpLine\(null\);/, 'Profile keeps a stale trouble line');
    assert.match(profile, /<HelpSheet visible=\{sheet === 'help'\} onClose=\{closeCurrentSheet\}/);
  });

  test('the address is the company one', () => {
    assert.ok(contactRow() !== null);
  });

  test('the words are warm and plain', () => {
    for (const line of [...allText(false), ...allText(true)]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a word Luvani does not say`);
      assert.doesNotMatch(line, /[·—–]/, `"${line}" carries a dash or middot`);
    }
  });
});
