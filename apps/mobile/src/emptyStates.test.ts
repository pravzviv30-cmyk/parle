import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

// 2026-10-21 UI-008, B-Empty-States anatomy: every empty list is the one B
// empty-state card (radius 26, the canvas drawing, a 19 bold title, one 46 ink
// button). The drawing and one first action stay the rule; they now arrive as
// the card's props rather than an Illustration and a pill beside it.
test('every empty list shows its drawing and one first action', () => {
  for (const path of ['phrases/PhrasebookScreen.tsx', 'conversationPacks/ConversationPackLibrary.tsx', 'profile/TutorMemoryScreen.tsx']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const at = source.indexOf('<EmptyStateCard art={NOTEBOOK_ART}');
    assert.ok(at >= 0, path);
    const card = source.slice(at, source.indexOf('/>', source.indexOf("nav.navigate('Missions')", at)) + 2);
    assert.match(card, /action=\{\{ label: 'Choose a scene', onPress: \(\) => nav\.navigate\('Missions'\) \}\}/, path);
    assert.equal((card.match(/<(?:PillButton|IconAction|BButton) /g) ?? []).length, 0, `${path} draws a second action beside the card's own`);
    assert.doesNotMatch(source, /state-notebook/, `${path} still draws the retired notebook beside the card`);
  }
});

test('the empty-state card is the artboard anatomy, from the theme', () => {
  const card = readFileSync(new URL('empty/EmptyStateCard.tsx', import.meta.url), 'utf8');
  assert.match(card, /card: \{ borderRadius: 26, paddingVertical: 20, paddingHorizontal: 18, gap: 8, alignItems: 'center'/);
  assert.match(card, /<BArt name=\{art\.name\} width=\{art\.width\} height=\{art\.height\} \/>/);
  assert.match(card, /bType\.bold19/);
  assert.match(card, /bType\.para15/);
  assert.match(card, /<BButton hug label=\{action\.label\}[^>]*height=\{46\} ground=\{t\.primary\} ink=\{t\.onPrimary\} text=\{bType\.bold15\}/);
  assert.doesNotMatch(card, /#[0-9A-Fa-f]{6}/, 'a colour outside the palette');
});

test('Review, all done is the cloud-cheer card with its one door', () => {
  const review = readFileSync(new URL('ReviewScreen.tsx', import.meta.url), 'utf8');
  assert.match(review, /<EmptyStateCard\s+art=\{\{ name: 'cloud-cheer', width: 150, height: 114 \}\}\s+title="Nothing waiting\."/);
  assert.match(review, /action=\{\{ label: 'Done', onPress: onDone \}\}/);
});
