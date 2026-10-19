import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

test('every empty list shows its drawing and one first action', () => {
  for (const path of ['phrases/PhrasebookScreen.tsx', 'conversationPacks/ConversationPackLibrary.tsx', 'profile/TutorMemoryScreen.tsx']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    if (path.includes('ConversationPackLibrary')) {
      const begin = source.indexOf("ordered.length === 0 && unavailableRows.length === 0");
      assert.ok(begin >= 0);
      const empty = source.slice(begin, source.indexOf('</View>', begin));
      assert.match(empty, /<MainFeature[\s\S]*?motif="phrases"/);
      assert.match(empty, /<MainButton label="Choose a situation" onPress=\{\(\) => nav.navigate\('Missions'\)\}/);
      assert.equal((empty.match(/<MainButton /g) ?? []).length, 1);
      continue;
    }
    if (path.includes('TutorMemory')) {
      const art = source.indexOf('<MainIllustration motif="journal"');
      const end = source.indexOf(') : (', art);
      assert.ok(art >= 0 && end > art, 'Tutor Memory must draw its cloud-family empty state');
      const empty = source.slice(art, end);
      assert.match(empty, /<MainIllustration motif="journal" theme=\{mode\} width=\{160\} active=\{focused\} \/>/);
      assert.match(empty, /\{memoryEmptyLine\(profile\)\}/, 'empty memory still needs an honest explanation');
      assert.match(empty, /<IconAction ground=\{mode === 'dark' \? 'blue' : 'paper'\} layout="inline" icon="chat" label="Choose a scene" onPress=\{\(\) => nav.navigate\('Missions'\)\}/);
      assert.equal((empty.match(/<(?:PillButton|IconAction) /g) ?? []).length, 1);
      continue;
    }
    const art = source.indexOf('<Illustration name="state-notebook"');
    assert.ok(art >= 0, path);
    const end = path.includes('TutorMemory') ? source.indexOf(') : (', art) : source.indexOf('</Card>', art);
    const empty = source.slice(art, end);
    assert.match(empty, /<(?:PillButton|IconAction layout="inline" icon="chat") label="Choose a scene" onPress=\{\(\) => nav.navigate\('Missions'\)\}/, path);
    assert.equal((empty.match(/<(?:PillButton|IconAction) /g) ?? []).length, 1, path);
  }
});
