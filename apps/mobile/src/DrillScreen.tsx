/**
 * The drill sitting — the review deck made active.
 *
 * One exercise per screen, calm. The screen renders engine state and calls the
 * pure functions in @luvani/core/drill; every pedagogical decision (what to ask,
 * how to grade, what a miss costs) already happened there. If logic that looks
 * like grading or selection appears in this file, it is in the wrong file.
 *
 * Every answer gets its own sheet (`drill/answerSheet.ts`, F759): mint for a
 * pass, sun for a typo the drill accepted, calm white paper for a miss, with
 * no mark, sound or haptic on a miss. The living bar under the header says
 * where the learner is, never how it is going. Never a number and never a
 * scold mid-session; the end card is the one place counts are allowed, where
 * they can be given context, and every count on it is the settle's read-back.
 *
 * Leaving early is honest and cheap: every exercise answered so far grades its
 * review card on the way out, and the unanswered rest simply stay due — nothing
 * is lost, counted, or held against the learner.
 *
 * Spoken drills may also consult the pronunciation scorer, but the grade is the
 * learner's word, banked before the scorer is asked. Scoring can only ever add
 * one calm line; it has no way to slow, block, or punish.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  answerCurrent,
  buildDrillSession,
  buildPracticeSession,
  decideOwnWords,
  mixQueue,
  phraseKeyOf,
  scopedOwnWordsSession,
  suppressMic,
  summariseDrill,
  type DrillExercise,
  type DrillFeedback,
  type DrillSessionState,
  type OwnWordsExercise,
  type PracticeTarget,
  drillXp,
  missReason,
} from '@luvani/core';
import { HIT, bType, space, type } from './theme.ts';
import { useB, useThemedStyles, type B } from './main/bTheme.tsx';
import { EmptyStateCard } from './empty/EmptyStateCard.tsx';
import { tapSettled } from './motion/haptics.ts';
import { recordActivity } from './progress/activity.ts';
import { settleSitting } from './game/settle.ts';
import { useActiveClock } from './progress/useActiveClock.ts';
import { Card, IconAction, PillButton } from './components.tsx';
import { Screen, ScrollScreen, ScreenHeader } from './layout.tsx';
import type { DrillShell } from './drill/DrillFrame.tsx';
import { gradeCards, loadDeck } from './review/store.ts';
import { keepPhrase as keepInPhrasebook } from './review/phraseSaved.ts';
import { AnswerSheet } from './drill/AnswerSheet.tsx';
import { ownWordsLook, sheetFor } from './drill/answerSheet.ts';
import { firstTry } from './drill/firstTry.ts';
import { comboAfter, comboGlows } from './drill/combo.ts';
import { fireSheet } from './drill/sheetEffects.ts';
import { DRILL_END } from './drill/endCopy.ts';
import { SittingBar } from './drill/SittingBar.tsx';
import { EndCard } from './celebrate/EndCard.tsx';
import { useScreenReader } from './celebrate/useScreenReader.ts';
import { useSittingEnd } from './practice/useSittingEnd.ts';
import { loadDrillBank, getMicSuppressedUntil, setMicSuppressed } from './drill/store.ts';
import { MomentCard, type DrillMoment } from './drill/MomentCard.tsx';
import { momentShown } from './drill/momentShown.ts';
import { loadTopics } from './topics/store.ts';
import { drillTitle } from './drill/title.ts';
import { DRILL_UNREAD, sittingTitle, topicGroups } from './practice/mix.ts';
import * as tutorVoice from './speech/tutorVoice.ts';
import { scoreRecordedAttempt } from './speech/scoreAttempt.ts';
import { consumeRecording, discardRecording } from './speech/discardRecording.ts';
import { transcribeRecordedAttempt } from './speech/transcribeAttempt.ts';
import { judgeOwnWords } from './speech/judgeAttempt.ts';
import { hasAnsweredWork, sittingStatement } from './practice/sittingOutcome.ts';
import { PRACTICE_END } from './practice/copy.ts';
import { practiceEndCard, saveStateOfResult, type SaveState } from './practice/saveState.ts';
import { completePracticeSitting, practiceOutcomes, recoverPracticeCompletion } from './practice/completion.ts';
import { clearPracticeSession, loadPracticeSession, mintSittingId, savePracticeSession } from './practice/sessionStore.ts';
import { practiceOpening } from './practice/opening.ts';
import { sittingProgress } from './practice/sittingProgress.ts';
import { queueFill, sittingFill } from './practice/sittingProgress.ts';
import { scopeGeneration } from './storage/scope.ts';
import { loadConversationPacks } from './conversationPacks/store.ts';
import type { PracticeRoute } from './practice/practiceRoute.ts';
import {
  JUDGE_UNAVAILABLE,
  TRANSCRIPTION_UNAVAILABLE,
} from './drill/ownWordsCopy.ts';
import { DrillClock } from './drill/kinds/shared.tsx';
import { BestSentenceView, AppropriateReplyView } from './drill/kinds/choose.tsx';
import { FillBlankView, TapTranslateView } from './drill/kinds/build.tsx';
import { ListenTypeView, TranslationView } from './drill/kinds/write.tsx';
import { RepeatThisView } from './drill/kinds/RepeatThisView.tsx';
import { OwnWordsView, type OwnWordsOutcome } from './drill/kinds/OwnWordsView.tsx';

/** "Can't speak now" holds for an hour, then spoken drills quietly return. */
const MIC_SUPPRESS_MS = 60 * 60 * 1000;
// ─────────────────────────────────────────────── the pronunciation side-channel

/**
 * Ask the scorer about one recorded attempt. The grade is already banked
 * before this fires, so every outcome here — vendor down, budget spent (429),
 * permissionless blob, network gone — resolves to null and the sitting looks
 * exactly like the self-report flow. At most one learner-safe sentence comes
 * back: the reason behind core's single focus point, never a number.
 */
/**
 * A finish with no end card to celebrate it is still felt: one settled tap,
 * once, as every finished drill was before end cards. The end card gives its
 * own `celebrate()` when the settle read the sitting back, so the two never
 * both play for one finish. Draws nothing.
 */
function FinishFelt() {
  useEffect(() => {
    tapSettled();
  }, []);
  return null;
}

// ───────────────────────────────────────────────────────────────── the screen

export function DrillScreen({
  userId,
  onDone,
  node,
  mix = false,
  onFinished,
  practice,
  onPracticeFinished,
}: {
  userId: string;
  onDone: () => void;
  /**
   * A practice-now sitting: chosen targets, not the due deck. Absent, this is
   * the ordinary scheduled sitting and nothing below changes for it.
   */
  practice?: PracticeRoute | 'invalid';
  /**
   * A practice sitting with answered work, persisted. Named with the pack it
   * practised when one of its own targets was answered, else null.
   */
  onPracticeFinished?: (packId: string | null) => void;
  /**
   * The sitting finished, as distinct from Done: Done also fires on Leave, and
   * a pack must not be marked practised by a sitting that was abandoned (F550).
   */
  onFinished?: (nodeId: string) => void;
  /**
   * One node of the practice path. Omitted, the whole deck plays, which is
   * what "Start practice" has always done and still does.
   */
  node?: {
    id: string;
    title: string;
    phraseKeys: readonly string[];
    moment?: DrillMoment;
    /**
     * Draw the moment only once the learner has answered (2026-10-20 UI-008,
     * B-Today's fix card): attempt first, then the comparison.
     */
    afterTry?: boolean;
    /**
     * Ask for the phrase in the learner's own words instead of dealing the
     * bank. Authored here rather than generated: this kind has no right
     * string, so there is nothing for the generator to have written down.
     */
    ownWords?: { fr: string; en: string; situation: string };
  };
  /**
   * Today's mix: the same unscoped sitting, reordered so it moves between
   * topics instead of playing one conversation's worth and then the next.
   * Order only. Who plays is still buildDrillSession's decision alone.
   */
  mix?: boolean;
}) {
  const bt = useB();
  const ds = useThemedStyles(makeDs);
  // The sitting. Null while the deck and bank load.
  const [session, setSession] = useState<DrillSessionState | null>(null);
  // The line on the floor. While one shows, inputs are locked and the next
  // state waits in pendingRef; the beat ends and the queue's head deals.
  const [feedback, setFeedback] = useState<DrillFeedback | null>(null);
  const pendingRef = useRef<DrillSessionState | null>(null);
  // What the answer sheet needs beside core's feedback: the kind it answered,
  // the run of real passes after it, and its place in the sitting, which the
  // good lines rotate by. Set with the feedback and cleared with it.
  const [sheetFacts, setSheetFacts] = useState<{ kind: DrillExercise['kind']; combo: number; turn: number; reason: string | null; oneOfMany: boolean; answerEnglish: boolean } | null>(null);
  // The run of real passes (drill/combo.ts): a ref for the answer that reads it
  // and state for the bar that glows by it. Never a number on screen.
  const comboRef = useRef(0);
  const [combo, setCombo] = useState(0);
  // A screen reader decides its own pace: with one on, or not yet known to be
  // off, no sheet moves on by itself.
  const screenReader = useScreenReader();
  // The finished sitting's end card waits for the settle pipeline's own delta.
  // While this screen is up the celebration queue is held, and the hold taken
  // before the sitting settles is handed to its end card (F766).
  const { end, holdForSettle, expect, dropSettleHold, release } = useSittingEnd();
  // The scorer's one calm line, when it arrives in time. A focus reason may
  // only land in the beat its recording earned — beatRef numbers the beats so
  // a late answer from the scorer is dropped unseen, never shown out of place.
  const [focusLine, setFocusLine] = useState<string | null>(null);
  const beatRef = useRef(0);
  // Grades leave this screen exactly once, whether by finishing or by Leave.
  const persistedRef = useRef(false);
  // The finished signal leaves exactly once too, and only on a finished sitting.
  const finishedRef = useRef(false);
  const gradeWritesRef = useRef<Promise<void>>(Promise.resolve());
  // When the sitting started. Wall clock on the device, which is what Home's
  // speaking goal measures; it is not the metered minutes and must never be
  // shown as those.
  const openedAt = useRef(Date.now());
  // Active learning time (Practice time): only the gaps between the learner's
  // own actions that are short enough to be one stretch of work. Opening the
  // sitting adds nothing, and a resume carries its saved total with no anchor,
  // so the time away is never credited. Never derived from openedAt.
  const clock = useActiveClock('drill');

  // Per-exercise input state, cleared on every advance.
  const [typed, setTyped] = useState('');
  const [assembled, setAssembled] = useState<number[]>([]);

  // The own-words side of the sitting: what a judge said about the last
  // attempt, whether one is being read right now, and whether the phrase has
  // been kept. Separate from `feedback` because this card is read, not flashed.
  const [ownWords, setOwnWords] = useState<OwnWordsOutcome | null>(null);
  const [judging, setJudging] = useState(false);
  const attemptBusy = useRef(false);
  const attemptAlive = useRef(true);
  useEffect(() => { attemptAlive.current = true; return () => { attemptAlive.current = false; }; }, []);
  const [keeping, setKeeping] = useState(false);
  const [kept, setKept] = useState(false);
  const [keepFailed, setKeepFailed] = useState(false);

  // The sitting could not be read. Told, rather than shown as a spinner that
  // never resolves.
  const [unread, setUnread] = useState(false);

  // A practice sitting's identity and plan: its stable sitting id, when it
  // started, where it came from, its resolved targets, every exercise it has
  // played (twins as played, and those answered before a reload), and whether
  // the French was just shown. Held in a ref because saving and completion read
  // it after the render that built it, and none of it changes mid-sitting.
  const practiceRef = useRef<{
    sittingId: string;
    startedAt: number;
    origin: 'recommended' | 'pack';
    packId: string | null;
    targets: PracticeTarget[];
    exercises: DrillExercise[];
    exposed: boolean;
    /** The account this sitting belongs to; a save or completion for another is refused. */
    scope: number;
  } | null>(null);
  // A practice sitting's end card waits for completion to answer, and then says
  // exactly what its status supports.
  const [practiceSaved, setPracticeSaved] = useState<'waiting' | SaveState>('waiting');
  const [practiceRetrying, setPracticeRetrying] = useState(false);
  const completionRef = useRef<Promise<SaveState> | null>(null);
  // A resume that has nothing to open. 'none': no unfinished sitting is saved
  // (it was already finished, or never started). 'gone': one was saved but its
  // exercises are no longer on this phone, so it is cleared. Either way it is
  // said plainly, and never replaced by a sitting the learner did not start.
  const [cannotResume, setCannotResume] = useState<'none' | 'gone' | null>(null);
  // Whether this sitting went quiet, known rather than inferred: set where the
  // screen applies `suppressMic`, and carried by the resume record.
  const micSuppressedRef = useRef(false);
  // Exercises where the learner asked to see the phrase. Kept in state for the
  // render and in a ref for the saves, restored from the resume record, and
  // handed to completion, which never lets one become recall or a spaced
  // return. Only ever added to: help once asked for stays asked for.
  const [assisted, setAssisted] = useState<string[]>([]);
  const assistedRef = useRef<string[]>([]);

  useEffect(() => {
    if (practice === undefined || practice === 'invalid') return;
    let cancelled = false;
    const scope = scopeGeneration();
    // A completion a previous launch left half-done lands first, so the saved
    // sitting this reads is never one whose grades are still in flight.
    void recoverPracticeCompletion()
      .catch(() => null)
      .then(() => Promise.all([loadDeck(), loadDrillBank(), getMicSuppressedUntil(), loadConversationPacks(), loadPracticeSession()]))
      .then(([deck, bank, until, packs, record]) => {
        if (cancelled || scopeGeneration() !== scope) return;
        const now = Date.now();
        const opening = practiceOpening({ route: practice, record, deck, bank, packs, now });
        if (opening.kind === 'cannot-resume') {
          if (opening.sittingId !== null) void clearPracticeSession(opening.sittingId);
          setCannotResume(opening.sittingId === null ? 'none' : 'gone');
          return;
        }
        if (opening.kind === 'resume') {
          // The same sitting, from the record: its id, targets, answers, queue
          // position and warm-up flag. Nothing is re-graded: completion is keyed
          // on this id, and answers already settled are carried, not replayed.
          const { record: held, restored, answeredExercises } = opening;
          practiceRef.current = {
            sittingId: held.sittingId,
            startedAt: held.startedAt,
            origin: held.origin === 'pack' ? 'pack' : 'recommended',
            packId: held.packId,
            targets: restored.targets,
            exercises: [...answeredExercises, ...restored.state.queue],
            exposed: held.exposed,
            scope,
          };
          openedAt.current = held.startedAt;
          clock.restore(held.activeMs ?? 0);
          micSuppressedRef.current = held.micSuppressed;
          assistedRef.current = [...held.assisted];
          setAssisted([...held.assisted]);
          setSession(restored.state);
          return;
        }
        const built = buildPracticeSession(opening.targets, bank, deck, now);
        const origin = practice.origin === 'pack' ? 'pack' : 'recommended';
        practiceRef.current = {
          sittingId: mintSittingId(now),
          startedAt: now,
          origin,
          packId: origin === 'pack' ? practice.packId : null,
          targets: built.targets,
          exercises: [...built.state.queue],
          exposed: practice.exposed,
          scope,
        };
        let state = built.state;
        if (until !== null && Date.parse(until) > now) {
          state = suppressMic(state);
          micSuppressedRef.current = true;
        } else if (until !== null) void setMicSuppressed(null);
        setSession(state);
      })
      .catch(() => {
        if (!cancelled) setUnread(true);
      });
    return () => {
      cancelled = true;
      tutorVoice.stop();
    };
  }, [practice, clock]);

  /**
   * Save the unfinished sitting: ids and settled facts only, no grade, no XP.
   * Called after every settled answer (a miss that will come round again
   * included) and on Leave, so a reload resumes the same queue and answers.
   * A write for an account that has since changed is refused by the store.
   */
  const savePractice = useCallback((state: DrillSessionState) => {
    const held = practiceRef.current;
    if (held === null || scopeGeneration() !== held.scope) return;
    for (const exercise of state.queue) if (!held.exercises.some((e) => e.id === exercise.id)) held.exercises.push(exercise);
    void savePracticeSession({
      sittingId: held.sittingId,
      startedAt: held.startedAt,
      origin: held.origin,
      packId: held.packId,
      exposed: held.exposed,
      micSuppressed: micSuppressedRef.current,
      targets: held.targets,
      state,
      assisted: assistedRef.current,
      activeMs: clock.read(),
    });
  }, [clock]);

  /**
   * Finish the sitting through `completePracticeSitting`, and nothing else:
   * it alone grades, earns XP, records history and clears the resume record,
   * at most once per sitting id. Safe to call again for a retry. The end card
   * shows exactly what its status supports.
   */
  const finishPractice = useCallback((state: DrillSessionState): Promise<SaveState> => {
    const held = practiceRef.current;
    if (held === null) return Promise.resolve('not-saved');
    const now = Date.now();
    // The plan settles inside completion, which publishes before the end card
    // can mount: the queue is held first, and let go if nothing settled.
    holdForSettle();
    const run = completePracticeSitting({
      sittingId: held.sittingId,
      state,
      targets: held.targets,
      exercises: held.exercises,
      exposed: held.exposed,
      assisted: assistedRef.current,
      durationMs: Math.max(0, now - held.startedAt),
      activeMs: clock.read(),
      now,
    })
      // A plan this call completed settled at its frozen instant; the end card
      // waits for exactly that sitting's delta, never a number worked out here.
      .then((done) => {
        if (done.settlesAt !== null) expect({ source: 'drill', at: done.settlesAt });
        else dropSettleHold();
        return done;
      })
      .then((done) => saveStateOfResult(done))
      .catch((): SaveState => {
        dropSettleHold();
        return 'not-saved';
      });
    completionRef.current = run;
    return run;
  }, [clock, holdForSettle, expect, dropSettleHold]);

  useEffect(() => {
    // A practice sitting is built by the effect above and never by this one.
    if (practice !== undefined) return;
    let cancelled = false;
    const asked = node?.ownWords;
    if (node !== undefined && asked !== undefined) {
      // One exercise, authored on the spot from the phrase the row carried.
      // No deck read and no bank read: an own-words sitting asks for something
      // the learner has never been drilled on, so there is nothing to look up.
      const key = node.phraseKeys[0] ?? phraseKeyOf(asked.fr);
      setSession(scopedOwnWordsSession({ fr: asked.fr, en: asked.en, key }, asked.situation, Date.now()));
      return () => {
        cancelled = true;
        tutorVoice.stop();
      };
    }
    // Topics are read only for the mix: they are the lanes the round robin runs
    // over, and an ordinary sitting has no use for them.
    const topicsSoon = mix ? loadTopics() : Promise.resolve([]);
    void Promise.all([loadDeck(), loadDrillBank(), getMicSuppressedUntil(), topicsSoon])
      .then(
      ([deck, bank, until, topics]) => {
        if (cancelled) return;
        const now = Date.now();
        let built = buildDrillSession(deck, bank, now, node ? { only: node.phraseKeys } : undefined);
        // Reorder, never re-pick: the cap, the earned stage and the newcomer
        // rule were all applied above, and are not this screen's to argue with.
        if (mix) built = { ...built, queue: mixQueue(built.queue, topicGroups(topics)) };
        if (until !== null && Date.parse(until) > now) {
          // Still inside the "can't speak now" hour: open silent, unasked.
          built = suppressMic(built);
          micSuppressedRef.current = true;
        } else if (until !== null) {
          // The window lapsed; clear it so spoken drills return next sitting.
          void setMicSuppressed(null);
        }
        setSession(built);
      },
    )
      .catch(() => {
        // A disk that will not answer is not a reason to strand somebody on a
        // spinner. The screen below draws a way out instead, which is the same
        // treatment the Practice tab got in F449 and for the same reason: a
        // loading state that is also the failure state says nothing at all.
        if (!cancelled) setUnread(true);
      });
    return () => {
      cancelled = true;
      tutorVoice.stop();
    };
  }, [node, mix, practice]);

  /**
   * Feed outcomes to the one memory system, through the review store's own
   * write path: each drilled phrase's key IS its review card's id, so
   * `gradeCard` applies exactly the reschedule `applyDrillResults` describes,
   * on the store's serialized chain. Answered exercises only — the unanswered
   * rest simply stay due.
   */
  const persistGrades = useCallback((state: DrillSessionState) => {
    if (persistedRef.current) return;
    const held = practiceRef.current;
    if (held !== null) {
      // A practice sitting that is not finished is saved, never graded: Leave
      // keeps the queue and the answers for resume, and awards nothing. Only a
      // finished sitting with answered work completes, through the one owner of
      // practice grades, XP and history.
      if (!state.finished) {
        savePractice(state);
        return;
      }
      if (!hasAnsweredWork(state)) return;
      persistedRef.current = true;
      const completion = finishPractice(state);
      gradeWritesRef.current = completion.then(() => undefined);
      return;
    }
    persistedRef.current = true;
    const summary = summariseDrill(state);
    // Collected rather than fired and forgotten: the caller awaits these before
    // navigating, because loadDeck reads storage directly and is not on the
    // review store's write chain. Without it, the screen that comes next can
    // read a deck that predates this sitting.
    // `transfer` rides along rather than being destructured away. Core marks a
    // grade as transfer when the same phrase was asked in a changed situation,
    // and it is the one thing a drill knows that a review sitting cannot: the
    // store drops it on the floor if this map does not carry it, and the
    // learner's evidence record never hears about a drill they got right.
    gradeWritesRef.current = gradeCards(
      summary.grades.map(({ phraseKey, grade, transfer, assisted }) => ({
        id: phraseKey,
        grade,
        ...(transfer === true ? { transfer: true } : {}),
        // Right only after a miss: core brings it back tomorrow, unaided.
        ...(assisted === true ? { assisted: true } : {}),
      })),
    ).then(() => undefined);
    // What the sitting was worth. Clean answers count double, because getting
    // it right without being shown the spelling is the harder thing. Only a
    // first try is clean: right after a miss was shown the answer (F919).
    const xp = drillXp({ clean: firstTry(state).clean, typoCorrected: firstTry(state).typos });
    const endedAt = Date.now();
    const activeMs = clock.read();
    // Only a set worked to its end says it finished, and only that settles
    // (F744); one left from the header banks what it earned and nothing more.
    const bank = () => recordActivity(
      'drill',
      xp,
      endedAt,
      { durationMs: endedAt - openedAt.current, activeMs: activeMs, ...(state.finished ? { finished: true } : {}) },
    );
    // The end card waits for this sitting's delta, read back by the settle,
    // and the queue is held from before the settle until that card goes.
    if (state.finished) expect({ source: 'drill', at: endedAt });
    if (state.finished) void settleSitting({ source: 'drill', at: endedAt, xpEarned: xp, activeMs, write: bank });
    else void bank();
  }, [savePractice, finishPractice, clock, expect]);

  const answer = useCallback(
    (value: string | number) => {
      if (!session || session.finished || feedback) return;
      const current = session.queue[0];
      if (!current) return;
      clock.touch();
      const { state: next, feedback: fb } = answerCurrent(session, value);
      if (!fb) return;
      tutorVoice.stop();
      pendingRef.current = next;
      // Saved the moment it settles, not after the feedback beat: a reload in
      // the beat must not lose an answer the learner already gave, a miss that
      // will come round again included. A finished sitting completes instead.
      if (!next.finished) savePractice(next);
      setFeedback(fb);
      const facts = { kind: current.kind, combo: comboAfter(comboRef.current, fb.verdict, current.kind), turn: session.answered.length, reason: missReason(current, fb.closest),
        oneOfMany: current.kind === 'appropriate-reply' && current.acceptableIndexes.length > 1,
        answerEnglish: current.kind === 'translate' && current.direction === 'fr-en' };
      comboRef.current = facts.combo;
      setCombo(facts.combo);
      setSheetFacts(facts);
      // The sheet's one sound and haptic, now, from the tap that answered: a
      // pass `correct` and `arrived()`, a typo `nearly` and `soft()`, a miss
      // nothing. The seams stay silent while a microphone or a voice holds on.
      fireSheet(sheetFor({ verdict: fb.verdict, closest: fb.closest, advanced: fb.advanced, ...facts, screenReader }));
    },
    [session, feedback, savePractice, clock, screenReader],
  );

  // A spoken attempt. The grade is the self-report's, banked before the scorer
  // is even asked — scoring can add one line to the beat, never subtract.
  const spoke = useCallback(
    (uri: string | null) => {
      // Both of these mean the take arrived after the beat it belonged to. The
      // grade is gone either way; the file must not be.
      if (!session || session.finished || feedback) return discardRecording(uri);
      const current = session.queue[0];
      if (!current || current.kind !== 'repeat-this') return discardRecording(uri);
      const beat = beatRef.current;
      answer(current.reference);
      void consumeRecording(uri, (recorded) => scoreRecordedAttempt(userId, recorded, current.reference)).then(
        (score) => {
          const reason = score?.report.focus?.reason ?? null;
          if (reason !== null && beatRef.current === beat) setFocusLine(reason);
        },
      );
    },
    [session, feedback, answer, userId],
  );

  /**
   * Check one own-words attempt.
   *
   * The only place in this screen where an outcome comes from outside, and the
   * three rules that make that safe are all here.
   *
   * The judge is asked exactly once per Check: `judging` closes the door for
   * the round trip, so a double tap, a return key and a tapped pill together
   * are still one call and one grade.
   *
   * A null verdict is the tutor being unreachable, never a miss. Nothing is
   * handed to `answerCurrent`, so the queue does not move, nothing is recorded
   * as answered, and the summary this screen persists has nothing in it. The
   * learner is shown the line and leaves with their card exactly as it was.
   *
   * And the attempt itself goes no further than the request. It is not put in
   * state that outlives the beat, not written to the deck, and not carried
   * into the summary: core records an id, a phrase key and an outcome.
   */
  const checkOwnWords = useCallback(() => {
    if (!session || session.finished || judging || attemptBusy.current) return;
    const current = session.queue[0];
    if (!current || current.kind !== 'own-words') return;
    const attempt = typed.trim();
    if (attempt === '') return;
    clock.touch();
    const owner = scopeGeneration();
    const beat = beatRef.current;
    attemptBusy.current = true;
    setJudging(true);
    void judgeOwnWords(userId, current, attempt, owner).then((verdict) => {
      attemptBusy.current = false;
      if (!attemptAlive.current || owner !== scopeGeneration() || beat !== beatRef.current) return;
      setJudging(false);
      if (verdict === null) {
        setOwnWords({
          exercise: current,
          verdict: null,
          decided: null,
          message: JUDGE_UNAVAILABLE,
          note: null,
          another: null,
          reveal: current.fr,
          keep: false,
          attempt,
        });
        return;
      }
      // The model observed; this decides. `decideOwnWords` is core's, and the
      // miss count it reads is the same one every other kind is bounded by.
      const decided = decideOwnWords(verdict, session.missesById[current.id] ?? 0);
      const { state: next, feedback: fb } = answerCurrent(session, attempt, decided);
      if (!fb) return;
      // The line and its tone are keyed on the decision (core's
      // ownWordsFeedback): "That works.", "Nearly there." in the nearly tone
      // (D21), or the calm reveal.
      const look = ownWordsLook(decided);
      setOwnWords({
        exercise: current,
        verdict: fb.verdict,
        decided,
        message: look.headline ?? fb.message,
        note: decided === 'retry' ? verdict.note : null,
        another: decided === 'good' ? verdict.betterLine : null,
        reveal: decided === 'reveal' ? current.fr : null,
        keep: decided === 'good',
        attempt,
      });
      comboRef.current = comboAfter(comboRef.current, fb.verdict, 'own-words', decided);
      setCombo(comboRef.current);
      fireSheet(look);
      setTyped('');
      if (next.finished) persistGrades(next);
      else savePractice(next);
      setSession(next);
    });
  }, [session, judging, typed, userId, persistGrades, savePractice, clock]);

  const recordOwnWords = useCallback((uri: string | null) => {
    if (attemptBusy.current || !session || session.finished || session.queue[0]?.kind !== 'own-words') return discardRecording(uri);
    const owner = scopeGeneration();
    const exercise = session.queue[0];
    const beat = beatRef.current;
    attemptBusy.current = true;
    setJudging(true);
    void consumeRecording(uri, path => transcribeRecordedAttempt(userId, path, owner)).then(transcript => {
      if (!attemptAlive.current || owner !== scopeGeneration() || beat !== beatRef.current) return;
      if (transcript !== null) setTyped(transcript);
      else setOwnWords({ exercise, verdict: null, decided: null, message: TRANSCRIPTION_UNAVAILABLE, note: null, another: null, reveal: null, keep: false, attempt: null });
    }).catch(() => {
      if (attemptAlive.current && owner === scopeGeneration() && beat === beatRef.current) setOwnWords({ exercise, verdict: null, decided: null, message: TRANSCRIPTION_UNAVAILABLE, note: null, another: null, reveal: null, keep: false, attempt: null });
    }).finally(() => {
      attemptBusy.current = false;
      if (attemptAlive.current && owner === scopeGeneration() && beat === beatRef.current) setJudging(false);
    });
  }, [session, userId]);

  /**
   * Keep the phrase they just said their own way. The one write this card
   * makes, and it is called saved only when the phrasebook answers durable:
   * then the bookmark fills, the label says so and the saved moment is handed
   * to the host (`review/phraseSaved.ts`). A refused write says so and can be
   * tried again (F762).
   */
  const keepPhrase = useCallback(
    (exercise: OwnWordsExercise) => {
      if (keeping || kept) return;
      setKeeping(true);
      setKeepFailed(false);
      void keepInPhrasebook({ fr: exercise.fr, frWritten: null, en: exercise.en, enLiteral: null, register: 'courant', note: null }, 'conversation')
        .then((saved) => {
          if (!attemptAlive.current) return;
          if (saved) setKept(true);
          else setKeepFailed(true);
        })
        .finally(() => {
          if (attemptAlive.current) setKeeping(false);
        });
    },
    [keeping, kept],
  );

  // The sheet on screen, from core's feedback and the facts beside it. A
  // screen reader that turns on mid-sheet stops it moving on by itself.
  const sheet = feedback !== null && sheetFacts !== null
    ? sheetFor({ verdict: feedback.verdict, closest: feedback.closest, advanced: feedback.advanced, ...sheetFacts, screenReader })
    : null;

  /**
   * Leave the sheet and deal the next exercise. A missed exercise is already at
   * the back of the queue and comes round unannounced. Called once per sheet,
   * by its Continue, a tap on it, or its timer, whichever is first.
   */
  const advance = useCallback(() => {
    const next = pendingRef.current;
    if (next === null) return;
    pendingRef.current = null;
    beatRef.current += 1;
    setFeedback(null);
    setSheetFacts(null);
    setFocusLine(null);
    setTyped('');
    setAssembled([]);
    if (next.finished) persistGrades(next);
    setSession(next);
  }, [persistGrades]);

  // A sheet that moves on by itself does so after its own time. A focus line
  // landing mid-sheet restarts the clock, so the one sentence the scorer gets
  // to say also gets a full beat to be read. A sheet that waits has no timer.
  const autoAdvanceMs = sheet?.autoAdvanceMs ?? null;
  useEffect(() => {
    if (!feedback || autoAdvanceMs === null) return;
    const t = setTimeout(advance, autoAdvanceMs);
    return () => clearTimeout(t);
  }, [feedback, focusLine, autoAdvanceMs, advance]);

  /**
   * Leave, once this sitting is actually on disk.
   *
   * The wait matters because the screen behind this one re-reads the deck the
   * moment it regains focus, and `loadDeck` bypasses the review store's write
   * chain. Navigating first meant the practice map could show a node that had
   * plainly just been finished as untouched.
   */
  //
  // Core builds an empty queue already finished. That is nothing answered, and
  // nothing answered is not a sitting that marks a pack practised, so the
  // signal also waits for answered work. The finish itself is felt on the end
  // card, which gives one celebrate() once its numbers are read back.
  useEffect(() => {
    if (!session?.finished || !node || finishedRef.current) return;
    if (!hasAnsweredWork(session)) return;
    finishedRef.current = true;
    onFinished?.(node.id);
  }, [session, node, onFinished]);

  // A practice sitting says it finished only once its writes have come back,
  // and only with answered work behind it. The pack it names is the one its
  // own answered targets came from; review alone names none.
  useEffect(() => {
    const held = practiceRef.current;
    if (!session?.finished || held === null || finishedRef.current) return;
    if (!hasAnsweredWork(session)) return;
    finishedRef.current = true;
    const answeredKeys = new Set(session.answered.map((a) => a.phraseKey));
    const packTarget = held.targets.find((t) => t.source.kind === 'pack' && answeredKeys.has(t.phraseKey));
    const packId = packTarget !== undefined && packTarget.source.kind === 'pack' ? packTarget.source.packId : null;
    const written = completionRef.current;
    if (written === null) return;
    void written.then((saved) => {
      setPracticeSaved(saved);
      // The phone-only mark follows only a completion that is safe on this
      // phone: saved, or kept to finish later. Never one that was not saved.
      if (saved === 'not-saved') return;
      onPracticeFinished?.(packId);
    });
  }, [session, onPracticeFinished]);

  /**
   * Try the completion again, for the same sitting id. The store replays a
   * frozen plan rather than recomputing it, so nothing is awarded twice.
   */
  const retryPractice = useCallback(() => {
    if (!session || practiceRetrying) return;
    setPracticeRetrying(true);
    void finishPractice(session)
      .then((saved) => {
        setPracticeSaved(saved);
        const held = practiceRef.current;
        if (saved === 'not-saved' || held === null) return;
        const answeredKeys = new Set(session.answered.map((a) => a.phraseKey));
        const packTarget = held.targets.find((t) => t.source.kind === 'pack' && answeredKeys.has(t.phraseKey));
        onPracticeFinished?.(packTarget !== undefined && packTarget.source.kind === 'pack' ? packTarget.source.packId : null);
      })
      .finally(() => setPracticeRetrying(false));
  }, [session, practiceRetrying, finishPractice, onPracticeFinished]);

  const finishAndLeave = useCallback(() => {
    tutorVoice.stop();
    // Mid-beat, the answered exercise lives in pendingRef; count it.
    const state = pendingRef.current ?? session;
    if (state) persistGrades(state);
    void gradeWritesRef.current.finally(onDone);
  }, [session, persistGrades, onDone]);

  const leave = finishAndLeave;

  /**
   * Show the phrase for a practice exercise. The learner has now seen the
   * answer, so the exercise is recorded as assisted and saved at once, before
   * they answer: a reload keeps the line on screen and keeps the mark, and
   * completion reads it, so a right answer after help is practised, never
   * recalled, and never a spaced return.
   */
  const showPhrase = useCallback(
    (exerciseId: string) => {
      if (!session || feedback || assistedRef.current.includes(exerciseId)) return;
      clock.touch();
      assistedRef.current = [...assistedRef.current, exerciseId];
      setAssisted(assistedRef.current);
      savePractice(session);
    },
    [session, feedback, savePractice, clock],
  );

  const goSilent = useCallback(() => {
    if (!session || feedback) return;
    const quiet = suppressMic(session);
    setSession(quiet);
    setTyped('');
    setAssembled([]);
    void setMicSuppressed(new Date(Date.now() + MIC_SUPPRESS_MS).toISOString());
    // A practice sitting that went quiet resumes quiet, on its twins' ids.
    micSuppressedRef.current = true;
    savePractice(quiet);
  }, [session, feedback, savePractice]);

  // What this sitting calls itself. A learner who opened Today's mix and landed
  // on a screen headed "Drills" would have no way to tell the two apart.
  const heading = sittingTitle({ mix });

  // A sitting is an offer, not an obligation. Leaving persists what was
  // answered; the rest simply stays due. Never a count up here. Built once
  // and used by both branches below, because a pushed screen shows exactly
  // one way back and it is this one.
  // Where the learner is in a bounded practice sitting, in words, in the
  // header's quiet centre slot: never a score, a fraction or a bar, and never
  // drawn for an ordinary review sitting, whose queue is not bounded this way.
  const progress = practice !== undefined && practiceRef.current !== null ? sittingProgress(session, practiceRef.current.targets) : null;
  // The living bar: position only, never a digit, filled by phrases settled.
  // During a sheet it reads the state the answer just made, so the bar moves
  // with the answer rather than after it.
  const placed = pendingRef.current ?? session;
  const fill = practice !== undefined && practiceRef.current !== null ? sittingFill(placed, practiceRef.current.targets) : queueFill(placed);
  // 2026-10-21 UI-008, artboard B-Drill: the close disc, the bar where
  // Phase B already draws it, and the words beside it only in a practice
  // sitting ("Phrase four of eight"). The title names the row for a screen
  // reader; the exercise's own eyebrow says what it is on glass.
  // 2026-10-31 drill B v2 (UI-016): DrillFrame draws this one header on the
  // stage band, over the kind's family colour.
  const header = (
    <ScreenHeader
      leave={{ onPress: leave, label: 'Leave', accessibilityLabel: 'Leave the drills', close: true }}
      title={session?.queue[0]?.kind ? drillTitle(session.queue[0].kind) : heading}
      centre={fill !== null && session !== null && !session.finished ? <SittingBar fill={fill} glow={comboGlows(combo)} /> : null}
      trailing={progress !== null ? (
        <Text accessibilityLiveRegion="polite" style={[bType.semi14, { color: bt.text }]}>{progress.label}</Text>
      ) : undefined}
    />
  );
  // What every kind's DrillFrame takes from the screen: the header, what leads
  // the answer area, and the pinned footer.
  const shell = (lead?: ReactNode, footer?: ReactNode): DrillShell => ({ header, lead, footer });
  // The one door on every terminal card, built once for the same reason as
  // the header: each terminal branch shows exactly one way out, and it is this
  // one. `finishAndLeave` and `leave` are the same callback.
  const doneFooter = <PillButton label="Done" onPress={finishAndLeave} />;

  /**
   * An own-words sitting that has been answered, still holding its outcome.
   *
   * It is drawn instead of the end card, and that is the point: a card of
   * counts would take away the better way to say it a second after it arrived,
   * and counts are not what this kind proves anyway. The way out is the
   * header's Leave, which persists the grade exactly as finishing does.
   */
  const holding = session !== null && session.finished && ownWords !== null ? ownWords : null;

  // A resume with nothing to open. The two reasons read differently, because
  // only one of them is about phrases being gone.
  if (cannotResume !== null) {
    const copy = cannotResume === 'none'
      ? { title: PRACTICE_END.nothingToResume, body: PRACTICE_END.nothingToResumeBody }
      : { title: PRACTICE_END.cannotResume, body: PRACTICE_END.cannotResumeBody };
    return (
      <ScrollScreen footer={doneFooter}>
        <Card>
          <Text style={[type.title, { color: bt.text }]}>{copy.title}</Text>
          <Text style={[type.body, { color: bt.muted, marginTop: space(2) }]}>{copy.body}</Text>
        </Card>
      </ScrollScreen>
    );
  }

  // A practice link that could not be read: a reload of an old address, or one
  // typed by hand. Said plainly, and never opened as a different sitting.
  if (practice === 'invalid') {
    return (
      <ScrollScreen footer={doneFooter}>
        <Card>
          <Text style={[type.title, { color: bt.text }]}>{PRACTICE_END.unreadable}</Text>
          <Text style={[type.body, { color: bt.muted, marginTop: space(2) }]}>{PRACTICE_END.unreadableBody}</Text>
        </Card>
      </ScrollScreen>
    );
  }

  if (unread) {
    return (
      <ScrollScreen footer={doneFooter}>
        <Text style={[type.title, { color: bt.text, textAlign: 'center' }]}>{DRILL_UNREAD.title}</Text>
        <Text style={[type.body, { color: bt.muted, textAlign: 'center', marginTop: space(3) }]}>
          {DRILL_UNREAD.body}
        </Text>
      </ScrollScreen>
    );
  }

  if (session === null) {
    return (
      <Screen>
        <View style={ds.loading}>
          <ActivityIndicator color={bt.muted} />
        </View>
      </Screen>
    );
  }

  if (holding !== null) {
    return (
      <DrillClock.Provider value={clock}>
        <OwnWordsView
          key={holding.exercise.id}
          exercise={holding.exercise}
          typed={typed}
          onChange={setTyped}
          onCheck={checkOwnWords}
          onTake={recordOwnWords}
          quiet={micSuppressedRef.current}
          busy={judging}
          outcome={holding}
          onKeep={() => keepPhrase(holding.exercise)}
          keeping={keeping}
          kept={kept}
          keepFailed={keepFailed}
          shell={shell()}
        />
      </DrillClock.Provider>
    );
  }

  // A practice sitting with nothing playable. Said as a fact with a real way
  // forward, never as a finish: nothing was answered, so nothing is recorded.
  if (practice !== undefined && session.finished && !hasAnsweredWork(session)) {
    return (
      <ScrollScreen footer={doneFooter}>
        <Card>
          <Text style={[type.title, { color: bt.text }]}>{PRACTICE_END.empty}</Text>
          <Text style={[type.body, { color: bt.muted, marginTop: space(2) }]}>{PRACTICE_END.emptyBody}</Text>
        </Card>
      </ScrollScreen>
    );
  }

  // A finished practice sitting. It waits for its grades to come back before it
  // says anything, and then says only what the outcomes support. A plan this
  // screen completed also waits, briefly, for the settle to read the sitting
  // back, so the end card's numbers arrive with the card and never after it.
  // The wait is drawn inside the screen with its Done, so there is a way out
  // while it lasts (F775).
  if (practice !== undefined && session.finished) {
    const held = practiceRef.current;
    if (practiceSaved === 'waiting' || held === null || end.state === 'waiting') {
      return (
        <ScrollScreen footer={doneFooter}>
          <View style={ds.ending}>
            <ActivityIndicator color={bt.muted} />
          </View>
        </ScrollScreen>
      );
    }
    // What the sitting showed, read by the data store's own rule, so the card
    // and the history can never disagree about a recall.
    const statement = sittingStatement(
      practiceOutcomes({ state: session, targets: held.targets, exercises: held.exercises, exposed: held.exposed, assisted }),
    );
    const card = practiceEndCard(practiceSaved, statement);
    return (
      <ScrollScreen footer={doneFooter}>
        <View style={ds.ending}>
          {/* The end card in place, only from the delta the settle read back.
              A sitting kept to finish saving, or not saved, has no delta and
              shows none: its statement below says what is true. */}
          {end.state === 'settled' ? <EndCard delta={end.delta} release={release} /> : !card.retry && <FinishFelt />}
          <Card>
            <Text style={[type.title, { color: bt.text }]}>{card.title}</Text>
            <Text style={[type.small, { color: bt.muted, marginTop: space(3) }]}>{card.body}</Text>
            {/* Nothing is safe yet, so the one thing to offer is the same save
                again. The store replays the frozen plan, so it awards nothing twice. */}
            {card.retry && (
              <View style={{ marginTop: space(3), alignItems: 'flex-start' }}>
                <IconAction layout="inline" icon="refresh" busy={practiceRetrying}
                  label={practiceRetrying ? PRACTICE_END.retrying : PRACTICE_END.retry}

                  disabled={practiceRetrying}
                  onPress={retryPractice}
                />
              </View>
            )}
          </Card>
        </View>
      </ScrollScreen>
    );
  }

  // Built empty: nothing due right now. One calm card and the way out. A
  // terminal card, so Done is its one door and it carries no back header.
  if (session.finished && session.answered.length === 0) {
    return (
      <ScrollScreen>
        {/* An empty bank is the good outcome, not a dead end. 2026-10-21
            UI-008, B-Empty-States "Review, all done": the same cloud-cheer card
            the review deck draws, because these two screens say the same
            thing, with Done as its one door. */}
        <EmptyStateCard
          art={{ name: 'cloud-cheer', width: 150, height: 114 }}
          title="Nothing to review."
          body="Your next session adds more."
          action={{ label: 'Done', onPress: finishAndLeave }}
        />
      </ScrollScreen>
    );
  }

  // The end card: the one place numbers are allowed, where they have context,
  // and every one of them is the settle's read-back of this sitting (the
  // count of answers it got right is the sitting's own). While the settle is
  // still reading it back, the card waits inside the screen with its Done; if
  // it never answers, the finish stands in words with no number at all, felt
  // once, and a delta that lands after that is not drawn (`sittingEnd`,
  // F775). Terminal, so Done alone, no back header.
  if (session.finished) {
    const s = summariseDrill(session);
    return (
      <ScrollScreen footer={doneFooter}>
        <View style={ds.ending}>
          {end.state === 'settled' ? (
            <EndCard delta={end.delta} count={firstTry(session).right} release={release} />
          ) : end.state === 'waiting' ? (
            <ActivityIndicator color={bt.muted} />
          ) : (
            <Card>
              <FinishFelt />
              <Text style={[type.title, { color: bt.text }]}>{DRILL_END.finished}</Text>
            </Card>
          )}
          <Text style={[type.small, { color: bt.muted }]}>
            {s.unresolved > 0 ? DRILL_END.comingBack : DRILL_END.deck}
          </Text>
        </View>
      </ScrollScreen>
    );
  }

  const exercise = session.queue[0];
  if (!exercise) return null; // Unreachable: an unfinished session has a head.
  const locked = feedback !== null;

  // The frame every kind stands in: the moment card leads the answer area,
  // and the sheet's reserved slot is the pinned footer.
  const frame = shell(
    node?.moment !== undefined && momentShown({ afterTry: node.afterTry, answering: feedback !== null, answered: session?.answered.length ?? 0 }) ? <MomentCard moment={node.moment} /> : undefined,
    // Reserved height, so the card never jumps when a sheet arrives. The
    // sheet draws no mark on a miss, and that is the rule rather than an
    // oversight: a mid-session message may not scold, and a drawing scolds
    // louder than a word. The scorer's whole say is its one muted line,
    // core's focus reason, already learner-safe: never a score.
    <View style={ds.feedbackArea}>
      {sheet !== null && <AnswerSheet key={beatRef.current} sheet={sheet} note={focusLine} onContinue={advance} />}
    </View>,
  );

  return (
    <DrillClock.Provider value={clock}>
      {exercise.kind === 'fill-blank' && (
        <FillBlankView exercise={exercise} typed={typed} onChange={setTyped} onAnswer={answer} locked={locked} shell={frame} />
      )}
      {exercise.kind === 'best-sentence' && <BestSentenceView exercise={exercise} onAnswer={answer} locked={locked} shell={frame} />}
      {exercise.kind === 'appropriate-reply' && (
        <AppropriateReplyView exercise={exercise} onAnswer={answer} locked={locked} shell={frame} />
      )}
      {exercise.kind === 'tap-translate' && (
        <TapTranslateView
          exercise={exercise}
          assembled={assembled}
          onAssembled={setAssembled}
          onAnswer={answer}
          locked={locked}
          shell={frame}
        />
      )}
      {exercise.kind === 'listen-type' && (
        <ListenTypeView exercise={exercise} typed={typed} onChange={setTyped} onAnswer={answer} locked={locked} shell={frame} />
      )}
      {exercise.kind === 'translate' && (
        <TranslationView
          exercise={exercise}
          typed={typed}
          onChange={setTyped}
          onAnswer={answer}
          locked={locked}
          help={practice !== undefined ? { shown: assisted.includes(exercise.id), onShow: () => showPhrase(exercise.id) } : undefined}
          shell={frame}
        />
      )}
      {exercise.kind === 'repeat-this' && (
        <RepeatThisView exercise={exercise} onAnswer={answer} onSpoke={spoke} onNoMic={goSilent} locked={locked} shell={frame} />
      )}
      {exercise.kind === 'own-words' && (
        <OwnWordsView
          key={exercise.id}
          exercise={exercise}
          typed={typed}
          onChange={setTyped}
          onCheck={checkOwnWords}
          onTake={recordOwnWords}
          quiet={micSuppressedRef.current}
          busy={judging}
          outcome={ownWords}
          onKeep={() => keepPhrase(exercise)}
          keeping={keeping}
          kept={kept}
          keepFailed={keepFailed}
          shell={frame}
        />
      )}
    </DrillClock.Provider>
  );
}

function makeDs(bt: B) {
  return StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  feedbackArea: { minHeight: HIT + 8, justifyContent: 'flex-end' },
  // A finished sitting's end card and the words under it.
  ending: { gap: space(4) },
});
}
