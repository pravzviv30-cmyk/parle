import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const home = read('../tabs/HomeTab.tsx');
const details = read('./ProgressScreen.tsx');
const compact = read('../home/HomeMomentum.tsx');

// Names retain the ledger links; the approved redesign moves these contracts inline.
test('the progress screen keeps the momentum, the week story and the word of the day', () => {
  assert.match(home, /setMomentum\(momentumFrom\(\{ activity, deck, profile, now, activeDays \}\)\)/);
  assert.match(home, /setStory\(storyFrom\(\{ sessions: history, activity, packs, completions, now \}\)\)/);
  assert.match(home, /setRows\(canDoRows\(stampsFrom\(progress\)\)\)/);
  for (const content of ['<HomeMomentum', '<DailyCarousel', '<HomeProgressDetails']) assert.ok(home.includes(content));
  for (const label of ['Days active', 'Retained phrases', 'Recall', 'Speaking time']) assert.ok(compact.includes(label));
  assert.doesNotMatch(home, /navigate\('Progress'\)|<AbilitiesCard/);
  assert.doesNotMatch(read('../nav/RootNavigator.tsx'), /name="Progress"|function ProgressRoute/);
  assert.match(details, /hasStory\(story\)/);
  assert.match(details, /hasCanDo\(rows\)/);
  assert.match(details, /nav.navigate\('Convo', \{ missionId: row.missionId \}\)/);
});
test('the weekly story is a restrained French postcard, not another dashboard', () => {
  assert.match(details, /useState\(false\)/);
  assert.match(details, /if \(!hasWeek && !hasAbilities\) return null/);
  assert.match(details, /expanded &&/);
  assert.match(details, /story.sentences.map/);
  assert.match(details, /<TintPanel tint="lilac"/);
  for (const copy of ['POSTCARD_TITLE','POSTCARD_NOTE','CAN_DO_LABEL']) assert.ok(details.includes(copy));
  assert.doesNotMatch(details, /Share|onShare|expo-sharing/);
});
test('the screen wears the one frame, shows one way back, and decides nothing it draws', () => {
  assert.equal((home.match(/<ScrollScreen\b/g) ?? []).length, 1);
  assert.doesNotMatch(details, /<ScrollScreen|<ScreenHeader|useSafeAreaInsets|<ScrollView/);
  assert.doesNotMatch(details, /fontSize:|fontFamily:|lineHeight:|#[\da-f]{6}|numberOfLines|maxFontSizeMultiplier|allowFontScaling|adjustsFontSizeToFit/);
  assert.doesNotMatch(details, /Math\.|toFixed\(|—/);
});
