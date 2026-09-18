/**
 * Five calm screens before account creation.
 *
 * This is intentionally separate from `OnboardingFlow`: that flow remains the
 * recovery route for older accounts that have never answered the age gate.
 * New learners choose a tutor before they create an account, and this component
 * carries only that compact draft across the auth boundary.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View, StyleSheet } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { tutorSampleLine, tutorVoice, type TutorVoiceKey } from '@luvani/core';
import { accent, HAIRLINE, HIT, paper, radius, space, type } from '../theme.ts';
import { Card, ChevronRight, GhostButton, Label, MicGlyph, OptionCard, PillButton, ProgressDots, TintPanel } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { Art } from '../art/Art.tsx';
import { HERO_ART, SCREEN_ART } from '../art/maps.ts';
import { nextSample, TUTOR_VOICE_OPTIONS } from '../tutor/tutorVoice.ts';
import { voiceSample } from '../tutor/voiceSamples.ts';
import { CONSENT_HINT, CONSENT_ROW, CONSENT_SUB } from '../analytics/consent.ts';
import { SwitchRow } from '../settings/SwitchRow.tsx';
import { WELCOME_SUBLINE } from './disclosure.ts';
import { settleIn, useReduceMotion } from '../motion.ts';
import { tapSettled } from '../motion/haptics.ts';
import {
  freshPreAccountDraft,
  type PreAccountOnboardingDraft,
} from './preAccountDraft.ts';

export const PRE_ACCOUNT_PAGES = ['welcome', 'situations', 'life', 'voice', 'ready'] as const;
type Page = (typeof PRE_ACCOUNT_PAGES)[number];

const pageBefore = (page: Page): Page | null => {
  const index = PRE_ACCOUNT_PAGES.indexOf(page);
  return index > 0 ? PRE_ACCOUNT_PAGES[index - 1] ?? null : null;
};

/**
 * A real first turn, but not a test. It stays local to onboarding, asks for no
 * microphone or account, and shows the conversation-to-practice loop with one
 * useful answer rather than a fake right/wrong choice.
 */
const CAFÉ_DEMO = {
  tutorFr: 'Bonjour ! Qu’est-ce que vous désirez ?',
  tutorEn: 'Hello! What would you like?',
  learnerFr: 'Je voudrais un café, s’il vous plaît.',
  learnerEn: 'I’d like a coffee, please.',
  replyFr: 'Bien sûr. Et avec ceci ?',
  replyEn: 'Of course. Anything with that?',
  takeaway: 'This useful phrase can return later as practice made from your conversation.',
} as const;

/** Three voices keep the first chooser screenful calm; the rest stay one tap away. */
const SUGGESTED_VOICE_COUNT = 3;
const SUGGESTED_VOICES = TUTOR_VOICE_OPTIONS.slice(0, SUGGESTED_VOICE_COUNT);

export function PreAccountOnboarding({
  initialDraft,
  onDraftChange,
  onCreateAccount,
  onSignIn,
}: {
  initialDraft: PreAccountOnboardingDraft | null;
  onDraftChange: (draft: PreAccountOnboardingDraft) => void;
  onCreateAccount: (draft: PreAccountOnboardingDraft) => void;
  onSignIn: () => void;
}) {
  const [page, setPage] = useState<Page>('welcome');
  const [draft, setDraft] = useState<PreAccountOnboardingDraft>(() => initialDraft ?? freshPreAccountDraft());
  const [underAge, setUnderAge] = useState(false);
  const [playing, setPlaying] = useState<TutorVoiceKey | null>(null);
  const [demoAnswered, setDemoAnswered] = useState(false);
  const [showAllVoices, setShowAllVoices] = useState(
    () => initialDraft !== null && !SUGGESTED_VOICES.some((option) => option.value === initialDraft.tutorVoice),
  );
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const selected = draft.tutorVoice;
  const persona = tutorVoice(selected).persona;
  const previous = pageBefore(page);
  const reduced = useReduceMotion();
  const pageEntry = useRef(new Animated.Value(0)).current;
  const demoEntry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pageEntry.setValue(0);
    const animation = settleIn(pageEntry, reduced);
    return () => animation?.stop();
  }, [page, pageEntry, reduced]);

  const entryStyle = {
    opacity: pageEntry,
    transform: [
      {
        translateY: pageEntry.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
      },
    ],
  };

  useEffect(() => {
    if (!demoAnswered) {
      demoEntry.setValue(0);
      return;
    }
    demoEntry.setValue(0);
    const animation = settleIn(demoEntry, reduced, 80);
    return () => animation?.stop();
  }, [demoAnswered, demoEntry, reduced]);

  const demoEntryStyle = {
    opacity: demoEntry,
    transform: [
      {
        translateY: demoEntry.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
      },
    ],
  };

  // An interrupted pre-account flow can be resumed with the voice already
  // chosen. Do not replace a choice with the catalogue default on remount.
  useEffect(() => {
    if (initialDraft !== null) setDraft(initialDraft);
  }, [initialDraft]);

  // A resumed draft must always show its chosen tutor, even when that voice is
  // outside the three calm suggestions shown on a fresh first visit.
  useEffect(() => {
    if (!SUGGESTED_VOICES.some((option) => option.value === selected)) setShowAllVoices(true);
  }, [selected]);

  useEffect(() => {
    if (status.didJustFinish) setPlaying(null);
  }, [status.didJustFinish]);

  useEffect(() => {
    if (page !== 'voice') player.pause();
  }, [page, player]);

  const chooseVoice = (voice: TutorVoiceKey) => {
    const next: PreAccountOnboardingDraft = { ...draft, tutorVoice: voice };
    setDraft(next);
    onDraftChange(next);
    // The bundled sample is deliberately the tutor's real bilingual
    // introduction, which `tutorSampleLine` owns. Quoting the words here was how
    // the caption below came to disagree with the audio for a week, so this
    // comment names the function and never the sentence. Playing it on selection
    // makes the choice feel like meeting a person, while the ear remains
    // available to replay or stop it deliberately.
    player.pause();
    setPlaying(voice);
    player.replace(voiceSample(voice));
    player.play();
  };

  /**
   * The usage-data answer, taken on the last page before an account exists.
   *
   * It goes through `onDraftChange` like the voice, so it survives the app
   * being closed between the tap and account creation, and so the one place
   * that knows how to write it durably is the one that has a key to write it
   * under. The draft is a hand-off across the auth boundary and never a second
   * authority: `analytics/consentStore.ts` holds the answer once there is an
   * account, and this copy is cleared with the rest of the draft.
   */
  const setConsent = (allowed: boolean) => {
    const next: PreAccountOnboardingDraft = { ...draft, analyticsConsent: allowed };
    setDraft(next);
    onDraftChange(next);
  };

  const hearVoice = useCallback((voice: TutorVoiceKey) => {
    const next = nextSample(playing, voice);
    setPlaying(next);
    if (next === null) {
      player.pause();
      return;
    }
    player.pause();
    player.replace(voiceSample(next));
    player.play();
  }, [playing, player]);

  const index = PRE_ACCOUNT_PAGES.indexOf(page);
  const next = (to: Page) => {
    setUnderAge(false);
    setPage(to);
  };
  const visibleVoices = showAllVoices ? TUTOR_VOICE_OPTIONS : SUGGESTED_VOICES;

  const body = (
    <>
      <View style={st.chapter}>
        <Label>Luvani · A little French, every day</Label>
        <Text style={st.chapterNumber}>{String(index + 1).padStart(2, '0')} / 05</Text>
      </View>
      {page === 'welcome' && (
        <>
        <Card tone="feature" style={st.welcomePanel}>
          <View style={st.centered}>
            <Text style={st.kicker}>Bonjour, new possibilities.</Text>
            <Text accessibilityRole="header" style={st.title}>Find your voice in French</Text>
            <View style={st.artStage}>
            <Art name={SCREEN_ART.welcome} style={st.art} />
            </View>
            <Text style={st.body}>{WELCOME_SUBLINE(persona)}</Text>
          </View>
        </Card>
        <View style={st.journalNote}>
          <MicGlyph size={26} />
          <View style={st.replyWords}>
            <Text style={st.trustTitle}>Real moments. Your own words.</Text>
            <Text style={st.trustBody}>Speak, keep a useful phrase, then make it yours.</Text>
          </View>
        </View>
        </>
      )}

      {page === 'situations' && (
        <View style={st.centered}>
          <Text accessibilityRole="header" style={st.title}>Try one real turn</Text>
          <Text style={st.body}>No microphone and no account. Tap the reply you could use at a café.</Text>
          <View style={st.sceneStage}><Label>01 · Au café</Label><Art name={HERO_ART.cafe} style={st.sceneArt} /></View>
          <View style={st.demo}>
            <View style={st.tutorBubble}>
              <Text style={st.speaker}>{persona.name}</Text>
              <Text style={st.french}>{CAFÉ_DEMO.tutorFr}</Text>
              <Text style={st.english}>{CAFÉ_DEMO.tutorEn}</Text>
            </View>

            {!demoAnswered ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Reply: ${CAFÉ_DEMO.learnerFr}. ${CAFÉ_DEMO.learnerEn}`}
                accessibilityHint="Shows how the tutor carries the conversation forward"
                onPress={() => {
                  tapSettled();
                  setDemoAnswered(true);
                }}
              >
                {({ pressed }) => (
                  <TintPanel tint="sand" style={[st.replyChoice, pressed && st.replyChoicePressed]}>
                    <View style={st.replyWords}>
                      <Text style={st.replyCue}>Tap this reply</Text>
                      <Text style={st.french}>{CAFÉ_DEMO.learnerFr}</Text>
                      <Text style={st.english}>{CAFÉ_DEMO.learnerEn}</Text>
                    </View>
                    <ChevronRight color={paper.inkSoft} />
                  </TintPanel>
                )}
              </Pressable>
            ) : (
              <Animated.View accessibilityLiveRegion="polite" style={[st.demoReveal, demoEntryStyle]}>
                <TintPanel tint="lilac" style={st.learnerBubble}>
                  <Text style={st.french}>{CAFÉ_DEMO.learnerFr}</Text>
                  <Text style={st.english}>{CAFÉ_DEMO.learnerEn}</Text>
                </TintPanel>
                <View style={st.tutorBubble}>
                  <Text style={st.speaker}>{persona.name}</Text>
                  <Text style={st.french}>{CAFÉ_DEMO.replyFr}</Text>
                  <Text style={st.english}>{CAFÉ_DEMO.replyEn}</Text>
                </View>
                <Text style={st.takeaway}>{CAFÉ_DEMO.takeaway}</Text>
              </Animated.View>
            )}
          </View>
        </View>
      )}

      {page === 'life' && (
        <Card tone="feature" style={st.welcomePanel}>
          <View style={st.centered}>
            <Text style={st.kicker}>À votre rythme.</Text>
            <Text accessibilityRole="header" style={st.title}>Life happens. Your progress stays.</Text>
            <View style={st.artStage}><Art name={HERO_ART.home} style={st.art} /></View>
            <Text style={st.body}>There are no streaks to protect. Come back when you can and pick up from a conversation you already made yours.</Text>
            <View style={st.keepNote}><Label>A journal, not a scoreboard</Label><Text style={st.trustBody}>Your words and conversations stay with you.</Text></View>
          </View>
        </Card>
      )}

      {page === 'voice' && (
        <>
          <Text accessibilityRole="header" style={st.title}>{`Meet ${persona.name}`}</Text>
          <Text style={st.body}>Choose how your AI tutor sounds. When you choose one, they introduce themselves in French and then in English.</Text>
          {!showAllVoices && <Text style={st.voiceGroup}>Suggested voices</Text>}
          <View style={st.voices}>
            {visibleVoices.map((option) => (
              <OptionCard
                key={option.value}
                text={option.label}
                gloss={option.gloss}
                selected={selected === option.value}
                playing={playing === option.value}
                onPress={() => chooseVoice(option.value)}
                onHear={() => hearVoice(option.value)}
              />
            ))}
          </View>
          {!showAllVoices && (
            <View style={st.showAll}>
              <GhostButton label="See all voices" color={paper.inkSoft} onPress={() => setShowAllVoices(true)} />
            </View>
          )}
          {/* Read from the catalogue, never typed here: the clip and this line
              have to be the same words, and a hand-typed copy is what drifted. */}
          <Text style={st.sampleLine}>{`“${tutorSampleLine(selected)}”`}</Text>
        </>
      )}

      {/* The one page of the five that draws no picture. It carries the
          privacy line and the usage-data card as well as the three ways out,
          and the scene it used to show was the welcome page's own, which made
          the last screen look like the first, and the voice step goes without
          one for the same reason: six people to choose between, and a picture
          over them puts the sixth under the fold. */}
      {page === 'ready' && (
        <View style={st.centered}>
          <Text accessibilityRole="header" style={st.title}>Ready when you are</Text>
          {underAge ? (
            <Text style={st.body}>Luvani is for learners thirteen and up. Please come back when it is the right time.</Text>
          ) : (
            <>
              <Text style={st.body}>Make an account to save your progress and keep talking with {persona.name}.</Text>
              <Card style={st.trust}>
                <View style={st.trustBlock}>
                  <Text style={st.trustTitle}>Your tutor is AI</Text>
                  <Text style={st.trustBody}>You always know who you are talking to.</Text>
                </View>
                <View style={st.trustDivider} />
                <View style={st.trustBlock}>
                  <Text style={st.trustTitle}>Speak when you choose</Text>
                  <Text style={st.trustBody}>We ask for microphone permission only when you start a scene. You can type instead.</Text>
                </View>
                <View style={st.trustDivider} />
                <View style={st.trustBlock}>
                  <Text style={st.trustTitle}>Raw audio stays out of your learning history</Text>
                  <Text style={st.trustBody}>Learning history does not include raw audio by default.</Text>
                </View>
                {/* Asked once, here, under the lines that say what the app
                    keeps, rather than on a card or page of its own. The
                    answer is no unless the learner moves it either way. */}
                <View style={st.trustDivider} />
                <SwitchRow
                  first
                  title={CONSENT_ROW}
                  sub={CONSENT_SUB}
                  value={draft.analyticsConsent}
                  onChange={setConsent}
                  accessibilityLabel={CONSENT_ROW}
                />
              </Card>
              <Text style={st.consentHint}>{CONSENT_HINT}</Text>
            </>
          )}
        </View>
      )}
    </>
  );

  return (
    <ScrollScreen
      header={<ScreenHeader back={previous === null ? undefined : { onPress: () => setPage(previous) }} title={<ProgressDots total={PRE_ACCOUNT_PAGES.length} index={index} />} />}
      footer={
        <>
          {page === 'welcome' && <PillButton label="See how it works" onPress={() => next('situations')} />}
          {page === 'situations' && demoAnswered && <PillButton label="Continue" onPress={() => next('life')} />}
          {page === 'situations' && !demoAnswered && <Text style={st.footerHint}>Tap the French reply above to continue.</Text>}
          {page === 'life' && <PillButton label="Choose your Tutor" onPress={() => next('voice')} />}
          {page === 'voice' && <PillButton label="Continue" onPress={() => next('ready')} />}
          {page === 'ready' && !underAge && (
            <>
              <PillButton label="I am 13 or older · Create account" onPress={() => onCreateAccount(draft)} />
              <View style={st.secondary}>
                <GhostButton label="I already have an account" color={paper.ink} onPress={onSignIn} />
                <GhostButton label="I am younger than that" color={paper.inkSoft} onPress={() => setUnderAge(true)} />
              </View>
            </>
          )}
        </>
      }
    >
      <Animated.View style={entryStyle}>{body}</Animated.View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  centered: { alignItems: 'stretch' },
  chapter: { gap: space(2), marginBottom: space(3) },
  chapterNumber: { ...type.frenchSm, color: paper.inkSoft },
  kicker: { ...type.frenchSm, color: paper.ink, marginBottom: space(3) },
  artStage: { backgroundColor: paper.card, borderWidth: HAIRLINE, borderColor: paper.ink, borderRadius: radius.row, marginTop: space(4), alignItems: 'center', overflow: 'hidden' },
  sceneStage: { backgroundColor: paper.card, borderWidth: HAIRLINE, borderColor: paper.ink, borderRadius: radius.row, paddingTop: space(3), paddingHorizontal: space(3), marginTop: space(4), alignItems: 'center', overflow: 'hidden' },
  journalNote: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(5), borderBottomWidth: HAIRLINE, borderBottomColor: paper.line, marginBottom: space(4) },
  keepNote: { borderTopWidth: HAIRLINE, borderTopColor: paper.ink, paddingTop: space(4), marginTop: space(4), gap: space(2) },
  welcomePanel: {
    borderRadius: radius.card,
    paddingVertical: space(5),
    paddingHorizontal: space(5),
    marginTop: 0,
    overflow: 'hidden',
  },
  // The picture's size is the registry's; this is placement only.
  art: { alignSelf: 'center' },
  sceneArt: { alignSelf: 'center' },
  title: { ...type.display, color: paper.ink },
  body: { ...type.body, color: paper.inkSoft, marginTop: space(3) },
  trust: { alignSelf: 'stretch', marginTop: space(4), gap: space(3) },
  trustBlock: { gap: space(1) },
  trustTitle: { ...type.bodyStrong, color: paper.ink },
  trustBody: { ...type.small, color: paper.inkSoft },
  trustDivider: { height: HAIRLINE, backgroundColor: paper.lineOnCard },
  // Left, under the row it belongs to. The sentences above it are centred
  // because they are addressed to the reader; this one labels a control.
  consentHint: { ...type.small, color: paper.inkSoft, textAlign: 'left', alignSelf: 'stretch', marginTop: space(2) },
  demo: { alignSelf: 'stretch', marginTop: space(4), gap: space(3) },
  demoReveal: { gap: space(3) },
  tutorBubble: {
    alignSelf: 'flex-start',
    maxWidth: '90%',
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: radius.card,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
    gap: space(1),
  },
  learnerBubble: {
    alignSelf: 'flex-end',
    maxWidth: '90%',
    borderRadius: radius.card,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
    gap: space(1),
  },
  speaker: { ...type.label, color: accent.label },
  french: { ...type.french, color: paper.ink },
  english: { ...type.small, color: paper.inkSoft },
  replyChoice: {
    minHeight: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderRadius: radius.row,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
  },
  replyChoicePressed: { backgroundColor: paper.groundDeep, transform: [{ scale: 0.985 }, { translateY: 1 }] },
  replyWords: { flex: 1, flexShrink: 1, gap: space(1) },
  replyCue: { ...type.label, color: accent.label },
  takeaway: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
  voiceGroup: { ...type.label, color: accent.label, marginTop: space(5) },
  voices: { gap: space(3), marginTop: space(3) },
  showAll: { marginTop: space(2), alignItems: 'center' },
  sampleLine: { ...type.frenchSm, color: paper.inkSoft, marginTop: space(4), padding: space(4), borderLeftWidth: 3, borderLeftColor: paper.ink, backgroundColor: paper.card, marginBottom: space(4) },
  footerHint: { ...type.small, color: paper.inkSoft, textAlign: 'center', minHeight: HIT, textAlignVertical: 'center' },
  secondary: { marginTop: space(4), gap: space(2) },
});
