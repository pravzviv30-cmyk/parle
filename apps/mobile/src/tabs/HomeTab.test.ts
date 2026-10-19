/** C2/M2/M3 surface contracts. Historical defect-linked test titles stay stable.
 * The approved October design supersedes their old exact visual strings.
 * Pure owners test policy; this suite checks live source wiring, not native layout.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guiltIn } from '../copy/guilt.ts';
const read = (file: string): string => readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const flat = (s: string): string => s.replace(/\s+/g, ' ');
const SCREEN = read('./HomeTab.tsx');
const FLAT = flat(SCREEN);
const LEARNING = flat(read('../main/useMainLearning.ts'));
const START = flat(read('../main/useConversationStart.ts'));
const REQUEST = flat(read('../main/conversationStartRequest.ts'));
const SHARED = read('../main/MainUI.tsx');
test("the greeting is static: the hour's French word, the first name, a full stop, and no rotation", () => {
  assert.match(FLAT, /<MainScreen title=\{profile.name\?\.trim\(\) \? `Bonjour \$\{profile.name.trim\(\)\}` : 'Bonjour'\}/);
  assert.doesNotMatch(SCREEN, /useGreetingRotation|titleSwap|setInterval|setTimeout|requestAnimationFrame/);
  assert.match(SHARED, /accessibilityRole="header"/);
  assert.match(SHARED, /Profile and display settings/);
});

test("the hero is the spine's next scene, drawn on the blue brief with the meta line the rule decides", () => {
  assert.match(FLAT, /learningSuggestions\(practicePreferencesOf\(profile\)\)/);
  assert.match(FLAT, /motif="cloud" body=\{suggestions.homeBody\}/);
  assert.match(FLAT, /conversation.start\(suggestions.freeSeed \? \{ seedTopic: suggestions.freeSeed \} : \{\}\)/);
  assert.doesNotMatch(SCREEN, /brain\.cefr\s*=|recordActivity\(|gradeCards\(/);
});

test("one Start speaking, white on the blue card, launching the scene directly, with the other mode as a quiet link", () => {
  assert.match(FLAT, /Speak with \$\{tutorNameOf\(profile\)\}/);
  assert.match(FLAT, /disabled: conversation.checking/);
  assert.match(START, /textMode = prefersTyping\(profile\)/);
  assert.match(read('./TutorTab.tsx'), /label="Write instead"/);
  assert.match(SHARED, /tone === 'hero' \? 'gold' : 'primary'/);
  assert.doesNotMatch(SCREEN, /<TabBar\b|<Segmented/);
});

test("the brief keeps its connection check and its held-back answer — F392", () => {
  assert.match(START, /probe: recheck/);
  assert.match(START, /scope: scopeGeneration/);
  assert.match(START, /useFocusEffect/);
  assert.match(REQUEST, /if \(this.pending \|\| !ports.visible\(\)\) return;/);
  assert.match(REQUEST, /tutorGate\(answer, textMode\)/);
  assert.match(REQUEST, /ticket === this.issued/);
  assert.match(REQUEST, /finally/);
  assert.match(SCREEN, /conversation.failed &&/);
});

test("day one lists where the learner starts with a sun dot on the first scene; afterwards the week sentences with no label and a slot for the lifetime count", () => {
  assert.match(FLAT, /latestReadyPack\(data\?\.packs \?\? \[\]\)/);
  assert.match(FLAT, /failed \? <><MainText>Your saved work could not be loaded/);
  assert.match(FLAT, /!data \? <MainText muted>Finding your saved French/);
  assert.match(FLAT, /latest \? <><MainHeading>Your latest conversation/);
  assert.doesNotMatch(SCREEN, /sample|fixture|previewPack|totalXp\(/);
});

test("the four tiles, the rail, the old details and every rank name are gone", () => {
  for (const gone of ['<Momentum', '<WeekRail', '<Stat', 'levelName', 'LEVELS[', '<InlineDetail']) assert.ok(!SCREEN.includes(gone), gone);
  assert.match(SCREEN, /<MainScreen/);
});

test("home draws tier-selected daily French with audio first and no decorative scene — F391", () => {
  // Discovery now owns the tiered catalogue; Home remains the clear speaking start.
  const explore = flat(read('./ExploreTab.tsx'));
  const catalogue = read('../main/exploreCatalogue.ts');
  assert.match(explore, /explorePhrases\(query, topic, suggestions.preferredTier\)/);
  assert.match(explore, /navigate\('DailyPractice', \{ id: item.id \}\)/);
  assert.match(catalogue, /DAILY_ITEMS/);
  assert.doesNotMatch(SCREEN, /Math.random|<DailyCard/);
  const daily = read('../daily/DailyPracticeScreen.tsx');
  assert.match(daily, /Hear model/);
  assert.match(daily, /discardRecording/);
});

test("Today's one recall action opens the review deck, Practice opens the same deck, and the hero sits outside every count — F438", () => {
  assert.match(LEARNING, /loadDeck\(\)/);
  assert.match(FLAT, /recommendation\(\{ resumable: resumableOf\(data.session, data.packs, data.bank\), deck: data.deck, bank: data.bank, packs: data.packs/);
  assert.match(FLAT, /nav.navigate\('Drill'/);
  const library = read('./MyFrenchLibraryTab.tsx');
  assert.match(library, /useLibraryData\(\)/);
  assert.match(read('../practice/useLibraryData.ts'), /loadDeck\(\)/);
  assert.match(library, /open\('Drill'/);
});

test("Today leads with one colour card: the next scene, the recall card, or the plans card when the free minutes are used", () => {
  assert.match(FLAT, /motif="cloud"/);
  assert.match(FLAT, /conversation.start\(suggestions.freeSeed \? \{ seedTopic: suggestions.freeSeed \} : \{\}\)/);
  assert.match(REQUEST, /tutorGate\(answer, textMode\)/);
  assert.doesNotMatch(SCREEN, /purchase\(|entitlement\s*=|best value|most popular|price:|£\d/);
});

test("a Home that has not read its storage yet draws still sand blocks shaped like the page", () => {
  assert.match(FLAT, /!data \? <MainText muted>Finding your saved French/);
  assert.match(LEARNING, /data: null, failed: false/);
  assert.doesNotMatch(SCREEN, /PRACTICE_PREVIEW|sampleConversation|fixture/);
});

test("today's phrase is a white card: the French with a play disc, the English, and Practise it", () => {
  // The phrase collection moved to My French; its live source remains the deck.
  const library = read('./MyFrenchLibraryTab.tsx');
  assert.match(library, /libraryPhrases\(data\?\.deck/);
  assert.match(library, /card.front/);
  assert.match(library, /card.back/);
  assert.match(library, /open\('Phrasebook'\)/);
  assert.match(library, /source.title.en/);
});

test("Home names no weekday, counts no days this week, shows no rate and draws no tag", () => {
  for (const absent of ['weekday', 'toFixed', 'accuracy', 'percent', '<Label', '<Stat']) assert.ok(!SCREEN.includes(absent), absent);
  assert.doesNotMatch(SCREEN, /streak|mastered|fluent|CEFR/);
});

test("every word Today spells is plain, and every import is used — F400", () => {
  const literals = [...SCREEN.matchAll(/>[\s]*([A-Za-z][^<{}]*?)\s*</g)].map(m => m[1]!);
  assert.ok(literals.length > 5);
  for (const line of literals) assert.equal(guiltIn(line), undefined, line);
  const body = SCREEN.slice(SCREEN.indexOf('export function HomeTab'));
  const imported = [...SCREEN.matchAll(/import \{([^}]+)\} from/g)].flatMap(m => m[1]!.split(',')).map(n => n.trim());
  assert.ok(imported.length > 10);
  for (const name of imported) assert.match(body, new RegExp('\\b'+name+'\\b'), name);
});

test("an account switch clears the old recommendation before any new read resolves", () => {
  assert.match(LEARNING, /old.owner === owner \? \{ \.\.\.old, failed: false \} : \{ owner, data: null, failed: false \}/);
  assert.match(LEARNING, /state.owner === scopeGeneration\(\) \? state.data : null/);
  assert.match(LEARNING, /if \(!live \|\| owner !== scopeGeneration\(\)\) return;/);
  assert.match(LEARNING, /return \(\) => \{ live = false; \}/);
});

test("a storage read that fails offers local practice and retry without guessing a scene", () => {
  assert.match(LEARNING, /\.catch\(\(\) => \{ if \(live && owner === scopeGeneration\(\)\)/);
  assert.match(LEARNING, /failed: true/);
  assert.match(FLAT, /label="Try loading again" tone="quiet" onPress=\{reload\}/);
  assert.match(SCREEN, /title=\{offline \? "Hear, say and compare" : "Browse offline French"\}/);
  assert.match(SCREEN, /id: offline.id, mode: 'shadowing'/);
});

test("the bookmark tap says it is working, and says when the write did not take", () => {
  // Saved situations moved into the library's collection; the live daily card
  // owns its write feedback. Home must not carry a second bookmark writer.
  assert.doesNotMatch(SCREEN, /setBookmark|bookmarkWrite/);
  assert.match(read('./MyFrenchLibraryTab.tsx'), /open\('DailyLibrary'\)/);
  const card = flat(read('../daily/DailyCard.tsx'));
  assert.match(card, /if \(busy \|\| saved === null \|\| owner !== scopeGeneration\(\)\) return;/);
  assert.match(card, /await setBookmark\(item.id, !saved\)/);
  assert.match(card, /That save did not finish/);
  assert.match(card, /label=\{busy \? 'Saving…'/);
});

test("home and tutor wrap every line, cap no reading size, and keep every row at the touch floor — F409", () => {
  for (const file of ['./HomeTab.tsx', './TutorTab.tsx', '../main/MainUI.tsx']) {
    const body = read(file);
    assert.doesNotMatch(body, /numberOfLines|maxFontSizeMultiplier|ellipsizeMode|allowFontScaling|fontSize:/, file);
  }
  assert.match(SHARED, /<ScrollScreen bottom=\{bottom \?\? \(onBack \? 'inset' : 'tab'\)\}/);
  assert.match(SHARED, /width < 360 \|\| fontScale >= 1.5/);
  assert.match(SHARED, /featureStack: \{ flexDirection: 'column-reverse'/);
  assert.match(SHARED, /rowCopy: \{ flex: 1,.*minWidth: 0/);
  assert.match(SHARED, /button: \{ minHeight: 52/);
  assert.match(SHARED, /row: \{ minHeight: 76/);
});

test("every tappable row on Home declares the touch floor, whether it presses through Pressable or Press", () => {
  const tags = (s: string, name: string): string[] => {
    const found: string[] = [];
    for (const match of s.matchAll(new RegExp('<'+name+'\\b', 'g'))) {
      let depth = 0;
      for (let i = match.index; i < s.length; i++) {
        if (s[i] === '{') depth++;
        else if (s[i] === '}') depth--;
        else if (s[i] === '>' && depth === 0) { found.push(s.slice(match.index, i + 1)); break; }
      }
    }
    return found;
  };
  const floored = (s: string, tag: string) => [...tag.matchAll(/s\.([A-Za-z]+)/g)].some(m => {
    const rule = s.match(new RegExp(m[1]+': \\{([^}]+)'))?.[1] ?? '';
    return /minHeight: HIT/.test(rule) || Number(rule.match(/minHeight: (\d+)/)?.[1] ?? 0) >= 44;
  });
  const bare = '<Press style={s.row}>x</Press> row: { flex: 1 }';
  const held = '<Press style={s.row}>x</Press> row: { minHeight: 52 }';
  assert.equal(floored(bare, tags(bare, 'Press')[0]!), false);
  assert.equal(floored(held, tags(held, 'Press')[0]!), true);
  assert.equal(tags('<Pressable style={s.row}>', 'Press').length, 0);
  const presses = [...tags(SHARED, 'Press'), ...tags(SHARED, 'Pressable')];
  assert.ok(presses.length >= 4);
  for (const tag of presses) assert.equal(floored(SHARED, tag), true, tag);
});

test("Home refreshes without ever showing its skeleton again once it has drawn", () => {
  assert.match(LEARNING, /old.owner === owner \? \{ \.\.\.old, failed: false \} : \{ owner, data: null, failed: false \}/);
  assert.doesNotMatch(LEARNING, /setState\(\{ owner, data: null, failed: false \}\)/);
  assert.match(LEARNING, /const refreshedData = await readLearning\(\)/);
  assert.match(LEARNING, /data: refreshedData/);
  assert.match(LEARNING, /useFocusEffect/);
});
