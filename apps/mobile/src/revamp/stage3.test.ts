/** Report 2 surface contracts. Pure models and storage suites cover the underlying decisions. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/.*$/gm,'$1');
const has=(file:string,...patterns:RegExp[])=>{const code=read(file);for(const pattern of patterns) assert.match(code,pattern,file);};
const lacks=(file:string,...patterns:RegExp[])=>{const code=read(file);for(const pattern of patterns) assert.doesNotMatch(code,pattern,file);};

test('revamp B Speak preserves real gates, one primary action and the authored scene path',()=>{
  // 2026-10-20, B2, B-Speak: ContinuityCard and NextTaskCard became the Recommended card, PATH_LABEL the stage heading,
  // and the chooser is reached through EVERY_SCENE, whose route is 'Missions'.
  has('tabs/TutorTab.tsx',/<TutorCard/,/<ColourCard ground="sun">/,/<PillButton label=\{START\}/,/<SceneMark/,/\{scenes\.heading\}/,/TUTOR_OFFLINE.retry/,/nav.navigate\(EVERY_SCENE\.route\.screen\)/);
  has('tutor/speakTabView.ts',/EVERY_SCENE = \{ label: 'Every scene', route: \{ screen: 'Missions' \} \}/);
  lacks('tabs/TutorTab.tsx',/<TintRow/,/<OptionCard/,/Start a real conversation/);
  has('missions/MissionsScreen.tsx',/\['A0', 'A1'\]/,/<SceneMark/,/nav.setParams\(\{ focus: card.mission.id/,/ground=\{colour.blue\}/,/type.display/,/minutes/,/tone="white"/);
});
test('revamp B room controls keep typing, help and leave alongside the real waiting and error states',()=>{
  has('ConvoScreen.tsx',/label="Help me out"/,/label="Simpler"/,/onModeChange=/,/label="Give me a moment"/,/label="In English"/,/keyboardShouldPersistTaps="handled"/,/<RoomWait/);
  has('live/C2LiveRoom.tsx',/\['Speaking', 'Typing'\]/,/maxHeight: 104/,/keyboardShouldPersistTaps="handled"/,/onPress=\{onEnd\}/);
  has('live/RoomWait.tsx',/state = 'thinking'/,/size=\{112\}/,/accessibilityLiveRegion="polite"/,/\{stage\}/,/label=\{leaveLabel\}/);
  lacks('live/RoomWait.tsx',/ProgressDots|CheckGlyph|percent|ProgressBar/);
  has('live/LiveErrorView.tsx',/<BoldVoiceOrb state="error"/,/<Transcript/,/<PillButton/,/<IconAction/);
  has('live/LiveRoomHeader.tsx',/kind="close"/,/accessibilityHint/,/frenchText/);
  lacks('live/LiveRoomHeader.tsx',/borderBottomWidth/);
});
test('revamp B conversation bubbles distinguish speaker and highlight only the newest correction',()=>{
  has('tutor/Transcript.tsx',/backgroundColor: c.lavender/,/backgroundColor: c.violet/,/c.white/,/latestCorrection/,/<Highlight/,/frenchText/,/keyboardShouldPersistTaps="handled"/);
  has('SessionView.tsx',/<ControlTile/,/<ScrollScreen/,/avoidKeyboard/,/frenchText/,/multiline/,/maxHeight: 100/);
  has('tutor/RealMomentScreen.tsx',/<OptionRow/,/MAX_ONLY_LINE/,/type.title/);
  has('tutor/SafetyStopView.tsx',/type.title/,/<PillButton/);
  lacks('tutor/SafetyStopView.tsx',/Animated|VoiceOrb|centerFill/);
});
test('revamp B shared choices, controls and sheets carry state and keep secondary actions quiet',()=>{
  has('components.tsx',/minHeight: 56/,/accessibilityState=\{\{ selected \}\}/,/aria-selected=\{selected\}/,/aria-pressed=\{selected\}/,/playing \? 'Stop' : 'Hear'/,/maxHeight: '94%'/,/accessibilityViewIsModal/,/keyboardShouldPersistTaps="handled"/,/outputRange: \[0, 0\.4\]/);
  has('layout.tsx',/trailing\?: ReactNode/,/props.divider === true \? HAIRLINE : 0/,/alignItems: 'flex-start'/);
});
// 2026-10-20, B3, B-Practice: Practice leads with the learner's conversations;
// the sound guide and the local compare stay on the page as its doors to sound
// practice, after the conversations and saved phrases, and the empty page
// keeps "Sounds of French".
test('revamp B Practice keeps an evidence-bounded sound guide and local compare after the conversations',()=>{
  has('practice/TuneSoundCard.tsx',/measured === null \? SOUND_LEAD.starterLabel : SOUND_LEAD.measuredLabel/,/lead.cue/,/measured !== null/,/native !== null/,/details && <View/,/<MouthGuide ipa=\{lead.ipa\}/);
  const practice = read('tabs/PracticeTab.tsx');
  assert.ok(practice.indexOf('{CONVERSATIONS_TITLE}') < practice.indexOf('<TuneSoundCard'), 'the sound guide buries the conversations');
  has('tabs/PracticeTab.tsx',/<TuneSoundCard/,/shadowingPhrase/,/mode: 'shadowing'/,/Hear, say and compare/,/go\(\{ screen: 'SoundCheck' \}\)/);
  has('daily/DailyPracticeScreen.tsx',/state-headphones/,/Nothing is graded/,/Record my take/,/Hear my take/,/Try again/,/recordActiveDay\(\)/,/ack === 'durable'/,/setDaySaved\(true\)/,/discardRecording/,/enterVoicePlayback\(\)/);
  lacks('daily/DailyPracticeScreen.tsx',/fetch\(|Speech.speak|pronunciationScore/);
});
test('revamp B retrieval and drills preserve attempted recall, honest scoring and the typed twin',()=>{
  has('ReviewScreen.tsx',/'Show me'/,/setTurn/,/st.grades/,/conversationContext/,/view.answer.context/);
  lacks('ReviewScreen.tsx',/borderLeftWidth|<VoiceOrb|score/);
  has('DrillScreen.tsx',/drillTitle/,/CheckGlyph/,/colour.mint/,/state-microphone/,/label="I said it"/);
  has('daily/DailyLibraryScreen.tsx',/appearance="underline"/,/label="Clear search"/,/change\(\{ query: '', limit: 12 \}\)/,/Retry saved items/);
  for(const file of ['phrases/PhrasebookScreen.tsx','conversationPacks/ConversationPackLibrary.tsx']) has(file,/state-notebook/,/label="Choose a scene"/,/nav.navigate\('Missions'\)/);
});
test('revamp B Progress opens evidence-based materials, a weekly story and earned postcards without starting audio',()=>{
  has('tabs/MyFrenchTab.tsx',/<LevelCard/,/<DayCount weekly/,/hasStory\(storyFrom/,/earnedPostcards\(missions\).length > 0/,/nav.navigate\('Postcards'\)/,/nav.navigate\('WeekWrapped'\)/,/nav.navigate\('Phrasebook'\)/,/nav.navigate\('GoalStep'/);
  lacks('tabs/MyFrenchTab.tsx',/tutorVoice.speak|AudioModule|recordActivity\(/);
  has('myfrench/LevelCard.tsx',/ground="blue"/,/<SceneMark/,/next.stops.length/);
  has('goals/GoalStepScreen.tsx',/ground="blue"/,/tone="white"/,/<Ledger/);
  has('myfrench/copy.ts',/MY_FRENCH_TITLE = 'Progress'/);
});
test('revamp B Profile choices stay over Profile and keep a lifetime count without a weekly rail',()=>{
  // P2 (2026-10-19): the learner's sun disc and the lifetime count of practice
  // days, now said on the Progress row rather than as a line of its own.
  has('tabs/ProfileTab.tsx',/\{initialOf\(profile\.name\)\}/,/usePracticeDays\(\)/,/<BottomSheet visible=\{sheet === 'tutorVoice'\}/,/title="Your name"/,/label="Done"/,/<OptionRow/,/onHear=/);
  lacks('tabs/ProfileTab.tsx',/<WeekRhythm|<DayCount weekly|onHear=[^\n]*setSheet\('none'\)/);
  has('settings/SettingsRow.tsx',/<Press/,/haptic="selection"/,/useRowFrame\(\)/);
  has('settings/SettingsGroup.tsx',/minHeight: 52/);
  lacks('settings/SettingsRow.tsx',/opacity/);
  has('settings/SwitchRow.tsx',/accent.brand/,/paper.field/);
});
test('revamp B reminder and deletion controls retain explicit choices and explain store cancellation',()=>{
  has('settings/SettingsScreen.tsx',/<BottomSheet visible=\{sheet === 'reminderTime' && reminderOwned\}/,/<OptionRow/,/REMINDER_TIME_TITLE/,/label="Done"/,/label="Keep my account"/,/Cancel an App Store or Google Play subscription in the store/,/<GhostButton[\s\S]*permanently/);
  has('layout.tsx',/<Sheet/,/label=\{confirmLabel\}/,/<GhostButton/,/onCancel/);
  has('components.tsx', /accessibilityRole="header"/);
});
test('revamp B plans preserve catalogue and store prices, accessible selection and a single restore',()=>{
  // Come-alive D16: each store product is now a shared radio choice. Keep
  // the actual price and selected product wired to its accessible name/state.
  // 19 October 2026, "P2 · Luvani": compare cards are a radiogroup of radios
  // whose checked state VoiceOver reads; prices are the store's via trialPaywall.
  has('wall/WallPlansPage.tsx', /<View style=\{st.cards\} accessibilityRole="radiogroup">/, /accessibilityRole="radio" accessibilityState=\{\{ checked \}\} aria-checked=\{checked\}/, /<WallPeriodSwitch offers=\{visibleRow.offers\} name=\{visibleRow.name\} selected=\{selected\} onSelect=\{onSelect\}/);
  has('wall/trialPaywall.ts', /price: billedPrice\(offer.price, offer.period\)/, /const billed = billedPrice\(offer\.price, offer\.period\);/, /offerMinutes\(row, offer\)/);
  has('wall/WallPeriodSwitch.tsx', /accessibilityRole="radio"/, /const checked = offer.productId === selected;/, /accessibilityState=\{\{ checked \}\} aria-checked=\{checked\}/, /accessibilityLabel=\{\[name, period, billedPrice\(offer.price, offer.period\)\].join\(', '\)\}/, /minHeight: HIT/);
  has('components.tsx', /accessibilityState=\{navigation \? undefined : radio \? \{ checked: selected \} : \{ selected \}\}/, /aria-checked=\{radio \? selected : undefined\}/);
  lacks('wall/WallPlansPage.tsx', /recommended/);
  has('wall/WallScreen.tsx',/wallSuccess/,/state-offline/,/Start speaking/,/restore/);
  // Exactly one restore entry: one handler on the wall, one link in the shell.
  const wallCode=read('wall/WallScreen.tsx');
  assert.equal((wallCode.match(/void restore\(\)/g)??[]).length,1,'the wall offers more than one restore');
  assert.equal((read('wall/WallParts.tsx').match(/link\(PAYWALL_RESTORE,/g)??[]).length,1);
  has('wall/WallYoursPage.tsx',/YOURS_ROWS.map/,/ADDS_ROWS.map/,/YOURS_FREE_TITLE/,/colors.text/,/<Illustration name="place-cafe-counter"/);
  lacks('wall/WallYoursPage.tsx',/borderBottomWidth/);
  has('purchases/paywallView.ts',/price/);
});
test('revamp B out-of-minutes surfaces open the central wall without selling in the room',()=>{
  has('live/OutOfMinutesView.tsx',/<Sheet/,/title=\{label\}/,/entry: 'refused'/);
  lacks('live/OutOfMinutesView.tsx',/purchase\(|<Paywall|productId/);
  has('ConvoScreen.tsx',/<OutOfMinutesView/);
  has('LiveSessionScreen.tsx',/<OutOfMinutesView/);
});
test('recap stories, earned postcards and week wrapped use saved evidence and provide a way out',()=>{
  has('RecapScreen.tsx',/total=\{pages.length\}/,/recapCanDo/,/nextPage === null \? 'Finish conversation' : 'Next'/,/firstEarned/,/<PostcardStamp/,/<CountUp/);
  has('progress/PostcardsScreen.tsx',/earnedPostcards\(missionStates/,/scopeGeneration/,/postcardIllustration/,/Choose a scene/);
  lacks('progress/PostcardsScreen.tsx',/locked|remaining|percent|collect all/);
  has('progress/WeekWrappedScreen.tsx',/storyFrom\(\{sessions,activity,packs,completions,now\}\)/,/hasStory/,/total=\{2\}/,/celebrate-wrapped/,/label=\{page===1\?'Done':'Next'\}/,/Choose a scene/,/Try loading your week again/,/readOwner===scopeGeneration\(\)/);
  has('celebrate/PostcardStamp.tsx',/useReduceMotion\(true\)/,/claimInPlace\(/,/from '\.\.\/motion\/drive\.ts'/,/pointerEvents: 'none'/);
  has('motion/CountUp.tsx',/useReduceMotion\(true\)/,/if \(target\.current === to\) return;/,/useLandOnLeave\(land\)/,/\{\.\.\.decorative\}/);
});
