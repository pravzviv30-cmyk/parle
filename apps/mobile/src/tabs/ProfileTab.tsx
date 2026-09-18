/**
 * Profile — who you are, who your tutor is, and how you learn.
 *
 * It used to be one long scroll mixing three unrelated things: the learner's
 * own settings, the account, and what the law and the store require the app to
 * say. The last two went behind one `Settings` row with F473, last on the
 * screen and in a bare Card with no caps label over it, because a caps SETTINGS
 * above a row reading Settings is redundancy this system already retired.
 *
 * Revamp A (F576) took the split one step further. The plan card, the daily
 * reminder and the link to the voice-circle intro are all general-issue
 * settings rather than things about this learner's French, and all three are in
 * Settings now. What is left is four things and nothing else: who the learner
 * is, who the tutor is, the week they have had, and the standing choices about
 * how a conversation goes.
 *
 * ## The header is a person, not a subject
 *
 * Four tabs name a subject and read left. This one opens on the learner's own
 * mark with their name under it, which is why `TabHeader` has a centred branch
 * and why this is the only screen that asks for it. The `Monogram` is the
 * learner's initial and the one drawn in the whole app (F337); the tutor beside
 * it on the card below is the orb, never a face and never a second monogram.
 *
 * ## It reads nothing and decides nothing
 *
 * The focus effect went with the reminder and the level line. The two cards
 * that need the disk read it themselves, from their own files, so this screen
 * holds no state but the open sheet and the name being typed. Every word it
 * shows comes from a module: `profile/frenchLife.ts` for the headings,
 * `profile/tutorMemory.ts` for the tutor card, `profile/dailyGoal.ts`,
 * `tutor/strictness.ts`, `profile/typing.ts` and `tutor/pace.ts` for the
 * choices, and `settings/sections.ts` for the row at the foot.
 */

import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useNavigation } from '@react-navigation/native';
import { paper, space, type } from '../theme.ts';
import { Card, Label, Monogram, OptionCard, OutlineButton, Field } from '../components.tsx';
import { ScrollScreen, ScreenHeader, TabHeader } from '../layout.tsx';
import { HeaderArt } from '../art/HeaderArt.tsx';
import { HEADER_ART } from '../art/maps.ts';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { SettingsRow } from '../settings/SettingsRow.tsx';
import { ChoiceRow } from '../settings/ChoiceRow.tsx';
import { SwitchRow } from '../settings/SwitchRow.tsx';
import { SETTINGS_ROW, SETTINGS_ROW_SUB } from '../settings/sections.ts';
import { FrenchLifeCard } from '../profile/FrenchLifeCard.tsx';
import { TutorMemoryCard } from '../profile/TutorMemoryCard.tsx';
import { LEARNING_LABEL, PROFILE_PURPOSE, RHYTHM_LABEL, TUTOR_LABEL } from '../profile/frenchLife.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { withDailyGoal, withName, withPreferTyping, withTutorVoice } from '../profile/store.ts';
import { DAILY_GOAL_ROW, GOALS, goalFor, goalKeyOf, goalLine, type GoalKey } from '../profile/dailyGoal.ts';
import { PREFER_TYPING_ROW, PREFER_TYPING_SUB, prefersTyping } from '../profile/typing.ts';
import { PACE_ROW, PACE_SUB, paceOf, withPace } from '../tutor/pace.ts';
import {
  STRICTNESS_OPTIONS,
  STRICTNESS_ROW,
  strictnessOf,
  withStrictness,
  type Strictness,
} from '../tutor/strictness.ts';
import {
  TUTOR_VOICE_OPTIONS,
  TUTOR_VOICE_SUB,
  TUTOR_VOICE_TITLE,
  nextSample,
  tutorVoiceOf,
  type TutorVoiceKey,
} from '../tutor/tutorVoice.ts';
import { voiceSample } from '../tutor/voiceSamples.ts';

/**
 * The sheets that are left.
 *
 * Two went with F368. The daily goal and the correction dial each had three
 * answers and a whole screen apiece, which is two taps and two screen changes
 * to move a dial whose entire content is three words. Both are `ChoiceRow`s on
 * the card now. What kept a sheet is what needs the room: a name needs a
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
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { profile, update } = useProfile();
  const [sheet, setSheet] = useState<Sheet>('none');
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

  const hearVoice = useCallback(
    (key: TutorVoiceKey) => {
      const next = nextSample(samplePlaying, key);
      setSamplePlaying(next);
      if (next === null) {
        samplePlayer.pause();
        return;
      }
      // Loaded before it is told to play, or the player sounds whatever it was
      // last handed. No seek afterwards: `replace` builds the player a fresh
      // media element (AudioPlayer.web.ts, and the same on native), so the new
      // clip starts at nought by construction, and a tap on the voice that just
      // finished plays it again rather than sitting silently at its end.
      samplePlayer.replace(voiceSample(next));
      samplePlayer.play();
    },
    [samplePlaying, samplePlayer],
  );

  /** Leaving the sheet takes the sound with it. Nobody wants a voice following them back to Profile. */
  const closeVoiceSheet = useCallback(() => {
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
  if (sheet === 'tutorVoice') {
    return (
      <ScrollScreen bottom="tab" header={<ScreenHeader back={{ onPress: closeVoiceSheet }} />}>
        <Text accessibilityRole="header" style={[type.display, { color: paper.ink }]}>{TUTOR_VOICE_TITLE}</Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{TUTOR_VOICE_SUB}</Text>
        <View style={{ marginTop: space(6), gap: space(3) }}>
          {TUTOR_VOICE_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              text={option.label}
              gloss={option.gloss}
              selected={tutorVoiceOf(profile) === option.value}
              playing={samplePlaying === option.value}
              onPress={() => {
                update(withTutorVoice(profile, option.value));
                closeVoiceSheet();
              }}
              onHear={() => hearVoice(option.value)}
            />
          ))}
        </View>
        <Card style={{ marginTop: space(6) }}>
          <SwitchRow
            first
            title={PACE_ROW}
            sub={PACE_SUB}
            value={paceOf(profile) === 'slow'}
            onChange={(next) => update(withPace(profile, next ? 'slow' : 'normal'))}
            accessibilityLabel={PACE_ROW}
          />
        </Card>
      </ScrollScreen>
    );
  }

  if (sheet === 'name') {
    // The chevron is Cancel here: leaving restores the stored name, exactly as
    // the removed Cancel button did. Save is the one action left in the body.
    return (
      <ScrollScreen
        bottom="tab"
        avoidKeyboard
        header={<ScreenHeader back={{ onPress: () => { setDraftName(profile.name ?? ''); setSheet('none'); } }} />}
      >
        <Text accessibilityRole="header" style={[type.display, { color: paper.ink }]}>Your name</Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>
          What your tutor calls you at the start of a session.
        </Text>
        <View style={{ marginTop: space(6) }}>
          <Field label="Your name" value={draftName} onChangeText={setDraftName} placeholder="Your name" />
        </View>
        <View style={{ marginTop: space(6) }}>
          <OutlineButton
            label="Save"
            onPress={() => {
              const next = draftName.trim();
              // Through the named door, like every other field on the card
              // (F477). A field two places can set is a field that can come to
              // disagree with itself, which is what `profile/store.ts` says its
              // `with*` helpers exist to prevent.
              if (next.length > 0) update(withName(profile, next));
              setSheet('none');
            }}
          />
        </View>
      </ScrollScreen>
    );
  }

  return (
    <ScrollScreen bottom="tab">
      <View>
        {/* The art sits behind the centred column and bleeds off the corner, so
            the header and the picture share one relative box. It is decorative
            and it is not drawn at all at a large reading size. */}
        <View style={st.head}>
          <HeaderArt name={HEADER_ART.profile} />
          <TabHeader
            align="center"
            leading={<Monogram initial={firstName.charAt(0).toUpperCase()} size={72} />}
            title={profile.name ?? 'You'}
            purpose={PROFILE_PURPOSE}
          />
        </View>

        {/* Who the learner is talking to, and what that person holds about
            them. The voice sheet opens from row one; row two pushes the
            editing screen (F562). */}
        <Label>{TUTOR_LABEL}</Label>
        <TutorMemoryCard onVoice={() => setSheet('tutorVoice')} />

        {/* The week, Monday to Sunday, in the one tint that means a rhythm. It
            names no number and sets no target: the card says the week in a
            sentence to anyone who cannot see the marks. */}
        <View style={st.group}>
          <Label>{RHYTHM_LABEL}</Label>
          <FrenchLifeCard />
        </View>

        <View style={st.group}>
          <Label>{LEARNING_LABEL}</Label>
          <Card style={{ marginTop: space(2.5) }}>
            <SettingsRow first label="Name" value={profile.name ?? 'Not set'} onPress={() => setSheet('name')} />
            {/* Three words on a track, and what the chosen one means beneath. The
                minutes are a number in the store and words on the screen. */}
            <ChoiceRow<GoalKey>
              title={DAILY_GOAL_ROW}
              options={GOALS}
              active={goalKeyOf(profile)}
              onChange={(key) => update(withDailyGoal(profile, goalFor(key).minutes))}
              gloss={goalLine(profile)}
              accessibilityLabel={DAILY_GOAL_ROW}
            />
            <ChoiceRow<Strictness>
              title={STRICTNESS_ROW}
              options={STRICTNESS_OPTIONS.map((option) => ({ key: option.value, label: option.label }))}
              active={strictnessOf(profile)}
              onChange={(value) => update(withStrictness(profile, value))}
              gloss={STRICTNESS_OPTIONS.find((option) => option.value === strictnessOf(profile))?.gloss ?? ''}
              accessibilityLabel={STRICTNESS_ROW}
            />
            {/* The one standing choice about the next conversation that is the
                learner's own rather than the tutor's. It keeps every spoken
                path open: the circle is still there, and the tutor still
                speaks. The pace switch is on the voice sheet now, beside the
                eight cards that choose who is speaking. */}
            <SwitchRow
              title={PREFER_TYPING_ROW}
              sub={PREFER_TYPING_SUB}
              value={prefersTyping(profile)}
              onChange={(next) => update(withPreferTyping(profile, next))}
              accessibilityLabel={PREFER_TYPING_ROW}
            />
          </Card>
        </View>

        {/* The one row that leads to everything general: the account, the plan,
            the subscription, the documents, the phone's own permissions and the
            daily reminder. Last on the screen and in a bare Card with no Label
            above it, because a caps SETTINGS over a row reading Settings is
            redundancy that says nothing twice. Everything behind it is
            `settings/SettingsScreen.tsx`, a stack sibling above the tabs, so
            the bar goes with the push. */}
        <Card style={{ marginTop: space(6) }}>
          <SettingsRow
            first
            label={SETTINGS_ROW}
            value={SETTINGS_ROW_SUB}
            onPress={() => nav.navigate('Settings')}
          />
        </Card>
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  // One relative box so the corner art can be absolute inside it.
  head: { position: 'relative' },
  // Each labelled block keeps its own air above it; the label itself sits
  // tight to the card it names.
  group: { marginTop: space(5) },
});
