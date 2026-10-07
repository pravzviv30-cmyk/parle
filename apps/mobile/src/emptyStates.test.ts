import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

test('every empty list shows its drawing and one first action', () => {
  for (const path of ['phrases/PhrasebookScreen.tsx', 'conversationPacks/ConversationPackLibrary.tsx', 'profile/TutorMemoryScreen.tsx']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const art = source.indexOf('<Illustration name="state-notebook"');
    assert.ok(art >= 0, path);
    const end = path.includes('TutorMemory') ? source.indexOf(') : (', art) : source.indexOf('</Card>', art);
    const empty = source.slice(art, end);
    assert.match(empty, /<(?:PillButton|IconAction layout="inline" icon="chat") label="Choose a scene" onPress=\{\(\) => nav.navigate\('Missions'\)\}/, path);
    assert.equal((empty.match(/<(?:PillButton|IconAction) /g) ?? []).length, 1, path);
  }
});
