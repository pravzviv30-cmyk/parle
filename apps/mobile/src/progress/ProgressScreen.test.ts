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
  for (const label of ['Days active', 'Retained phrases', 'Recall', 'Practice time']) assert.ok(compact.includes(label));
  // Phase 1B: the tile is active learning time, not speaking, and never the metered balance.
  assert.doesNotMatch(compact, /Speaking time|timed speaking/);
  assert.match(compact, /goal\.untimedNote/, 'Home hides the note that explains untimed legacy sittings');
  assert.doesNotMatch(home, /navigate\('Progress'\)|<AbilitiesCard/);
  assert.doesNotMatch(read('../nav/RootNavigator.tsx'), /name="Progress"|function ProgressRoute/);
  assert.match(details, /hasStory\(story\)/);
  assert.match(details, /hasCanDo\(rows\)/);
  assert.match(details, /nav.navigate\('Convo', \{ missionId: row.missionId \}\)/);
});
test('the Home practice tile says under a minute when time was measured, never nothing timed — Stage 1 browser proof', () => {
  const flat = compact.replace(/\s+/g, ' ');
  // The tile reads whether anything was measured from momentum.ts, not from the
  // floored minutes: a timed sitting of a few seconds is zero minutes and was
  // still timed, so a `minutes > 0` branch is what told the learner otherwise.
  assert.doesNotMatch(flat, /goal\.minutes > 0/, 'the tile decides "nothing timed" from floored minutes, so a sub-minute sitting reads as untimed');
  assert.match(flat, /accessibilityLabel=\{`Practice time today\. \$\{goal\.measured \?\? 'No active practice timed yet'\}\./, 'the spoken label does not follow the measured amount');
  assert.match(flat, /<Text style=\{s\.value\}>\{goal\.measured \?\? 'Ready when you are'\}<\/Text>/, 'the visible value does not follow the measured amount');
});
test('DESIGN.md names the Home tile Practice time in its composition rules — Stage 1', () => {
  const design = read('../../../../DESIGN.md');
  const bullet = design.split('\n- ').find((b) => b.startsWith('Home: greeting'));
  assert.ok(bullet !== undefined, 'DESIGN.md has no Home composition bullet, so this test is reading the wrong thing');
  const flatBullet = bullet.replace(/\s+/g, ' ');
  assert.match(flatBullet, /Days active, Retained phrases, Recall and Practice time/, 'DESIGN.md does not name the four Home tiles as they ship');
  assert.doesNotMatch(flatBullet, /Speaking time/, 'DESIGN.md still calls the Home tile Speaking time');
  assert.match(flatBullet, /idle/, 'DESIGN.md does not say idle time is left out');
  assert.match(flatBullet, /billed|metered/, 'DESIGN.md does not keep practice time apart from billed minutes');
});
test('the weekly story is a restrained French postcard, not another dashboard', () => {
  assert.match(details, /useState\(false\)/);
  // Stage 4 (2026-09-25): a week with only a reflection (say, one measured
  // sound check and nothing the story reads) still opens; a week with none of
  // the three still draws nothing at all.
  assert.match(details, /if \(!hasWeek && !hasAbilities && !hasWeekly\) return null/);
  assert.match(details, /expanded &&/);
  assert.match(details, /story.sentences.map/);
  assert.match(details, /<TintPanel tint="lilac"/);
  for (const copy of ['POSTCARD_TITLE','POSTCARD_NOTE','CAN_DO_LABEL']) assert.ok(details.includes(copy));
  assert.doesNotMatch(details, /Share|onShare|expo-sharing/);
});
// Stage 4 (2026-09-25): the weekly reflection lives in the same expansion.
test('the weekly reflection draws inside the expansion, only when there is something to say, in its own words', () => {
  const flat = details.replace(/\s+/g, ' ');
  assert.match(flat, /reflection: Reflection \| null/, 'the details take the reflection as something other than the pure value');
  assert.match(flat, /const hasWeekly = reflection !== null && hasReflection\(reflection\);/);
  assert.match(flat, /if \(!hasWeek && !hasAbilities && !hasWeekly\) return null;/, 'a week with only a reflection draws no way to open it, or a week with nothing draws a slot');
  assert.match(flat, /\{hasWeekly && /, 'the reflection is drawn with nothing behind it');
  const expanded = details.indexOf('{expanded &&');
  assert.ok(expanded >= 0 && details.indexOf('{hasWeekly &&') > expanded, 'the reflection is drawn outside the learner\'s own expansion');
  for (const line of ['REFLECTION_COPY.improvement', 'REFLECTION_COPY.focus', 'REFLECTION_COPY.next']) assert.ok(details.includes(line));
  assert.match(flat, /reflection\.improvement !== null && /);
  assert.match(flat, /reflection\.focus !== null && /);
  assert.match(flat, /reflection\.next !== null && /);
  assert.match(flat, /nav\.navigate\('Convo', \{ missionId: reflection\.next!\.missionId \}\)/, 'the next place opens something other than its mission');
  assert.match(flat, /tint=\{missionTint\(reflection\.next\.place\)\} glyph=\{<PlaceGlyph place=\{reflection\.next\.place\}/, 'the next row draws a place other than the one it opens');
  assert.equal((details.match(/<PillButton\b/g) ?? []).length, 0, 'the weekly details grew a primary; Home has one');
  // The story module keeps its two readers (F233): the reflection arrives as a value.
  assert.doesNotMatch(read('./reflection.ts'), /from '\.\/story\.ts'/);
});

test('the screen wears the one frame, shows one way back, and decides nothing it draws', () => {
  assert.equal((home.match(/<ScrollScreen\b/g) ?? []).length, 1);
  assert.doesNotMatch(details, /<ScrollScreen|<ScreenHeader|useSafeAreaInsets|<ScrollView/);
  assert.doesNotMatch(details, /fontSize:|fontFamily:|lineHeight:|#[\da-f]{6}|numberOfLines|maxFontSizeMultiplier|allowFontScaling|adjustsFontSizeToFit/);
  assert.doesNotMatch(details, /Math\.|toFixed\(|—/);
});
