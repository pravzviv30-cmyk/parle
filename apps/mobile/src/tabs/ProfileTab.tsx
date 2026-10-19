/**
 * Profile: who you are, and the doors to how you learn (P2 · Luvani, 2026-10-19).
 *
 * A large title with the settings gear at its trailing edge, the learner's own
 * avatar and name, then three grouped lists: Learning (preferences, the tutor
 * and the tutor's memory), Your French (progress, My French, Friends) and Plan.
 * The gear is the one way to Settings: the account, the subscription, the
 * reminders, the documents and the phone's own permissions.
 *
 * ## The controls that were inline moved, none was lost
 *
 * The daily goal, the correction style, Prefer typing and Simpler French are on
 * Learning preferences now (`settings/LearningPreferencesScreen.tsx`), one row
 * away, with the conversation starting point beside them. The name is still
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
import { enterVoicePlayback } from '../sound/audioSession.ts';
import { useVoiceHold } from '../sound/useVoiceHold.ts';
import { startVoiceLine } from '../sound/voiceLine.ts';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../nav/types.ts';
import { colour, paper, space, type, HIT } from '../theme.ts';
import { OptionRow, PillButton, Press, Sheet as BottomSheet } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { SettingsRow } from '../settings/SettingsRow.tsx';
import { SettingsGroup } from '../settings/SettingsGroup.tsx';
import { SETTINGS_ROW, SETTINGS_ROW_SUB } from '../settings/sections.ts';
import { usePlanStatus } from '../settings/usePlanStatus.ts';
import {
  EDIT_NAME_LINK,
  FRIENDS_ROW,
  FRIENDS_SUB,
  LEARNING_GROUP,
  LEARNING_PREFERENCES_ROW,
  MY_FRENCH_ROW,
  NAME_UNSET,
  PLAN_GROUP_TITLE,
  PROFILE_TITLE,
  PROGRESS_ROW,
  YOUR_FRENCH_GROUP,
  initialOf,
  learningPreferencesSummary,
  learningSince,
  planRow,
  progressSummary,
} from '../settings/profileView.ts';
import { TutorMemoryCard } from '../profile/TutorMemoryCard.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { withName, withTutorVoice } from '../profile/store.ts';
import { dailyGoalOf } from '../profile/dailyGoal.ts';
import { useLevel } from '../game/GameProvider.tsx';
import { usePracticeDays } from '../settings/usePracticeDays.ts';
import { paceOf } from '../tutor/pace.ts';
import { strictnessOf } from '../tutor/strictness.ts';
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
import { useMainAppearance } from '../main/MainAppearance.tsx';
import { SettingsAppearance, SettingsField as Field } from '../settings/SettingsAppearance.tsx';

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
type Sheet = 'none' | 'name' | 'tutorVoice';

export function ProfileTab() {
  const goBack = useBackToHome();
  const { colors } = useMainAppearance();
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
  const openMyFrench = () => (nav as unknown as { navigate: (screen: string, params?: object) => void }).navigate('Tabs', { screen: 'MyFrench' });
  const since = learningSince(profile.onboardedAt);
  const level = useLevel();
  const days = usePracticeDays();
  const plan = usePlanStatus();
  const planLine = planRow(plan.view);
  const preferences = learningPreferencesSummary({ dailyGoalMin: dailyGoalOf(profile), strictness: strictnessOf(profile), slow: paceOf(profile) === 'slow' });
  const progress = progressSummary({
    level: level?.level ?? null,
    cefr: profile.brain?.cefr?.estimate ?? null,
    confidence: profile.brain?.cefr?.confidence ?? null,
    days,
  });

  return (
    <SettingsAppearance>
    <ScrollScreen ground={colors.background} bottom="inset" header={<ScreenHeader back={{ onPress: goBack }} ink={colors.text} muted={colors.muted} />}>
      <View style={st.titleRow}>
        <Text accessibilityRole="header" style={[type.title, st.title, { color: colors.text }]}>{PROFILE_TITLE}</Text>
        {/* The one way to Settings: the account, the plan, the reminders and
            about Luvani, a stack sibling above the tabs. */}
        <Press haptic="selection" onPress={() => nav.navigate('Settings')} accessibilityRole="button" accessibilityLabel={SETTINGS_ROW} accessibilityHint={SETTINGS_ROW_SUB} style={st.gear}>
          <Icon name="settings" size={24} color={colors.text} />
        </Press>
      </View>

      {/* The learner, by their own initial and name. Edit opens the name
          sheet, the same door Settings' Name row uses. */}
      <View style={st.identity}>
        <View style={st.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={st.initial}>{initialOf(profile.name)}</Text>
        </View>
        <View style={st.who}>
          <Text style={[type.title, { color: colors.text }]}>{profile.name ?? NAME_UNSET}</Text>
          {since !== null ? <Text style={[type.small, { color: colors.muted }]}>{since}</Text> : null}
        </View>
        <Press haptic="selection" onPress={() => { setDraftName(profile.name ?? ''); setSheet('name'); }} accessibilityRole="button" accessibilityLabel="Edit your name" style={st.edit}>
          <Text style={[type.label, { color: colors.link }]}>{EDIT_NAME_LINK}</Text>
        </Press>
      </View>

      <SettingsGroup title={LEARNING_GROUP}>
        <SettingsRow first label={LEARNING_PREFERENCES_ROW} sub={preferences} onPress={() => nav.navigate('LearningPreferences')} />
        {/* The tutor and what the tutor holds. The voice sheet opens from the
            first row; the second pushes the editing screen (F562). */}
        <TutorMemoryCard onVoice={() => setSheet('tutorVoice')} />
      </SettingsGroup>

      <SettingsGroup title={YOUR_FRENCH_GROUP}>
        <SettingsRow first label={PROGRESS_ROW} sub={progress ?? undefined} onPress={() => nav.navigate('Streak')} />
        <SettingsRow label={MY_FRENCH_ROW} onPress={() => openMyFrench()} />
        <SettingsRow label={FRIENDS_ROW} sub={FRIENDS_SUB} onPress={() => nav.navigate('Friends')} />
      </SettingsGroup>

      {/* The plan, as one row. An unanswered or unknown plan names no plan and
          is never called Free (`planRow`). */}
      <SettingsGroup title={PLAN_GROUP_TITLE}>
        <SettingsRow first label={planLine.label} sub={planLine.sub} onPress={() => nav.navigate('Subscription')} />
      </SettingsGroup>
    </ScrollScreen>
    <BottomSheet visible={sheet === 'tutorVoice'} title={TUTOR_VOICE_TITLE} onClose={closeVoiceSheet} surface={colors.surface} ink={colors.text} footer={<PillButton label="Done" onPress={closeVoiceSheet} tone="brand" />}>
      <Text style={[type.body, { color: colors.muted }]}>{TUTOR_VOICE_SUB}</Text>
      {TUTOR_VOICE_OPTIONS.map((option) => (
        <OptionRow key={option.value} title={option.label} detail={option.gloss}
          selected={tutorVoiceOf(profile) === option.value} playing={samplePlaying === option.value}
          onPress={() => update(withTutorVoice(profile, option.value))} onHear={() => hearVoice(option.value)} />
      ))}
    </BottomSheet>
    <BottomSheet visible={sheet === 'name'} title="Your name" onClose={closeCurrentSheet} surface={colors.surface} ink={colors.text}>
      <Text style={[type.body, { color: colors.muted }]}>What your tutor calls you at the start of a session.</Text>
      <Field label="Your name" value={draftName} onChangeText={setDraftName} placeholder="e.g. James" />
      <PillButton label="Save" tone="brand" disabled={draftName.trim().length === 0} onPress={() => {
        const next = draftName.trim();
        if (next.length > 0) update(withName(profile, next));
        setSheet('none');
      }} />
    </BottomSheet>
    </SettingsAppearance>
  );
}

const AVATAR = space(16);

const st = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  title: { flex: 1, minWidth: 0 },
  gear: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space(4), marginTop: space(5) },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: colour.sun, alignItems: 'center', justifyContent: 'center' },
  initial: { ...type.title, color: paper.ink },
  who: { flex: 1, minWidth: 0, gap: space(1) },
  edit: { minWidth: HIT, minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
});
