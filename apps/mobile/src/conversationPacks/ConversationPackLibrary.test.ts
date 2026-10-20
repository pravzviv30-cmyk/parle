import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const source = readFileSync(fileURLToPath(new URL('./ConversationPackLibrary.tsx', import.meta.url)), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('Conversation Pack library', () => {
  test('one finite page and a separately resolved bookmark never imply a complete archive', () => {
    assert.match(source, /packs\.slice\(0, CONVERSATION_PAGE_SIZE-unavailableRows\.length\)/);
    assert.match(source, /unavailable\.slice\(0,CONVERSATION_PAGE_SIZE\)/);
    assert.match(source, /Its saved content has not been removed/);
    assert.match(source, /onOpenUnavailable\(row\.id\)/);
    assert.match(source, /onDeleteUnavailable\(row\.id\)/);
    assert.match(source, /linkedPack\?\.id === initialPackId/);
    assert.match(source, /No conversations on this page/);
    for (const label of ['Older conversations', 'Newest conversations', 'Retry loading conversations']) assert.ok(source.includes(label));
    assert.match(source, /paginationPending \|\| busy/);
    assert.match(source, /\{pageNote\}/);
  });
  test('keeps a complete learner-owned route back into a conversation', () => {
    for (const required of [
      'Practice from conversations',
      // 2026-10-20, B3, B-Practice: ported from ce1fa976. The detail names
      // its phrases "Useful phrases", practises the conversation from the
      // footer, and offers the revisit as "Talk about this again"; the list
      // row keeps "Continue talking".
      'Useful phrases',
      'Practise this conversation',
      'Talk about this again',
      'Continue talking',
      'Delete this conversation',
      'Delete all saved conversations',
    ]) {
      assert.ok(source.includes(required), `the library no longer offers ${required}`);
    }
    assert.match(source, /useHardwareBack\(selected !== null/, 'Android back strands a learner inside pack detail');
    assert.match(source, /Full conversation text is saved only if you choose it separately/, 'curated practice is not distinguished from opted-in text');
    assert.match(source, /footer=\{hasPractice \?/, 'the conversation practice action must stay available at the safe-area footer');
    assert.match(source, /if \(initialPackId !== undefined && selected\?\.id === initialPackId\) \{\s*onBack\(\);/, 'a conversation opened from a link strands the learner in a list they never saw');
    assert.equal((source.match(/\.catch\(\(\) => setMessage\(/g) ?? []).length >= 2, true, 'a failed delete leaves the learner with no word');
  });

  test('the tutor revisit is drawn only when the plan opens it, and each route says what it costs', () => {
    // Both Continue talking doors are gated on the callback being present, so
    // a plan that does not open the revisit sees no door at all.
    assert.equal((source.match(/onContinue !== undefined/g) ?? []).length, 2, 'a Continue talking door is drawn without asking whether the plan opens it');
    assert.match(source, /onContinue\?: \(pack: ConversationPack\) => void;/, 'the revisit callback cannot be withheld');
    assert.match(source, /\{RECOMMENDED\.noMinutes\}/, 'practising the conversation does not say it uses no live minutes');
    assert.match(source, /\{PRACTICE_ALTERNATIVES\.revisitUses\}/, 'the tutor revisit does not say it uses live minutes');
    const screen = readFileSync(fileURLToPath(new URL('./ConversationsScreen.tsx', import.meta.url)), 'utf8');
    assert.match(screen, /continueArc === true\s*\?/, 'the library opens the revisit on something other than a real continueArc answer');
    assert.match(screen, /: undefined/, 'a plan that does not open the revisit still gets the door');
  });

  test('explains that deleting history does not remove earned learning', () => {
    assert.match(source, /Your earned phrases and reviews stay\./, 'history deletion claims it deletes more or explains nothing');
    assert.doesNotMatch(source, /transcript/i, 'the Pack library implies readable transcript history exists by default');
  });
});
