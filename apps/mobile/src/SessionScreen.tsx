/**
 * The mock session driver.
 *
 * Runs the real session engine locally against fabricated speech, so the entire
 * product loop — ladder, rescue, scoring, end card — can be demonstrated and tested
 * with no API keys and no network. The live driver is `LiveSessionScreen`; both
 * render through the same `SessionView`, so the two paths cannot drift visually.
 *
 * The behaviour that matters most here is the silence timer: four seconds after the
 * tutor stops, with nothing said, the tutor steps in and drops a rung. No countdown
 * is shown — pressure is exactly what makes a beginner freeze harder.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createSession,
  currentPrompt,
  submitTurn,
  summarise,
  STUCK_SILENCE_MS,
  type Lesson,
  type Rung,
  type SessionState,
  type SessionSummary,
} from '@luvani/core';
import { SessionView } from './SessionView.tsx';
import { mockObservations, estimateDurationSec } from './mockSpeech.ts';
import * as tutorVoice from './speech/tutorVoice.ts';
import { useActiveClock } from './progress/useActiveClock.ts';

/**
 * How long the tutor's own line takes before the learner is expected to answer.
 * Only used when the device has no French voice — normally the tutor speaks for
 * real and hands over when the line ends.
 */
const TUTOR_SPEAKING_MS = 1500;

type Phase = 'tutor-speaking' | 'awaiting';

export function SessionScreen({
  lesson,
  startRung,
  textMode = false,
  onFinish,
  onExit,
}: {
  lesson: Lesson;
  /** Where the ladder opens. Omitted, the lesson's own opening rung applies. */
  startRung?: Rung;
  textMode?: boolean;
  /**
   * The lesson ended. `timing.activeMs` is the active learning time the
   * screen's clock measured; the writer records it only when it is supplied.
   */
  onFinish: (s: SessionSummary, timing?: { activeMs: number }) => void;
  /**
   * Leave the mock lesson. The demo path had no way out at all until the shared
   * header gave it one; this is what the header's Leave hands back to.
   */
  onExit: () => void;
}) {
  const [session, setSession] = useState<SessionState>(() => createSession(lesson, startRung));
  const [phase, setPhase] = useState<Phase>('tutor-speaking');
  const [flash, setFlash] = useState<string | null>(null);

  const prompt = useMemo(() => currentPrompt(lesson, session), [lesson, session]);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Active learning time. Only the learner's own input is evidence: an answer,
  // a help tap, hearing a line again. The silence rescue is the tutor stepping
  // in because nothing happened, so it never touches the clock.
  const clock = useActiveClock('lesson');

  const advance = useCallback(
    (input: Parameters<typeof submitTurn>[2]) => {
      if (input.type !== 'silence') clock.touch();
      const { state, feedback } = submitTurn(lesson, sessionRef.current, input);
      setSession(state);
      if (feedback.message) setFlash(feedback.message);
      if (state.finished) onFinish(summarise(state), { activeMs: clock.read() });
      else setPhase('tutor-speaking');
    },
    [lesson, onFinish, clock],
  );

  // The tutor speaks, then hands over. Spoken for real through the device
  // synthesizer; the silent timer only survives as the no-French-voice fallback.
  useEffect(() => {
    if (phase !== 'tutor-speaking') return;
    if (textMode) {
      tutorVoice.stop();
      setPhase('awaiting');
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handover = () => {
      if (!cancelled) setPhase('awaiting');
    };
    void tutorVoice.available().then((ok) => {
      if (cancelled) return;
      if (!ok) {
        timer = setTimeout(handover, TUTOR_SPEAKING_MS);
        return;
      }
      const lines = [prompt.turn.tutor];
      // On the echo rung the tutor models the line before asking for it back.
      if (prompt.support.kind === 'full-line' && prompt.support.line !== prompt.turn.tutor) {
        lines.push(prompt.support.line);
      }
      tutorVoice.speakLines(lines, handover);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      tutorVoice.stop();
    };
  }, [phase, prompt, textMode]);

  // The rescue. The product's central promise, four lines long.
  useEffect(() => {
    if (textMode || phase !== 'awaiting' || session.finished) return;
    const t = setTimeout(() => advance({ type: 'silence', durationMs: STUCK_SILENCE_MS }), STUCK_SILENCE_MS);
    return () => clearTimeout(t);
  }, [phase, session.turnIndex, session.attemptsOnTurn, session.finished, advance, textMode]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(t);
  }, [flash]);

  const speak = useCallback(
    (text: string) => {
      if (phase !== 'awaiting') return;
      tutorVoice.stop();
      advance({ type: 'spoke', transcript: text, phonemes: textMode ? [] : mockObservations(prompt.turn), durationSec: textMode ? 0 : estimateDurationSec(text) });
    },
    [advance, phase, prompt.turn, textMode],
  );

  // A replay must never talk over the tutor, so hearing is a listening-time
  // affordance only.
  const support = prompt.support;
  const onHearLine = !textMode && phase === 'awaiting' && support.kind === 'full-line'
    ? () => {
        clock.touch();
        tutorVoice.speak(support.line);
      }
    : undefined;
  const onOptionHear = !textMode && phase === 'awaiting'
    ? (text: string) => {
        clock.touch();
        tutorVoice.speak(text);
      }
    : undefined;

  // Never leave a voice speaking past the screen that started it.
  useEffect(() => () => tutorVoice.stop(), []);

  return (
    <SessionView
      lessonTitle={lesson.title}
      cefr={lesson.cefr}
      prompt={prompt}
      listening={phase === 'awaiting'}
      flash={flash}
      headerLine={textMode ? 'Offline typed practice · No audio or microphone' : 'Offline demo · No microphone recording'}
      onType={textMode ? speak : undefined}
      onLeave={onExit}
      onOptionPress={speak}
      onMicPress={() => speak(prompt.turn.target)}
      onHelp={() => advance({ type: 'help' })}
      onHearLine={onHearLine}
      onOptionHear={onOptionHear}
    />
  );
}
