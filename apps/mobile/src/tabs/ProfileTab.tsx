/**
 * Profile: who you are, and the doors to how you learn (P2 · Luvani,
 * 2026-10-19; rebuilt 2026-10-20 UI-008, artboard B-Profile).
 *
 * The back disc and the settings gear, the learner's own 76pt sun disc with
 * their initial, name, "Learning French since" and Edit, then a white stats
 * card (stage, level over XP, the run) whose cells open Journey and Streak, the
 * blue plan card (what Free includes, See plans to the wall), and three grouped
 * lists: Learning (preferences, the tutor as the orb opening the voice sheet,
 * and what the tutor remembers), Your French (Journey, saved phrases, sounds)
 * and More (Friends, Help and feedback, Privacy). The tab bar sits under it
 * with no tab selected, as drawn. The gear is the one way to Settings.
 *
 * ## The controls that were inline moved, none was lost
 *
 * The daily goal, the correction style, Prefer typing and Simpler French are on
 * Learning preferences now (`settings/LearningPreferencesScreen.tsx`), one row
 * away, with the conversation starting point beside them (and the two
 * switches on Settings' Practice group too, since UI-008). The name is still
 * edited here, from the Edit link beside it, and also from Settings' Account
 * group. The voice sheet stays here because Home and the Tutor tab open it
 * with `Profile` and `sheet: 'tutorVoice'`.
 *
 * ## It decides nothing
 *
 * Every line is a module's: `settings/profileView.ts` for the titles, the
 * summaries and the plan row, `profile/tutorMemory.ts` for the tutor rows, and
 * `tutor/tutorVoice.ts` for the voice sheet. The plan is read by
 * `settings/usePlanStatus.ts`, and an unknown plan is never called Free.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { missionStates } from '@luvani/core';
import { enterVoicePlayback } from '../sound/audioSession.ts';
import { useVoiceHold } from '../sound/useVoiceHold.ts';
import { startVoiceLine } from '../sound/voiceLine.ts';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../nav/types.ts';
import { space, type } from '../theme.ts';
import { LockBadge, OptionRow, PillButton, Sheet as BottomSheet } from '../components.tsx';
import { ScrollScreen } from '../layout.tsx';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { DetachedTabBar } from '../nav/LuvaniTabBar.tsx';
import { SettingsRow } from '../settings/SettingsRow.tsx';
import { SettingsGroup } from '../settings/SettingsGroup.tsx';
import { SETTINGS_ROW, SETTINGS_ROW_SUB } from '../settings/sections.ts';
import { usePlanStatus } from '../settings/usePlanStatus.ts';
import { GearGlyph, IconDisc, Identity, PlanBanner, RowArt, StatsCard } from '../settings/ProfileParts.tsx';
import {
  EDIT_NAME_LINK,
  FRIENDS_ROW,
  FRIENDS_SUB,
  HELP_FEEDBACK_ROW,
  JOURNEY_ROW,
  JOURNEY_SUB,
  LEARNING_GROUP,
  LEARNING_PREFERENCES_ROW,
  MEMORY_PROFILE_SUB,
  MORE_GROUP,
  NAME_UNSET,
  PLAN_EYEBROW,
  PRIVACY_ROW,
  PRIVACY_SUB,
  SAVED_PHRASES_ROW,
  SOUNDS_ROW,
  YOUR_FRENCH_GROUP,
  YOUR_TUTOR_ROW,
  initialOf,
  learningPreferencesSummary,
  learningSince,
  memoryRowTitle,
  planCard,
  profileStats,
  savedCount,
  soundsLine,
  stageWordOf,
} from '../settings/profileView.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { practicePreferencesOf } from '../profile/practicePreferences.ts';
import type { Placement } from '../onboarding/placement.ts';
import { withName, withTutorVoice } from '../profile/store.ts';
import { dailyGoalOf } from '../profile/dailyGoal.ts';
import { useGame, useLevel, useStreak, useXp } from '../game/GameProvider.tsx';
import { paceOf } from '../tutor/pace.ts';
import { strictnessOf } from '../tutor/strictness.ts';
import { tutorNameOf } from '../tutor/tutorName.ts';
import {
  TUTOR_VOICE_OPTIONS,
  TUTOR_VOICE_SUB,
  TUTOR_VOICE_TITLE,
  nextSample,
  tutorVoiceOf,
  type TutorVoiceKey,
} from '../tutor/tutorVoice.ts';
import { voiceSample } from '../tutor/voiceSamples.ts';
import { useBackToHome } from '../nav/useBackToHome.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { SettingsAppearance, SettingsField as Field } from '../settings/SettingsAppearance.tsx';
import { BArt } from '../art/BArt.tsx';
import { BackButton } from '../journey/JourneyParts.tsx';
import { stagesFrom } from '../journey/journeyView.ts';
import { tapThrough } from '../access/featureAccess.ts';
import { useFeatureAccess } from '../access/useFeatureAccess.ts';
import { contactRow } from '../legal/company.ts';
import { openMail } from '../settings/links.ts';
import { HelpSheet } from '../settings/HelpSheet.tsx';
import { helpTrouble } from '../settings/helpSheet.ts';
import { loadDeck } from '../review/store.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { loadSoundChecks } from '../soundcheck/store.ts';
import { soundJourney } from '../soundcheck/journey.ts';
import { scopeGeneration } from '../storage/scope.ts';

/**
 * The sheets that are left.
 *
 * Two went with F368. The daily goal and the correction dial each had three
 * answers and a whole screen apiece, which is two taps and two screen changes
 * to move a dial whose entire content is three words. Both became in-place
 * choices, and since P2 (2026-10-19) they are on Learning preferences, one row
 * away, with Prefer typing and Simpler French. What kept a sheet is what needs the room: a name needs a
 * keyboard, and eight voices need eight cards and an ear each.
 *
 * Three more went with F473, to `settings/SettingsScreen.tsx`: the delete
 * confirmation, the acknowledgements, and the sheet that says an export could
 * not be made. Two more went with F576: the reminder time presets and the
 * voice-circle intro, which belong beside the phone's own settings and the
 * help rows rather than beside the learning.
 *
 * Neither of the two left renders a screen with a hook of its own, so this
 * screen answers the hardware back for both of them and there is nothing to
 * stand down for.
 */
type Sheet = 'none' | 'name' | 'tutorVoice' | 'help';

export function ProfileTab() {
  const goBack = useBackToHome();
  const t = useB();
  const st = useThemedStyles(makeStyles);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Profile'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Profile'>>();
  const { profile, update } = useProfile();
  const [sheet, setSheet] = useState<Sheet>(route.params?.sheet === 'tutorVoice' ? 'tutorVoice' : 'none');

  // Consume this one-shot request, including when Profile is already mounted.
  // Closing the sheet must not leave a request that reopens it on the next visit.
  useEffect(() => {
    if (route.params?.sheet !== 'tutorVoice') return;
    setSheet(route.params.sheet);
    nav.setParams({ sheet: undefined });
  }, [nav, route.params?.sheet]);
  const [draftName, setDraftName] = useState(profile.name ?? '');

  /**
   * Which voice sample is sounding right now, and the one player that sounds it.
   *
   * One player, not one per row, and that is the whole of the "one at a time"
   * rule rather than a discipline somebody has to keep. A learner comparing two
   * voices taps the second while the first is still going; with eight players
   * they would hear both at once and learn nothing about either. With one, the
   * second clip replaces the first because there is nothing else for it to play
   * out of. `nextSample` decides which key that is, in a module a test can ask.
   *
   * Declared here rather than inside the sheet because the sheet is an early
   * return and a hook behind a branch is a hook that changes order.
   */
  const [helpLine, setHelpLine] = useState<string | null>(null);
  const [samplePlaying, setSamplePlaying] = useState<TutorVoiceKey | null>(null);
  const samplePlayer = useAudioPlayer();
  const sampleStatus = useAudioPlayerStatus(samplePlayer);
  useVoiceHold(sampleStatus.playing);
  // Every tap and every close spends the ticket, so a clip asked for during the
  // mode change never starts after the learner moved on.
  const sampleTicket = useRef(0);

  const hearVoice = useCallback(
    (key: TutorVoiceKey) => {
      const next = nextSample(samplePlaying, key);
      setSamplePlaying(next);
      const ticket = ++sampleTicket.current;
      if (next === null) {
        samplePlayer.pause();
        return;
      }
      // Loaded before it is told to play, or the player sounds whatever it was
      // last handed. No seek afterwards: `replace` builds the player a fresh
      // media element (AudioPlayer.web.ts, and the same on native), so the new
      // clip starts at nought by construction, and a tap on the voice that just
      // finished plays it again rather than sitting silently at its end.
      // A full voice mode first, so the sample is heard with the silent switch on (F723). The web
      // has no modes and plays only inside the tap, so there it starts at once (sound/voiceLine.ts).
      startVoiceLine(enterVoicePlayback().catch(() => undefined), () => {
        if (ticket !== sampleTicket.current) return;
        samplePlayer.replace(voiceSample(next));
        samplePlayer.play();
      }, Platform.OS === 'web');
    },
    [samplePlaying, samplePlayer],
  );

  /** Leaving the sheet takes the sound with it. Nobody wants a voice following them back to Profile. */
  const closeVoiceSheet = useCallback(() => {
    sampleTicket.current += 1;
    samplePlayer.pause();
    setSamplePlaying(null);
    setSheet('none');
  }, [samplePlayer]);

  /**
   * Close whichever sheet is open, by its own correct closer.
   *
   * The chevron on each sheet routes here too. It matters that the voice sheet
   * goes through `closeVoiceSheet` rather than a bare `setSheet('none')`: only
   * that path pauses the sample, so leaving the sheet by the hardware back stops
   * the audition rather than letting a voice follow the learner out (F304). The
   * name sheet restores the stored name, exactly as its own chevron does.
   */
  const closeCurrentSheet = () => {
    // A switch rather than a chain of `if (sheet === '…')`, because the sheet
    // tests slice each render branch by finding exactly that phrase, and a
    // second one here would hand them the wrong braces.
    switch (sheet) {
      case 'tutorVoice':
        closeVoiceSheet();
        return;
      case 'name':
        setDraftName(profile.name ?? '');
        setSheet('none');
        return;
      case 'help':
        setHelpLine(null);
        setSheet('none');
        return;
      default:
        setSheet('none');
    }
  };

  // Android's hardware back closes the open sheet in place rather than popping
  // the whole Profile tab. Inactive on the main list, so ordinary back stands.
  // Both sheets left here are drawn by this screen, so unlike Settings there is
  // nothing to exclude: the intro, which answers its own press through its own
  // hook, is Settings' now and Settings stands its hook down for it.
  useHardwareBack(sheet !== 'none', closeCurrentSheet);

  // A clip that ends on its own leaves `samplePlaying` pointing at it, so the
  // next tap on that same voice is read as "stop" and stops nothing — a dead ear
  // until a second tap. Clearing it the instant the sound finishes keeps a
  // re-listen one tap. F305.
  useEffect(() => {
    if (sampleStatus.didJustFinish) setSamplePlaying(null);
  }, [sampleStatus.didJustFinish]);

  const firstName = (profile.name ?? '').split(' ')[0] || 'you';

  /**
   * Who the tutor is, which until now the product decided for everybody.
   *
   * Eight voices, and two of them women, which is why this is more than a
   * dropdown: the persona follows the voice, so choosing here changes the name
   * the app calls him or her by everywhere else. Built exactly like the
   * strictness sheet was, because it is the same kind of question, with one
   * addition: every row can be heard before it is chosen.
   *
   * Hearing is optional and deliberately secondary. The card's own press is
   * what chooses, the ear is a sibling control beside it, and a learner who
   * never taps one still leaves with a voice. Nobody is made to audition eight
   * people to get to a conversation.
   *
   * The pace switch sits at the foot of it (F576). How fast the tutor writes is
   * a question about this person rather than about the learner, so it belongs
   * with the eight cards that choose who the tutor is rather than on a card of
   * the learner's own settings.
   */

  // The tab lives inside the Tabs navigator, so it is named as a child of it.
  const openTab = (screen: string) => (nav as unknown as { navigate: (screen: string, params?: object) => void }).navigate('Tabs', { screen });
  const openMyFrench = () => openTab('MyFrench');
  const since = learningSince(profile.onboardedAt);
  const level = useLevel();
  const xp = useXp();
  const streak = useStreak();
  const game = useGame();
  const plan = usePlanStatus();
  const locks = useFeatureAccess();
  const evidence = useProfileEvidence(practicePreferencesOf(profile).placement ?? null);
  const tutor = tutorNameOf(profile);
  const contact = contactRow();
  const preferences = learningPreferencesSummary({ dailyGoalMin: dailyGoalOf(profile), strictness: strictnessOf(profile), slow: paceOf(profile) === 'slow' });
  const stats = profileStats({ stage: evidence.stage, level: level?.level ?? null, xpTotal: xp?.total ?? null, streak: streak?.current ?? null });
  const planView = planCard(plan.view, game.view?.protection?.cap ?? null);
  const memoryLocked = locks.access('tutorMemory') === 'locked';
  const soundsLocked = locks.access('sounds') === 'locked';

  return (
    <SettingsAppearance b>
    <View style={st.screen}>
    {/* 2026-10-20 UI-008, artboard B-Profile: back and the gear, the learner,
        the stats card, the blue plan card, then Learning, Your French and
        More, over the tab bar with no tab selected. */}
    <ScrollScreen ground={t.ground} padded={false} topGap={space(3)}>
      <View style={st.page}>
      <View style={st.top}>
        <BackButton onPress={goBack} />
        {/* The one way to Settings: the account, the plan, the reminders and
            about Luvani, a stack sibling above the tabs. */}
        <IconDisc onPress={() => nav.navigate('Settings')} label={SETTINGS_ROW} hint={SETTINGS_ROW_SUB}>
          <GearGlyph size={22} color={t.text} />
        </IconDisc>
      </View>

      {/* The learner, by their own initial and name. Edit opens the name
          sheet, the same door Settings' Name row uses. */}
      <Identity
        initial={initialOf(profile.name)}
        name={profile.name ?? NAME_UNSET}
        since={since}
        edit={EDIT_NAME_LINK}
        onEdit={() => { setDraftName(profile.name ?? ''); setSheet('name'); }}
      />

      <StatsCard stats={stats} onOpen={(stat) => (stat.route === 'Streak' ? nav.navigate('Streak') : openMyFrench())} />

      {/* The plan. An unanswered or unknown plan names no plan and is never
          called Free (`planCard`); Free opens the plans. */}
      <PlanBanner eyebrow={PLAN_EYEBROW} view={planView} onPress={() => (planView.target === 'Wall' ? nav.navigate('Wall', { entry: 'settings' }) : nav.navigate('Subscription'))} />

      <SettingsGroup first title={LEARNING_GROUP}>
        <SettingsRow first label={LEARNING_PREFERENCES_ROW} sub={preferences} onPress={() => nav.navigate('LearningPreferences')} />
        {/* The tutor is the orb, never a face, and opens the voice sheet. */}
        <SettingsRow label={YOUR_TUTOR_ROW} sub={tutor} lead={<RowArt round size={40}><BArt name="tutor-orb" width={40} height={40} /></RowArt>} onPress={() => setSheet('tutorVoice')} />
        <SettingsRow
          label={memoryRowTitle(tutor)}
          sub={MEMORY_PROFILE_SUB}
          lead={<BArt name="star-jar" width={42} height={38} />}
          badge={memoryLocked ? <LockBadge feature="tutorMemory" form="round" /> : null}
          onPress={() => tapThrough(locks.access, 'tutorMemory', locks.open, () => nav.navigate('TutorMemory'))}
        />
      </SettingsGroup>

      <SettingsGroup first title={YOUR_FRENCH_GROUP}>
        <SettingsRow first label={JOURNEY_ROW} sub={JOURNEY_SUB} onPress={() => openMyFrench()} />
        <SettingsRow label={SAVED_PHRASES_ROW} sub={savedCount(evidence.saved) ?? undefined} onPress={() => nav.navigate('Phrasebook')} />
        <SettingsRow
          label={SOUNDS_ROW}
          sub={soundsLine(evidence.soundJourney) ?? undefined}
          badge={soundsLocked ? <LockBadge feature="sounds" form="round" /> : null}
          onPress={() => tapThrough(locks.access, 'sounds', locks.open, () => (evidence.soundJourney ? nav.navigate('SoundJourney') : openMyFrench()))}
        />
      </SettingsGroup>

      <SettingsGroup first title={MORE_GROUP}>
        <SettingsRow first label={FRIENDS_ROW} sub={FRIENDS_SUB} onPress={() => nav.navigate('Friends')} />
        {/* Help and feedback opens the answers and the one address (F922),
            and is absent while none is supplied: a row with nothing behind it
            would lie. */}
        {contact !== null && <SettingsRow label={HELP_FEEDBACK_ROW} onPress={() => setSheet('help')} />}
        <SettingsRow label={PRIVACY_ROW} sub={PRIVACY_SUB} onPress={() => nav.navigate('Policy')} />
      </SettingsGroup>
      </View>
    </ScrollScreen>
    <DetachedTabBar onTab={openTab} />
    </View>
    <BottomSheet visible={sheet === 'tutorVoice'} title={TUTOR_VOICE_TITLE} onClose={closeVoiceSheet} surface={t.card} ink={t.text} footer={<PillButton label="Done" onPress={closeVoiceSheet} tone="brand" />}>
      <Text style={[type.body, { color: t.muted }]}>{TUTOR_VOICE_SUB}</Text>
      {TUTOR_VOICE_OPTIONS.map((option) => (
        <OptionRow key={option.value} title={option.label} detail={option.gloss}
          selected={tutorVoiceOf(profile) === option.value} playing={samplePlaying === option.value}
          onPress={() => update(withTutorVoice(profile, option.value))} onHear={() => hearVoice(option.value)} />
      ))}
    </BottomSheet>
    <BottomSheet visible={sheet === 'name'} title="Your name" onClose={closeCurrentSheet} surface={t.card} ink={t.text}>
      <Text style={[type.body, { color: t.muted }]}>What your tutor calls you at the start of a session.</Text>
      <Field label="Your name" value={draftName} onChangeText={setDraftName} placeholder="e.g. James" />
      <PillButton label="Save" tone="brand" disabled={draftName.trim().length === 0} onPress={() => {
        const next = draftName.trim();
        if (next.length > 0) update(withName(profile, next));
        setSheet('none');
      }} />
    </BottomSheet>
    {contact !== null && (
      <HelpSheet visible={sheet === 'help'} onClose={closeCurrentSheet} address={contact.address} trouble={helpLine}
        onWrite={() => { setHelpLine(null); void openMail(contact.address).then((outcome) => setHelpLine(helpTrouble(outcome))); }} />
    )}
    </SettingsAppearance>
  );
}

/**
 * What the Profile rows count, read on every visit from the stores that own
 * it: the stage from the missions, the saved phrases from the deck as
 * Practice counts them, and whether the sound journey holds a sound to
 * revisit. Bound to the account that asked; nothing is drawn until read.
 */
function useProfileEvidence(placement: Placement | null): { stage: string | null; saved: number; soundJourney: boolean } {
  const focused = useIsFocused();
  const [read, setRead] = useState<{ stage: string | null; saved: number; soundJourney: boolean }>({ stage: null, saved: 0, soundJourney: false });
  useEffect(() => {
    if (!focused) return;
    let cancelled = false;
    const scope = scopeGeneration();
    void Promise.all([loadMissionCompletions(), loadDeck(), loadSoundChecks()]).then(
      ([completions, deck, checks]) => {
        if (cancelled || scope !== scopeGeneration()) return;
        const now = Date.now();
        const missions = missionStates(missionCompletionsFrom(completions), deck, now);
        setRead({
          stage: stageWordOf(stagesFrom(missions, placement)),
          saved: deck.filter((card) => card.kind !== 'phoneme').length,
          soundJourney: soundJourney(checks, now) !== null,
        });
      },
      () => {
        // An unread store leaves the counts out: the rows keep their place.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [focused, placement]);
  return read;
}

const makeStyles = (_t: B) =>
  StyleSheet.create({
    screen: { flex: 1 },
    // Padding 58 22, gap 22; the bar sits below the scroll rather than over it.
    page: { paddingHorizontal: 22, gap: 22 },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  });
