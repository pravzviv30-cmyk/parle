// 2026-10-21 UI-008, artboard B-Empty-States: the "Out of speaking time" card
// is decided from the plan band and says its refill only in the band's words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guiltIn } from '../copy/guilt.ts';
import { PLAN_LABELS, type PlanStatusView } from '../purchases/planStatus.ts';
import { AWAY_ART, OUT_OF_TIME, outOfTimeCard } from './emptyStates.ts';

const free = (band: 'plenty' | 'a-little' | 'none', bandLine: string) => ({ known: true, planLabel: PLAN_LABELS.trial, periodLine: 'One free conversation every other day.', band, bandLine, canStart: band !== 'none' }) satisfies PlanStatusView;

test('the free plan with no time left gets the card, with the band line as its refill', () => {
  assert.deepEqual(outOfTimeCard(free('none', 'Your next free conversation is ready on Monday at 4:10 pm.')), {
    title: OUT_OF_TIME.title,
    body: 'Your next free conversation is ready on Monday at 4:10 pm. Your phrases are all still here.',
    action: 'See the plans',
  });
  assert.equal(outOfTimeCard(free('a-little', 'x')), null, 'a learner with time left was told it was used');
  assert.equal(outOfTimeCard({ ...free('none', 'No speaking time left for now.'), planLabel: PLAN_LABELS.starter }), null, 'a paid plan was told about free time');
  assert.equal(outOfTimeCard({ known: false, line: 'x' }), null);
  assert.equal(outOfTimeCard(null), null);
  for (const line of [OUT_OF_TIME.title, OUT_OF_TIME.still]) {
    assert.equal(guiltIn(line), undefined, line);
    assert.ok(!line.includes('—'), line);
  }
  assert.ok(!/7 days|free trial|Monday/.test(`${OUT_OF_TIME.title} ${OUT_OF_TIME.still}`), 'the card promises a trial or a day of its own');
});

test('Speak draws the away card and the out-of-time card from the one empty-state part', () => {
  const speak = readFileSync(new URL('../tabs/TutorTab.tsx', import.meta.url), 'utf8');
  assert.match(speak, /<EmptyStateCard ground="lavender" art=\{AWAY_ART\}/);
  assert.match(speak, /<EmptyStateCard stage figure=\{<Cloud pose="rest" size=\{180\} ink=\{t\.text\} \/>\}/);
  assert.deepEqual(AWAY_ART, { name: 'coffee-break', width: 150, height: 137 });
  assert.match(speak, /const outOfTime = offlineShown \? null : outOfTimeCard\(planView\);/);
  assert.match(speak, /nav\.navigate\('Wall', \{ entry: 'refused' \}\)/);
});

test('the empty-state card can draw a mascot in place of the art, and stand centre stage with no card', () => {
  const card = readFileSync(new URL('./EmptyStateCard.tsx', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/\s+/g, ' ');
  assert.match(card, /\{art \? <BArt name=\{art\.name\} width=\{art\.width\} height=\{art\.height\} \/> : figure\}/, 'the mascot is not drawn in place of the art');
  assert.match(card, /<View style=\{stage \? s\.stage : \[s\.card, \{ backgroundColor: t\[ground\] \}\]\}>/, 'centre stage still draws the card');
  assert.match(card, /style=\{\[stage \? bType\.title26 : bType\.bold19, s\.centred, \{ color: t\.text \}\]\}/, 'the stage title is not the larger title');
  assert.match(card, /<Text style=\{\[bType\.para15, s\.centred, \{ color: t\.secondary \}\]\}>\{body\}<\/Text>/);
  assert.match(card, /card: \{ borderRadius: 26, paddingVertical: 20, paddingHorizontal: 18, gap: 8, alignItems: 'center', alignSelf: 'stretch' \}/);
  assert.match(card, /stage: \{ gap: 8, alignItems: 'center', alignSelf: 'stretch' \}/, 'the stage has a ground, radius or padding');
});

// Quiet moments (4A), 2026-11-04: centre stage on the two board screens, and Cloud's cheer on the two "nothing to review" cards.
const flatSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}|\/\/.*$/gm, '').replace(/\s+/g, ' ');

test('the empty phrasebook is centre stage: Cloud holding the book, the body line, and Choose a scene in the foot', () => {
  const book = flatSource('../phrases/PhrasebookScreen.tsx');
  assert.match(book, /export function PhrasebookEmpty\(\{ title, body \}: \{ title: string; body: string \}\)/);
  assert.match(book, /<View style=\{\{ flexGrow: 1, justifyContent: 'center' \}\}> <EmptyStateCard stage figure=\{<Cloud pose="hold" size=\{170\} ink=\{t\.text\} \/>\} title=\{title\} body=\{body\} action=\{null\} \/> <\/View>/);
  assert.match(book, /export const PHRASEBOOK_EMPTY = \{ title: 'Your first kept phrase lands here\.', body: 'Keep a line in a conversation and it waits here, ready to hear again\.', action: 'Choose a scene' \} as const;/);
  assert.match(book, /const empty = visibleBook !== null && !hasPhrases\(visibleBook\) && !hasSaved\(visibleBook\) && query\.trim\(\) === '';/);
  assert.match(book, /<ScrollScreen bottom="inset" header=\{<ScreenHeader back=\{\{ onPress: onBack \}\} \/>\} footer=\{empty \? <PillButton label=\{PHRASEBOOK_EMPTY\.action\} onPress=\{\(\) => nav\.navigate\('Missions'\)\} lip \/> : undefined\}>/, 'Choose a scene is not the pinned foot while empty');
  assert.match(book, /\{empty && <PhrasebookEmpty title=\{PHRASEBOOK_EMPTY\.title\} body=\{PHRASEBOOK_EMPTY\.body\} \/>\}/);
  assert.doesNotMatch(book, /NOTEBOOK_ART/, 'the phrasebook still draws the notebook card');
});

test('Speak out of the free conversation is centre stage with Cloud at rest, and the scene hero is unchanged', () => {
  const speak = flatSource('../tabs/TutorTab.tsx');
  assert.match(speak, /export function OutOfTimeMoment\(\{ card, onPlans \}: \{ card: \{ title: string; body: string; action: string \}; onPlans: \(\) => void \}\)/);
  assert.match(speak, /<EmptyStateCard stage figure=\{<Cloud pose="rest" size=\{180\} ink=\{t\.text\} \/>\} title=\{card\.title\} body=\{card\.body\} action=\{\{ label: card\.action, onPress: onPlans \}\} \/>/);
  assert.match(speak, /\{outOfTime !== null && <OutOfTimeMoment card=\{outOfTime\} onPlans=\{\(\) => nav\.navigate\('Wall', \{ entry: 'refused' \}\)\} \/>\} <View style=\{st\.hero\} onLayout=\{\(event\) => setHeroWidth\(Math\.round\(event\.nativeEvent\.layout\.width\)\)\}> \{heroSide \? <BArt name="cafe-table" width=\{150\} height=\{137\} style=\{st\.heroArt\} \/>/, 'the scene hero moved or changed under the moment');
  assert.doesNotMatch(speak, /OUT_OF_TIME_ART|clock-calendar/);
});

test('the two "nothing to review" cards draw Cloud cheering, in a card, with their words and Done', () => {
  for (const [path, title, done] of [['../ReviewScreen.tsx', 'Nothing waiting.', 'onDone'], ['../DrillScreen.tsx', 'Nothing to review.', 'finishAndLeave']] as const) {
    const src = flatSource(path);
    const at = src.indexOf(`title="${title}"`);
    assert.ok(at > 0, path);
    const card = src.slice(src.lastIndexOf('<EmptyStateCard', at), src.indexOf('/>', src.indexOf('action=', at)) + 2);
    assert.match(card, /^<EmptyStateCard figure=\{<Cloud pose="cheer" size=\{150\} ink=\{b?t\.text\} \/>\} title=/, `${path}: not the posed cheer`);
    assert.doesNotMatch(card, /stage|cloud-cheer/, `${path}: centre stage, or the old drawing`);
    assert.ok(card.includes('body="Your next session adds more."'), path);
    assert.ok(card.includes(`action={{ label: 'Done', onPress: ${done} }}`), path);
  }
});

test('the quiet previews draw the extracted parts inside a ScrollScreen, as their screens do', () => {
  const preview = flatSource('../dev/OnboardingPreview.tsx');
  assert.match(preview, /'quiet-toast', 'quiet-phrasebook', 'quiet-speak',/);
  assert.match(preview, /'quiet-phrasebook': 'Phrasebook, nothing kept yet', 'quiet-speak': 'Speak, out of the free conversation',/);
  assert.match(preview, /\{screen === 'quiet-phrasebook' && <ScrollScreen bottom="inset" footer=\{<PillButton label=\{PHRASEBOOK_EMPTY\.action\} onPress=\{\(\) => go\('select'\)\} lip \/>\}><PhrasebookEmpty title=\{PHRASEBOOK_EMPTY\.title\} body=\{PHRASEBOOK_EMPTY\.body\} \/><\/ScrollScreen>\}/);
  assert.match(preview, /\{screen === 'quiet-speak' && <ScrollScreen bottom="inset"><OutOfTimeMoment card=\{QUIET_OUT_OF_TIME\} onPlans=\{\(\) => go\('select'\)\} \/><\/ScrollScreen>\}/);
});
