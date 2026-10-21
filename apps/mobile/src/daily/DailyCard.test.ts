import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const card = readFileSync(new URL('./DailyCard.tsx', import.meta.url), 'utf8');

test('unread bookmark state never presents Save or toggles over unknown work', () => {
  assert.match(card, /saveRead\?\.owner === owner \? saveRead\.saved : null/, 'another account can supply this card’s save state');
  assert.match(card, /if \(busy \|\| saved === null \|\| owner !== scopeGeneration\(\)\) return;/, 'unknown save state can be toggled');
  assert.match(card, /saved === null \? saveUnread \? 'Save unavailable' : 'Checking save…' : saved \? 'Saved ✓' : 'Save'/, 'unread is presented as unsaved');
  assert.match(card, /disabled=\{saved === null \|\| busy\}/, 'the unknown save control remains tappable');
  assert.match(card, /setSaveRead\(null\); setSaveUnread\(true\);/, 'a failed verification is presented as a known state');
});

test('failed read has a visible retry while local audio and text practice remain usable', () => {
  assert.match(card, /Save status unavailable\. You can still hear and practise this phrase\./);
  assert.match(card, /Retry save status/);
  assert.match(card, /setReadAttempt\(value => value \+ 1\)/);
  // 2026-10-20, B5, B-Today: Today's lavender card carries no save (the
  // library card keeps it), so only the collection variant draws the save's
  // recovery. Today keeps its play disc and its one way to practise.
  assert.equal((card.match(/\{saveFailure\}/g) ?? []).length, 1, 'the collection variant needs visible recovery');
  const today = card.slice(card.indexOf("if (variant === 'today')"), card.indexOf('return embedded ?'));
  assert.doesNotMatch(today, /save\(\)|bookmark/, "Today's phrase offers a save it cannot recover from");
  assert.match(card, /onHear=\{asset != null \? toggle : undefined\}/);
  // 2026-10-20 UI-008, artboard B-Today: the lavender card is today/TodayParts
  // PhraseCard; the one practice and the play toggle are still this card's.
  assert.match(card, /sayLabel="Say it yourself"\s+sayAccessibilityLabel="Say today's phrase yourself"\s+onSay=\{sayIt\}/);
});
