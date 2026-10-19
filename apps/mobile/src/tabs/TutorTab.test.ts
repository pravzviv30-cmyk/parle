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
const SCREEN = read('./TutorTab.tsx');
const FLAT = flat(SCREEN);
const START = flat(read('../main/useConversationStart.ts'));
const REQUEST = flat(read('../main/conversationStartRequest.ts'));
const LIBRARY = flat(read('../conversationPacks/ConversationsScreen.tsx'));
test("the tutor card carries the voice from the catalogue, its sample, and a way to change it", () => {
  assert.match(FLAT, /Talk with \$\{tutorNameOf\(profile\)\}/);
  assert.match(FLAT, /navigate\('Profile', \{ sheet: 'tutorVoice' \}\)/);
  const profile = read('./ProfileTab.tsx');
  assert.match(profile, /voiceSample\(/);
  assert.match(profile, /onHear=\{\(\) => hearVoice\(option.value\)\}/);
  assert.match(profile, /samplePlayer.pause\(\)/);
  assert.doesNotMatch(SCREEN, /useAudioPlayer|voice\.speak\(/);
});

test("Change voice opens the Profile voice sheet directly and consumes the route request", () => {
  const profile = flat(read('./ProfileTab.tsx'));
  assert.match(read('../nav/types.ts'), /Profile: \{ sheet\?: 'tutorVoice' \} \| undefined/);
  assert.match(profile, /useRoute<RouteProp<RootStackParamList, 'Profile'>>\(\)/);
  assert.match(profile, /useState<Sheet>\(route.params\?\.sheet === 'tutorVoice' \? 'tutorVoice' : 'none'\)/);
  assert.match(profile, /if \(route.params\?\.sheet !== 'tutorVoice'\) return; setSheet\(route.params.sheet\); nav.setParams\(\{ sheet: undefined \}\);/);
  assert.match(profile, /samplePlayer.pause\(\); setSamplePlaying\(null\); setSheet\('none'\);/);
});

test("one Start, the next conversation, with a quiet \"Type instead\" under it and no segmented pill", () => {
  assert.equal((SCREEN.match(/<MainFeature\b/g) ?? []).length, 1);
  assert.match(FLAT, /label: conversation.checking \? 'Connecting…' : 'Just talk'/);
  assert.match(FLAT, /label="Write instead" tone="quiet" onPress=\{\(\) => conversation.start\(suggestions.freeSeed \? \{ seedTopic: suggestions.freeSeed \} : \{\}, true\)\}/);
  assert.match(START, /textMode = prefersTyping\(profile\)/);
  assert.doesNotMatch(SCREEN, /<TabBar\b|<Segmented|Ready when you are/);
});

test("the level path from the spine, then every scene as a ledger row that opens its brief", () => {
  // The authored path lives behind Explore and Missions, rather than a second copy on Speak.
  assert.match(FLAT, /navigate\('Missions'\)/);
  assert.match(read('./ExploreTab.tsx'), /navigate\('Missions', \{ focus: m.id \}\)/);
  assert.match(read('../missions/MissionsScreen.tsx'), /nav.setParams\(\{ focus: card.mission.id/);
  assert.doesNotMatch(SCREEN, /MISSIONS.map|missionStates\(|speakPath\(/);
});

test("offline Speak says it is unavailable once", () => {
  assert.equal((SCREEN.match(/Your tutor cannot connect right now/g) ?? []).length, 1);
  assert.match(FLAT, /conversation.failed &&/);
  assert.match(FLAT, /label=\{offline \? "Hear, say and compare" : "Browse offline French"\}/);
  assert.match(FLAT, /id: offline.id, mode: 'shadowing'/);
  assert.match(REQUEST, /else ports.failed\(true\)/);
});

test("\"More ways to practise\" appears only after a first finished scene", () => {
  // M2 exposes useful alternatives on day one, without an earned-completion claim.
  assert.match(FLAT, /navigate\('RealMoment'\)/);
  assert.match(FLAT, /navigate\('Library', \{ view: 'conversations' \}\)/);
  assert.match(FLAT, /suggestions.ideas.map/);
  assert.doesNotMatch(SCREEN, /recordActivity\(|settleSitting\(|award|completed: true/);
});

test("what left Speak stays gone", () => {
  for (const gone of ['<TintRow', 'DOOR_TINT', '<VoiceOrb', 'TUTOR_ORB_SIZE', 'scenarioCountLine', 'Veteran', 'streak']) assert.ok(!SCREEN.includes(gone), gone);
  for (const line of [...SCREEN.matchAll(/>\s*([A-Za-z][^<{}]*?)\s*</g)].map(m => m[1]!)) assert.equal(guiltIn(line), undefined, line);
  assert.match(SCREEN, /virtual French tutor/);
});

test("unread history is a retry state, and paused personal memory is not used for continuity", () => {
  // Speaking can begin even if history fails; the actual history surface owns its retry.
  assert.doesNotMatch(SCREEN, /loadPracticeHistory|continuityFrom|brain.memory/);
  const library = read('./MyFrenchLibraryTab.tsx');
  assert.match(library, /library.failed/);
  assert.match(library, /onPress=\{library.retry\}/);
  assert.match(read('../profile/memory.ts'), /memoryPaused/);
});

test("what the tutor remembers is drawn from a real record only, and a thread reaches the room it opens", () => {
  assert.match(LIBRARY, /continueArc === true/);
  assert.match(LIBRARY, /continuationPackId: pack.id/);
  assert.match(LIBRARY, /seedTopic: \{ fr: pack.continuationSeed.titleFr, en: pack.continuationSeed.titleEn \}/);
  assert.match(read('../nav/RootNavigator.tsx'), /continuationPackId=\{route.params\?\.continuationPackId\}/);
  assert.match(read('../ConvoScreen.tsx'), /continuationPackId === undefined \|\| live.convo === null\) return;/);
  assert.doesNotMatch(SCREEN, /markPackContinued|fake|sample/i);
});

test("a probe that threw lets go of the checking flag instead of retiring the tab", () => {
  assert.match(START, /probe: recheck/);
  assert.match(REQUEST, /catch \{ if \(current\(\)\) ports.failed\(true\)/);
  assert.match(REQUEST, /finally \{ if \(current\(\)\) \{ this.pending = false; ports.checking\(false\)/);
  assert.match(REQUEST, /ticket === this.issued/);
  assert.match(SCREEN, /disabled=\{conversation.checking\}/);
});

test("a disk that will not answer takes the memory row and nothing else off the tab", () => {
  assert.doesNotMatch(SCREEN, /loadConversationPacks|loadDeck|loadHistory|setProgress|setThread/);
  assert.match(SCREEN, /useConversationStart\(\)/);
  assert.match(SCREEN, /conversation.start\(suggestions.freeSeed \? \{ seedTopic: suggestions.freeSeed \} : \{\}\)/);
  assert.match(SCREEN, /navigate\('Library'/);
});

test("a refused start is forgotten once the tutor is reachable again", () => {
  assert.match(REQUEST, /ports.checking\(true\); ports.failed\(false\);/);
  assert.match(REQUEST, /if \(gate.go\) ports.open/);
  assert.match(START, /request.invalidate\(\)/);
  assert.match(START, /onUserScopeReset/);
  assert.doesNotMatch(SCREEN, /LESSON_MINUTES/);
});
