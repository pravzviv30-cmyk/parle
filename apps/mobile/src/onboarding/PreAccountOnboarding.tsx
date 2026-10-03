/**
 * Six pages before account creation (notebook Phase 5).
 *
 * Hear it: a real recorded exchange, captioned. First line: the learner taps
 * the reply, hears it in the tutor's recording, and it is marked with the
 * highlighter, the first chartreuse they see. Then two one-tap answers, a plan
 * they can see those answers shape, and the page that saves it with an account.
 *
 * Nothing on these pages reaches an AI service or the network: the audio is
 * bundled, the answers ride the local pre-account draft, and the only way out
 * that creates anything is the save page's pill, which hands over to sign-up.
 * `disclosure.test.ts` walks this file's imports to hold that.
 *
 * Revamp B (F601) draws them on colour: hear it and the first line are blue
 * pages with the exchange in white and ink bubbles and a round next; the two
 * answers are option rows on paper; the plan is the sun page, showing the
 * plan rather than configuring it; the save page is paper, and an under-13
 * answer turns it into a calm page of its own that holds for the rest of the
 * launch and clears the saved draft (F637, F639).
 *
 * This is intentionally separate from `OnboardingFlow`: that flow remains the
 * recovery route for older accounts that have never answered the age gate.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { tutorVoice, type TutorVoiceKey } from '@luvani/core';

import { HAIRLINE, HIT, colour, decorative, font, frenchText, onColour, paper, radius, space, textOn, type } from '../theme.ts';
import {
  Card,
  Field,
  FrenchBlock,
  GhostButton,
  HeroNumber,
  Highlight,
  Label,
  MicGlyph,
  OptionRow,
  PillButton,
  Press,
  ProgressDots,
  ROW_WORDS,
  RoundButton,
  TutorCard,
  type Ground,
} from '../components.tsx';
import { InfoGlyph, LockGlyph, PlayGlyph, SpeakerGlyph } from '../glyphs.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { Illustration } from '../art/flat/Illustration.tsx';
import { TUTOR_VOICE_OPTIONS } from '../tutor/tutorVoice.ts';
import { voiceSample } from '../tutor/voiceSamples.ts';
import { CHANGE_VOICE, tutorCardFacts } from '../tutor/speakView.ts';
import { CONSENT_HINT, CONSENT_ROW, CONSENT_SUB } from '../analytics/consent.ts';
import { SwitchRow } from '../settings/SwitchRow.tsx';
import { useReduceMotion } from '../motion.ts';
import { asSentences } from '../copy/spoken.ts';
import { SAVE_PRIVACY, WELCOME_SUBLINE } from './disclosure.ts';
import { TUTOR_LINES_VOICE } from './tutorLines.ts';
import { clipFor } from './exchangeAudio.ts';
import {
  ALREADY_HAVE_ACCOUNT,
  ANSWER_HINT,
  CONTINUE,
  DEMO_COACHING,
  CREATE_ACCOUNT_AGE,
  FIRST_LINE,
  FIRST_LINE_PROMPT,
  FIRST_LINE_TITLE,
  FIRST_NAME_HINT,
  FIRST_NAME_LABEL,
  FIRST_NAME_PLACEHOLDER,
  HAVE_ACCOUNT,
  HEAR_AGAIN,
  HEAR_IT_EXCHANGE,
  HEAR_NOTE,
  HEAR_REASSURANCE,
  HEAR_TITLE,
  HIGHLIGHT_MEANS,
  LEARNER_LABEL,
  LEVEL_TITLE,
  REASON_SKIP,
  REASON_TITLE,
  SAVE_TITLE,
  STUCK,
  STUCK_HINT,
  TAP_TO_CONTINUE,
  TRY_A_LINE,
  UNDER_AGE_BODY,
  UNDER_AGE_TITLE,
  YOUNGER,
  type ExchangeLine,
} from './firstRun.ts';
import {
  GOAL_LABEL,
  GOAL_NOTE,
  METHOD_LABEL,
  METHOD_STEPS,
  MINUTES_UNIT,
  MINUTES_LABEL,
  ROUTINE_OPTIONS,
  ROUTINE_NOTE,
  COVERAGE_NOTE,
  NO_STREAKS,
  PLAN_SCENES_LABEL,
  PLAN_TITLE,
  REASONS,
  SAVE_PLAN,
  START_LEVELS,
  TRIAL_LINE,
  levelOf,
  planFor,
  reminderLine,
} from './plan.ts';
import {
  MAX_FIRST_NAME_CHARS,
  PRE_ACCOUNT_PAGES,
  firstNameFrom,
  freshPreAccountDraft,
  type PreAccountOnboardingDraft,
  type PreAccountPage,
  type Reason,
  type StartLevel,
} from './preAccountDraft.ts';

/** Selecting a recorded example never becomes assessed learner evidence. */
type LineStage = 'ask' | 'selected';

const pageBefore = (page: PreAccountPage): PreAccountPage | null => {
  const index = PRE_ACCOUNT_PAGES.indexOf(page);
  return index > 0 ? (PRE_ACCOUNT_PAGES[index - 1] ?? null) : null;
};

export function PreAccountOnboarding({
  initialDraft,
  onDraftChange,
  onCreateAccount,
  onSignIn,
  refused = false,
  onRefuse,
}: {
  initialDraft: PreAccountOnboardingDraft | null;
  onDraftChange: (draft: PreAccountOnboardingDraft) => void;
  onCreateAccount: (draft: PreAccountOnboardingDraft) => void;
  onSignIn: () => void;
  /** An under-13 answer given earlier in this launch, held by the flow above this screen. */
  refused?: boolean;
  /** Told once, when the learner says they are younger, so the flow can hold it and clear the draft. */
  onRefuse?: () => void;
}) {
  const [page, setPage] = useState<PreAccountPage>(() => initialDraft?.page ?? 'hear-it');
  const [coachingOpen, setCoachingOpen] = useState(false);
  const [draft, setDraft] = useState<PreAccountOnboardingDraft>(() => initialDraft ?? freshPreAccountDraft());
  const draftRef = useRef(draft);
  const [underAge, setUnderAge] = useState(refused);
  const [lit, setLit] = useState<number | null>(null);
  const [stage, setStage] = useState<LineStage>('ask');
  const [stuck, setStuck] = useState(false);
  const [playing, setPlaying] = useState<'sample' | null>(null);
  const [voicesOpen, setVoicesOpen] = useState(false);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const [nameText, setNameText] = useState(() => initialDraft?.firstName ?? '');
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const reduced = useReduceMotion();
  /** What to do when the clip now sounding finishes. One at a time, by construction. */
  const onFinish = useRef<(() => void) | null>(null);

  // The recorded tutor on the first two pages is Alexandre whichever voice the
  // learner later picks, so the disclosure there names him. The plan and the
  // save page speak about the learner's own choice.
  const persona = tutorVoice(TUTOR_LINES_VOICE).persona;
  const selected = draft.tutorVoice;
  const chosenPersona = tutorVoice(selected).persona;
  const card = tutorCardFacts(selected);
  const view = planFor(draft);
  const level = levelOf(draft);
  const previous = pageBefore(page);
  const dim = (index: number) => !reduced && lit !== null && lit !== index;

  /**
   * The one door every answer goes through, so leaving and coming back finds
   * it. Once refused it writes nothing: the refusal cleared the saved draft,
   * and saving it again would put a child's answers back on the device.
   */
  const keep = (patch: Partial<PreAccountOnboardingDraft>) => {
    const next: PreAccountOnboardingDraft = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    if (!underAge) onDraftChange(next);
  };

  /** Usage data, answered once on the save page and carried across sign-up. */
  const setConsent = (allowed: boolean) => keep({ analyticsConsent: allowed });

  const finish = () => {
    const then = onFinish.current;
    onFinish.current = null;
    then?.();
  };

  /** Audio is optional. Captions and Continue work even if decoding fails. */
  const play = (clip: number | undefined, then: (() => void) | null) => {
    onFinish.current = then;
    setAudioNotice(null);
    try {
      player.pause();
      if (clip === undefined) throw new Error('Bundled clip unavailable');
      player.replace(clip);
      player.play();
      return true;
    } catch {
      onFinish.current = null;
      setLit(null);
      setPlaying(null);
      setAudioNotice('The recording could not play. You can read the example and continue.');
      return false;
    }
  };

  const playExchange = (index: number): void => {
    const line: ExchangeLine | undefined = HEAR_IT_EXCHANGE[index];
    if (line === undefined) {
      setLit(null);
      return;
    }
    setLit(index);
    play(clipFor(line), () => playExchange(index + 1));
  };

  const stop = () => {
    onFinish.current = null;
    try { player.pause(); } catch { /* The native player may already have closed. */ }
    setLit(null);
    setPlaying(null);
    setAudioNotice(null);
  };

  useEffect(() => {
    if (status.didJustFinish) {
      setPlaying(null);
      finish();
    }
    // `finish` reads a ref; the effect only needs the edge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish]);

  // Page changes only stop audio. Playback starts from an explicit Hear control.
  useEffect(() => {
    stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Layout cleanup precedes the audio hook's native release.
  useLayoutEffect(() => () => {
    onFinish.current = null;
    try { player.pause(); } catch { /* No later recording continues this example. */ }
  }, [player]);

  // Moving back and forward between the pages does not undo the refusal:
  // resetting it would put "I am 13 or older" one tap away from a learner who
  // has just said they are younger.
  const go = (to: PreAccountPage) => {
    setPage(to);
    keep({ page: to });
  };

  // The refusal holds for the rest of the launch. The flow above this screen
  // hears it through `onRefuse` and hands it back as `refused`, so leaving
  // through "I have an account" and coming back does not undo it either. The
  // flow also clears the saved draft, including any first name typed, and
  // `keep` writes nothing after this, so reopening the app starts at the first
  // page with nothing kept. The refusal itself lives in memory only and is
  // never written to the device, so after a relaunch the question can be asked
  // again, the same close-the-app escape the age gate keeps for a mis-tap.
  const refuse = () => {
    setUnderAge(true);
    onRefuse?.();
  };

  const sayReply = () => {
    setStage('selected');
    play(clipFor(FIRST_LINE.reply), null);
  };

  const answerLevel = (key: StartLevel) => {
    keep({ startLevel: key });
    go('reason');
  };

  const answerReason = (key: Reason | null) => {
    keep({ reason: key });
    go('plan');
  };

  const chooseVoice = (voice: TutorVoiceKey) => {
    stop();
    keep({ tutorVoice: voice });
  };

  const hearVoice = (voice: TutorVoiceKey) => {
    if (playing === 'sample') { stop(); return; }
    if (play(voiceSample(voice), null)) setPlaying('sample');
  };

  const setName = (value: string) => {
    setNameText(value);
    keep({ firstName: firstNameFrom(value) });
  };

  const index = PRE_ACCOUNT_PAGES.indexOf(page);
  /** The under-13 page is the save page's refusal, drawn as a calm page of its own. */
  const refusedHere = page === 'save' && underAge;
  /** The tutor's question, when a recording of it is bundled. No recording, no disc. */
  const questionClip = clipFor(FIRST_LINE.question);

  const body = (
    <>
      {page === 'hear-it' && (
        <View style={st.page}>
          <Text accessibilityRole="header" style={st.display}>{HEAR_TITLE}</Text>
          <Text style={st.onBlue}>{HEAR_REASSURANCE}</Text>
          <Text style={st.noteOnBlue}>{WELCOME_SUBLINE(persona)}</Text>
          <View style={st.exchange}>
            {HEAR_IT_EXCHANGE.map((line, at) => {
              const learner = line.speaker === 'learner';
              return (
                <View key={line.id} style={[st.bubble, learner ? st.learnerBubble : st.tutorBubble]}>
                  <Text style={learner ? st.speakerOnInk : st.speaker}>{learner ? LEARNER_LABEL : persona.name}</Text>
                  <Text {...frenchText} style={[learner ? st.frenchOnInk : st.french, dim(at) && (learner ? st.dimOnInk : st.dim)]}>
                    {line.fr}
                  </Text>
                  <Text style={learner ? st.englishOnInk : st.english}>{line.en}</Text>
                </View>
              );
            })}
          </View>
          <Press
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={lit !== null ? 'Stop the recording' : HEAR_AGAIN}
            frame={st.againFrame}
            style={st.again}
            onPress={() => {
                        if (lit !== null) stop(); else playExchange(0);
            }}
          >
            <View {...decorative} style={st.againDisc}>
              <PlayGlyph size={22} color={paper.ink} />
            </View>
            <Text style={st.againLabel}>{lit !== null ? 'Stop the recording' : HEAR_AGAIN}</Text>
          </Press>
          <Text style={st.noteOnBlue}>{HEAR_NOTE}</Text>
        </View>
      )}

      {page === 'first-line' && (
        <View style={st.page}>
          <Text accessibilityRole="header" style={st.display}>{FIRST_LINE_TITLE}</Text>
          {stage === 'ask' && <Text style={st.onBlue}>{FIRST_LINE_PROMPT}</Text>}
          <Card style={st.whiteCard}>
            <Text style={st.speaker}>{persona.name}</Text>
            {/* The question again, from the same bundled recording. Hidden
                while the reply sounds, so a second clip cannot cut across the
                one the highlight is waiting on. */}
            <FrenchBlock
              french={FIRST_LINE.question.fr}
              english={FIRST_LINE.question.en}
              size="lg"
              onHear={
                questionClip === undefined
                  ? undefined
                  : () => {
                                        play(questionClip, null);
                    }
              }
            />
          </Card>

          {stage === 'ask' && (
            <>
              <Press
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel={`Reply: ${asSentences([FIRST_LINE.reply.fr, FIRST_LINE.reply.en])}`}
                accessibilityHint="Plays the line in the tutor's voice"
                onPress={sayReply}
                style={st.reply}
              >
                <View style={st.replyWords}>
                  <Text {...frenchText} style={st.frenchLg}>{FIRST_LINE.reply.fr}</Text>
                  <Text style={st.english}>{FIRST_LINE.reply.en}</Text>
                </View>
                {/* Inside the button, so it is a mark and not a second control. */}
                <View {...decorative} style={st.inkDisc}>
                  <SpeakerGlyph size={22} color={paper.onInk} />
                </View>
              </Press>
              {stuck ? (
                <Card style={st.stuckCard}>
                  <Text style={st.speaker}>{persona.name}</Text>
                  <Text {...frenchText} style={st.french}>{STUCK_HINT}</Text>
                </Card>
              ) : (
                <View style={st.quiet}>
                  <GhostButton label={STUCK} color={paper.onInk} onPress={() => setStuck(true)} />
                </View>
              )}
            </>
          )}

          {stage === 'selected' && (
            <View accessibilityLiveRegion="polite" style={st.said}>
              <Card style={st.whiteCard}>
                <View style={st.markedRow}>
                  <View style={st.replyWords}>
                    <Highlight text={FIRST_LINE.reply.fr} accessibilityLabel={`${FIRST_LINE.reply.fr} ${HIGHLIGHT_MEANS}`} style={type.frenchLg} />
                  </View>

                </View>
                <Text style={st.english}>{FIRST_LINE.reply.en}</Text>
                <Text style={st.meaning}>{HIGHLIGHT_MEANS}</Text>
              </Card>
              <GhostButton label="Hear the reply again" color={paper.onInk} onPress={sayReply} />
              <GhostButton label="Stop the recording" color={paper.onInk} onPress={stop} />
            </View>
          )}
          <GhostButton color={paper.onInk} label={coachingOpen ? 'Close the practice example' : 'See how practice works'} onPress={() => setCoachingOpen(open => !open)} />
          {coachingOpen && <Card style={{ gap: space(2) }}>
            <Text style={type.heading}>{DEMO_COACHING.title}</Text>
            <Text style={type.small}>{DEMO_COACHING.scope}</Text>
            <Text style={type.small}>An example attempt</Text>
            <FrenchBlock french={DEMO_COACHING.attempt} english={DEMO_COACHING.attemptEn} />
            <Text style={type.body}>{DEMO_COACHING.feedback}</Text>
            <FrenchBlock french={DEMO_COACHING.alternative.fr} english={DEMO_COACHING.alternative.en}
              onHear={() => play(clipFor(DEMO_COACHING.alternative), null)} />
            <Text style={type.small}>{DEMO_COACHING.retry}</Text>
            <Text style={type.small}>{DEMO_COACHING.kept}</Text>
          </Card>}
        </View>
      )}

      {page === 'start-level' && (
        <View style={st.page}>
          <Text accessibilityRole="header" style={st.title}>{LEVEL_TITLE}</Text>
          <Text style={st.body}>{ANSWER_HINT}</Text>
          <View style={st.options}>
            {START_LEVELS.map((option) => (
              <OptionRow
                key={option.key}
                title={option.title}
                detail={option.gloss}
                selected={level === option.key}
                onPress={() => answerLevel(option.key)}
              />
            ))}
          </View>
        </View>
      )}

      {page === 'reason' && (
        <View style={st.page}>
          <Text accessibilityRole="header" style={st.title}>{REASON_TITLE}</Text>
          <Text style={st.body}>{ANSWER_HINT}</Text>
          <View style={st.options}>
            {REASONS.map((option) => (
              <OptionRow
                key={option.key}
                title={option.title}
                selected={draft.reason === option.key}
                onPress={() => answerReason(option.key)}
              />
            ))}
          </View>
        </View>
      )}

      {page === 'plan' && (
        <View style={st.page}>
          {/* The plan shows itself rather than asking again: the minutes and
              the reminder keep their defaults in the draft and are changed in
              Profile and Settings. No picture: the board draws none. */}
          <Text accessibilityRole="header" style={st.planTitle}>{PLAN_TITLE}</Text>
          <Text style={st.sectionHead}>{MINUTES_LABEL}</Text>
          {view.minutes === 'none'
            ? <Text style={st.onSun}>No fixed daily target</Text>
            : <HeroNumber value={String(view.minutes)} unit={MINUTES_UNIT} ground="sun" />}
          <Text style={st.onSunSmall}>{ROUTINE_NOTE}</Text>
          <GhostButton label={routineOpen ? 'Close routine choices' : 'Adjust routine'} color={paper.ink} onPress={() => setRoutineOpen(!routineOpen)} />
          {routineOpen && <View style={st.options}>{ROUTINE_OPTIONS.map(option => (
            <OptionRow key={option.key} title={option.title} selected={view.minutes === option.key}
              onPress={() => { keep({ minutes: option.key }); setRoutineOpen(false); }} />
          ))}</View>}
          <Text style={st.onSun}>{view.startingReason}</Text>
          <View style={st.planFacts}>
            <Text style={st.planFact}>{NO_STREAKS}</Text>
            <Text style={st.planFact}>{reminderLine(view.reminder.clock)}</Text>
          </View>

          <View style={st.block}>
            <Text style={st.sectionHead}>{PLAN_SCENES_LABEL}</Text>
            <Card style={st.planCard}>
              {view.scenes.map((scene, at) => (
                <View key={scene.id} style={[st.sceneRow, at > 0 && st.ruled]}>
                  <View style={st.sceneTitles}>
                    <Text {...frenchText} style={st.french}>{scene.titleFr}</Text>
                    <Text style={st.english}>{scene.titleEn}</Text>
                  </View>
                  <Text style={st.english}>{scene.canDoEn}</Text>
                </View>
              ))}
            </Card>
          </View>

          <View style={st.block}>
            <TutorCard
              name={card.name}
              voice={card.voice}
              signature={card.signature}
              onHear={() => hearVoice(selected)}
              playing={playing === 'sample'}
              onChange={() => setVoicesOpen((open) => !open)}
              changeLabel={CHANGE_VOICE}
            />
            {voicesOpen && (
              <View style={st.options}>
                {TUTOR_VOICE_OPTIONS.map((option) => (
                  <OptionRow
                    key={option.value}
                    title={option.label}
                    detail={option.gloss}
                    selected={selected === option.value}
                    onPress={() => chooseVoice(option.value)}
                  />
                ))}
              </View>
            )}
          </View>

          {view.goal !== null && (
            <View style={st.block}>
              <Label color={textOn.sun}>{GOAL_LABEL}</Label>
              <Text style={st.onSun}>{view.goal}</Text>
              <Text style={st.onSunSmall}>{GOAL_NOTE}</Text>
            </View>
          )}

          <Text style={st.onSunSmall}>{COVERAGE_NOTE}</Text>
          <View style={st.block}>
            <Text style={st.sectionHead}>{METHOD_LABEL}</Text>
            <Card style={st.planCard}>
              {METHOD_STEPS.map((step, at) => (
                <View key={step} style={[st.stepRow, at > 0 && st.ruled]}>
                  <Text style={st.stepNumber}>{at + 1}</Text>
                  <Text style={st.stepWords}>{step}</Text>
                </View>
              ))}
            </Card>
          </View>
        </View>
      )}

      {page === 'save' && (
        <View style={underAge ? st.refusal : st.page}>
          {underAge && <Illustration name="state-postcard-frame" fit="small" />}
          <Text accessibilityRole="header" style={underAge ? st.refusalTitle : st.title}>
            {underAge ? UNDER_AGE_TITLE : SAVE_TITLE}
          </Text>
          {underAge ? (
            <Text style={st.refusalBody}>{UNDER_AGE_BODY}</Text>
          ) : (
            <>
              <Text style={st.body}>Make an account to keep your plan across devices and start a real task with {chosenPersona.name}.</Text>
              <Card><Text style={type.body}>{view.scenes[0]?.titleEn}</Text><Text style={type.small}>{view.startingReason}</Text></Card>
              <View style={st.block}>
                <Field
                  label={FIRST_NAME_LABEL}
                  value={nameText}
                  onChangeText={setName}
                  placeholder={FIRST_NAME_PLACEHOLDER}
                  autoCapitalize="words"
                  autoComplete="given-name"
                  maxLength={MAX_FIRST_NAME_CHARS}
                  returnKeyType="done"
                />
                <Text style={st.english}>{FIRST_NAME_HINT}</Text>
              </View>
              {/* One mark to a row, and the row's own sentence beside it. The
                  AI row keeps its lead words, which say it first. */}
              <Card style={st.trust}>
                <View style={st.trustRow}>
                  <InfoGlyph size={20} color={paper.ink} />
                  <View style={st.trustWords}>
                    <Text style={st.trustLead}>Your tutor is AI</Text>
                    <Text style={st.trustBody}>{SAVE_PRIVACY(chosenPersona)}</Text>
                  </View>
                </View>
                <View style={st.trustDivider} />
                <View style={st.trustRow}>
                  <MicGlyph size={20} color={paper.ink} />
                  <Text style={[st.trustBody, st.trustWords]}>We ask for microphone permission only when you start a scene. You can type instead.</Text>
                </View>
                <View style={st.trustDivider} />
                <View style={st.trustRow}>
                  <LockGlyph size={20} color={paper.ink} />
                  <Text style={[st.trustBody, st.trustWords]}>Learning history does not include raw audio by default.</Text>
                </View>
                {/* Asked once, here, under the lines that say what the app
                    keeps. The answer is no unless the learner moves it. */}
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
              <Text style={st.trial}>{TRIAL_LINE}</Text>
            </>
          )}
        </View>
      )}
    </>
  );

  return (
    <ScrollScreen
      ground={GROUND[page]}
      avoidKeyboard={page === 'save'}
      header={
        // The story segments run full width above the round back, the way the
        // boards draw them. `title={false}`, or the header prints the app name.
        <View style={[st.head, previous === null && st.headAlone]}>
          {!refusedHere && <ProgressDots total={PRE_ACCOUNT_PAGES.length} index={index} ground={SEGMENTS[page]} />}
          {previous !== null && <ScreenHeader title={false} divider={false} back={{ onPress: () => go(previous) }} />}
        </View>
      }
      footer={
        // The under-13 page has no footer at all: nothing on it is a way on,
        // and an empty footer would still draw its paper rule.
        refusedHere ? undefined : (
          <>
            {page === 'hear-it' && (
              <View style={st.footRow}>
                <RoundButton kind="next" tone="sun" label={TRY_A_LINE} onPress={() => go('first-line')} />
                <GhostButton label={HAVE_ACCOUNT} color={paper.onInk} onPress={onSignIn} />
              </View>
            )}
            {page === 'first-line' && <><PillButton label={CONTINUE} tone="white" onPress={() => go('start-level')} /><Text style={st.footerHint}>{TAP_TO_CONTINUE}</Text></>}
            {page === 'start-level' && <PillButton label={CONTINUE} onPress={() => answerLevel(level)} />}
            {page === 'reason' && (
              <>
                {draft.reason !== null && <PillButton label={CONTINUE} onPress={() => go('plan')} />}
                <View style={st.secondary}>
                  <GhostButton label={REASON_SKIP} color={paper.ink} onPress={() => answerReason(null)} />
                </View>
              </>
            )}
            {page === 'plan' && (
              <View style={st.footRow}>
                <RoundButton kind="next" tone="ink" label={SAVE_PLAN} onPress={() => go('save')} />
                <Text style={st.trialOnSun}>{TRIAL_LINE}</Text>
              </View>
            )}
            {page === 'save' && !underAge && (
              <>
                <PillButton label={CREATE_ACCOUNT_AGE} onPress={() => onCreateAccount(draft)} />
                <View style={st.secondary}>
                  <GhostButton label={YOUNGER} color={paper.ink} onPress={refuse} />
                  <GhostButton label={ALREADY_HAVE_ACCOUNT} color={paper.ink} onPress={onSignIn} />
                </View>
              </>
            )}
          </>
        )
      }
    >
      {body}
      {audioNotice && <Text accessibilityLiveRegion="polite" style={page === 'hear-it' || page === 'first-line' ? st.noteOnBlue : st.english}>{audioNotice}</Text>}
    </ScrollScreen>
  );
}

/** Each page's ground (STYLE section 5): blue to hear it and say it, paper to answer, sun for the plan. */
const GROUND: Readonly<Record<PreAccountPage, string>> = {
  'hear-it': colour.blue,
  'first-line': colour.blue,
  'start-level': paper.ground,
  reason: paper.ground,
  plan: colour.sun,
  save: paper.ground,
};

/** The story segments take their colours from the same ground. */
const SEGMENTS: Readonly<Record<PreAccountPage, Ground | 'paper'>> = {
  'hear-it': 'blue',
  'first-line': 'blue',
  'start-level': 'paper',
  reason: 'paper',
  plan: 'sun',
  save: 'paper',
};

/** A thread bubble's three rounded corners; the fourth is the tail. */
const BUBBLE = radius.card;
const TAIL = space(2);

const st = StyleSheet.create({
  head: { gap: space(3) },
  headAlone: { marginBottom: space(6) },
  page: { alignItems: 'stretch', gap: space(3), paddingBottom: space(6) },
  display: { ...type.display, color: textOn.blue },
  onBlue: { ...type.body, color: onColour.blue },
  noteOnBlue: { ...type.small, color: onColour.blue },
  title: { ...type.title, color: paper.ink },
  body: { ...type.body, color: paper.inkSoft },
  quiet: { alignItems: 'flex-start' },
  exchange: { gap: space(3), marginTop: space(3) },
  bubble: { maxWidth: '88%', paddingVertical: space(3.5), paddingHorizontal: space(4), gap: space(1) },
  tutorBubble: {
    alignSelf: 'flex-start',
    backgroundColor: paper.card,
    borderTopLeftRadius: BUBBLE,
    borderTopRightRadius: BUBBLE,
    borderBottomRightRadius: BUBBLE,
    borderBottomLeftRadius: TAIL,
  },
  learnerBubble: {
    alignSelf: 'flex-end',
    backgroundColor: paper.ink,
    borderTopLeftRadius: BUBBLE,
    borderTopRightRadius: BUBBLE,
    borderBottomLeftRadius: BUBBLE,
    borderBottomRightRadius: TAIL,
  },
  speaker: { ...type.small, color: paper.inkSoft },
  speakerOnInk: { ...type.small, color: onColour.ink },
  french: { ...type.french, color: paper.ink },
  frenchOnInk: { ...type.french, color: paper.onInk },
  frenchLg: { ...type.frenchLg, color: paper.ink },
  dim: { color: paper.inkSoft },
  dimOnInk: { color: onColour.ink },
  english: { ...type.small, color: paper.inkSoft },
  englishOnInk: { ...type.small, color: onColour.ink },
  againFrame: { alignSelf: 'flex-start', marginTop: space(2) },
  again: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(3) },
  againDisc: {
    width: HIT,
    height: HIT,
    borderRadius: HIT / 2,
    backgroundColor: paper.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  againLabel: { ...type.label, color: paper.onInk },
  whiteCard: { gap: space(2), padding: space(5) },
  replyWords: { ...ROW_WORDS, gap: space(1.5) },
  reply: {
    minHeight: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: paper.card,
    borderRadius: radius.card,
    padding: space(5),
  },
  inkDisc: {
    width: HIT,
    height: HIT,
    borderRadius: HIT / 2,
    backgroundColor: paper.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stuckCard: { alignSelf: 'flex-start', maxWidth: '88%', gap: space(1) },
  said: { gap: space(3) },
  markedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  meaning: { ...type.small, color: paper.inkSoft },
  options: { gap: space(3), marginTop: space(2) },
  planTitle: { ...type.heading, color: textOn.sun },
  planFacts: { gap: space(0.5) },
  planFact: { ...type.label, fontFamily: font.medium, color: textOn.sun },
  block: { gap: space(2), marginTop: space(3) },
  sectionHead: { ...type.heading, color: textOn.sun },
  planCard: { paddingVertical: space(1), paddingHorizontal: space(5) },
  ruled: { borderTopWidth: HAIRLINE, borderTopColor: paper.line },
  sceneRow: { paddingVertical: space(3), gap: space(0.5) },
  sceneTitles: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: space(2) },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space(4), paddingVertical: space(3) },
  stepNumber: { ...type.body, fontFamily: font.bold, color: paper.ink },
  stepWords: { ...type.body, ...ROW_WORDS, color: paper.ink },
  onSun: { ...type.body, color: textOn.sun },
  onSunSmall: { ...type.small, color: textOn.sun },
  refusal: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: space(3), paddingBottom: space(10) },
  refusalTitle: { ...type.title, color: paper.ink, textAlign: 'center', marginTop: space(3) },
  refusalBody: { ...type.body, color: paper.inkSoft, textAlign: 'center' },
  trust: { alignSelf: 'stretch', marginTop: space(4), gap: space(3) },
  trustRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  trustWords: ROW_WORDS,
  trustLead: { ...type.small, fontFamily: font.semiBold, color: paper.ink },
  trustBody: { ...type.small, color: paper.ink },
  trustDivider: { height: HAIRLINE, backgroundColor: paper.lineOnCard },
  consentHint: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  trial: { ...type.bodyStrong, color: paper.ink, marginTop: space(3) },
  footerHint: { ...type.small, color: onColour.blue, textAlign: 'center', minHeight: HIT, textAlignVertical: 'center' },
  footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(3) },
  trialOnSun: { ...type.small, color: onColour.sun, textAlign: 'right', flexShrink: 1 },
  secondary: { marginTop: space(3), gap: space(2) },
});
