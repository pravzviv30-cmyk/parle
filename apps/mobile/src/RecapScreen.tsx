import { KeptPhraseCard } from './recap/KeptPhraseCard.tsx';
import { PrivatePractice } from './recap/PrivatePractice.tsx';
import { PostcardStamp } from './celebrate/PostcardStamp.tsx';
import { CountUp } from './motion/CountUp.tsx';
import { Illustration } from './art/flat/Illustration.tsx';
import { sceneIllustration } from './art/flat/scenes.ts';
import { postcardLine, postcardStamp, recapCanDo } from './recap/evidence.ts';
import { postcardIllustration } from './recap/postcardArt.ts';
import { ResultArt } from './recap/ResultArt.tsx';
import { ProgressStrip } from './recap/ProgressStrip.tsx';
import { progressStripView } from './recap/progressStrip.ts';
import { recapMoment } from './recap/moment.ts';
import { useRecapMoment } from './recap/useRecapMoment.ts';
import type { GameDelta } from './game/delta.ts';
import { SaveTextChoice } from './conversationPacks/SaveTextChoice.tsx';
import { FixLineSheet } from './drill/FixLineSheet.tsx';
import type { ConversationText } from '@luvani/core';
/**
 * The conversation's end card, as a keepsake (F552, F584; notebook Phase 4, B1).
 *
 * The end of a conversation is where a learner decides whether to come back,
 * so since 2026-09-27 it is something kept rather than something scored. It
 * leads with one kept phrase and translation on the screen's one highlighter.
 * It confirms a local save before calling it saved. Then come the learner's lines and one
 * sound (a word first, the notation on request), and "Next time: <the spine's
 * next scene>". Only after all of that does it offer a daily reminder, through
 * the one shared ask (`reminders/ReminderAsk.tsx`, Come alive Phase 4): at the
 * learner's chosen time or their own rhythm, naming their tutor, and the
 * phone's notification dialog is raised only when they tap Remind me: never
 * before the first win, and never by the card opening. Whether to offer it at
 * all is `live/keepsake.ts`'s `reminderOffer`.
 *
 * Everything else the closure chose (what went well, the other phrases, the
 * small fix, a focus that is not a sound) is one tap away under a closed More,
 * drawn after Done so opening it never pushes the way out down the screen.
 *
 * The postcard, the feature-paper header and the tinted panels left with the
 * notebook redesign, and the card sits on the shared frame rather than
 * measuring the safe area itself.
 *
 * Come alive (core loop 2.9): this is the conversation's end card, so it is
 * where the fanfare the room held back plays. Once the room has given the
 * learner's ears back (F763), the result page plays its moment
 * (`recap/moment.ts`): a sun glow behind the scene, the `complete` sound, and
 * confetti when the scene was finished on the learner's own; then the progress
 * strip from the settled GameDelta (XP, the day streak, the goal ring). The
 * lines count up to the number said. On the can-do page every independent
 * finish this session gets its postcard stamped (`celebrate/PostcardStamp`),
 * and a finish with help gets the postcard still. Each plays once per recap.
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from './auth/useAuth.tsx';
import { scopeGeneration } from './storage/scope.ts';
import { recapPages, adjacentRecapPage, type RecapPage } from './recap/pages.ts';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { getMission, missionStates, type RecapPayload } from '@luvani/core';

import { HAIRLINE, HIT, paper, space, type, frenchText, onColour, colour, decorative } from './theme.ts';
import { IconAction, Card, GhostButton, Label, OutlineButton, PillButton, ProgressDots, RoundButton } from './components.tsx';
import { ScrollScreen } from './layout.tsx';
import { arrived } from './motion/haptics.ts';
import { holdCelebrations } from './celebrate/queue.ts';
import { FeedbackLedger } from './motion/feedbackPolicy.ts';
import { SOUND_DETAIL, exampleFirstHeading } from './tutor/soundExample.ts';
import { MouthGuide } from './practice/MouthGuide.tsx';
import { MAX_CLOSURE_PHRASES, closureFromRecap, type ClosureContext } from './conversationPacks/closure.ts';
import { missionCompletionsFrom } from './missions/chooserView.ts';
import { loadMissionCompletions } from './missions/store.ts';
import { loadDeck } from './review/store.ts';
import { loadSoundChecks } from './soundcheck/store.ts';
import { recapLine } from './tutor/recapLine.ts';
import { loadReminder } from './reminders/store.ts';
import { REMINDERS_AVAILABLE, reminderPermission } from './reminders/schedule.ts';
import { reminderTime, type ReminderMode, type ReminderPermission, type StoredReminder } from './reminders/reminder.ts';
import { ReminderAsk } from './reminders/ReminderAsk.tsx';
import { useProfile } from './app/ProfileContext.tsx';
import { tutorNameOf } from './tutor/tutorName.ts';
import {
  KEEPSAKE_COPY,
  nextTimeLine,
  reminderAnswerLine,
  reminderOffer,
} from './live/keepsake.ts';

const savedHaptics = new FeedbackLedger();

export interface RecapPracticePhrase {
  fr: string;
  en: string;
  situation: string;
}

export function RecapScreen({
  recap,
  completedMissionId,
  firstEarned = false,
  lines,
  onDone,
  onPractice,
  onSave,
  conversationText,
  settlementMessage,
  evidenceQuote,
  independentFinish = false,
  delta = null,
  momentKey = null,
  onResultShown,
}: {
  recap: RecapPayload;
  settlementMessage?: string | null;
  /** Already checked against this session’s independent finish and learner source. */
  evidenceQuote?: string | null;
  completedMissionId?: string;
  /** A first earn, an earn again, or null when the learner's finish history could not be read (`recap/evidence.ts`, F777). */
  firstEarned?: boolean | null;
  /** This session's finish of the scene was on the learner's own (`recap/evidence.ts` `earnedFinish`). */
  independentFinish?: boolean;
  /** What the conversation changed, read back by the settle; null until it lands, or if it never does. */
  delta?: GameDelta | null;
  /** The session this recap closes, so its moments play once. */
  momentKey?: string | null;
  /** Said once the result page is up: the conversation's settle hold can go (F766). */
  onResultShown?: () => void;
  /** The learner's own lines from this conversation, from `keepsakeLines`. */
  lines: readonly string[];
  onDone: () => void;
  /** Opens the existing own-words drill with a phrase this conversation earned. */
  onPractice?: (phrase: RecapPracticePhrase) => void;
  /** Persists the exact keepsake phrase and answers only when the write is durable. */
  onSave: (phrase: RecapPracticePhrase) => Promise<boolean>;
  conversationText?: { ownerId: string; conversation: ConversationText | null };
}) {
  const { user, adapter } = useAuth();
  const { profile } = useProfile();
  const ownerScope = useRef(scopeGeneration()).current;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // This is the conversation's end card, and the queue waits while the learner
  // reads it, as it does for every end card: what the conversation earned plays
  // after they leave the room. The room's own hold on the audio focus used to do
  // this by accident and now goes before the recap's moment (F763).
  useEffect(() => holdCelebrations(), []);
  // The result page is up and holding the queue itself, so the hold the
  // conversation took before it settled can go (F766). Declared after the hold
  // above, so the queue is never left unheld between the two.
  const resultShown = useRef(onResultShown);
  useEffect(() => {
    resultShown.current?.();
  }, []);
  // Null until the reads answer: the keepsake draws at once from the recap,
  // and the sound and "Next time" arrive a beat later.
  const [page, setPage] = useState<RecapPage>('result');
  const [fixingLine, setFixingLine] = useState(false);
  const [context, setContext] = useState<ClosureContext | null>(null);
  const [contextRead, setContextRead] = useState(0);
  const [contextFailed, setContextFailed] = useState(false);
  // What the reminder offer is decided from. Both are reads: nothing on the
  // way in raises a dialog, and no offer is drawn until both have answered.
  const [stored, setStored] = useState<StoredReminder | null>(null);
  const [permission, setPermission] = useState<ReminderPermission | null>(null);
  // What the ask answered: still open, put aside, or on at the time it names.
  const [reminder, setReminder] = useState<'offered' | 'declined' | { on: ReminderMode }>('offered');


  useEffect(() => {
    let cancelled = false;
    setContext(null);
    setContextFailed(false);
    void Promise.all([loadMissionCompletions(), loadDeck(), loadSoundChecks({ strict: true })])
      .then(([completions, deck, checks]) => {
        if (cancelled) return;
        setContext({ progress: missionStates(missionCompletionsFrom(completions), deck, Date.now()), deck, checks });
      })
      .catch(() => {
        if (!cancelled) setContextFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [contextRead]);

  useEffect(() => {
    if (!REMINDERS_AVAILABLE) return;
    let cancelled = false;
    void Promise.all([loadReminder({ strict: true }), reminderPermission()])
      .then(([saved, allowed]) => {
        if (cancelled) return;
        setStored(saved);
        setPermission(allowed);
      })
      // An unreadable reminder offers nothing rather than guessing.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const closure = closureFromRecap(recap, context);
  // Pick the keepsake from the recap alone, so a later deck read cannot swap the
  // phrase after the save has started. The enriched closure may reorder phrases
  // to prefer something new; remove this exact key wherever it lands and keep
  // the original three-phrase ceiling across the keepsake and the rows below.
  const keptPhrase = closureFromRecap(recap, null).phrases[0] ?? null;
  const otherPhrases = closure.phrases.filter((phrase) => phrase.key !== keptPhrase?.key).slice(0, MAX_CLOSURE_PHRASES - 1);
  // The one sound, when the learner's checks name one. A focus that is not a
  // sound (the tutor's own line, a cadence) waits under More.
  const sound = closure.focus !== null && closure.focus.kind === 'sound' ? closure.focus : null;
  const otherFocus = closure.focus !== null && closure.focus.kind !== 'sound' ? closure.focus : null;
  const nextTime = context === null ? null : nextTimeLine(context.progress);
  // The first-win gate: a recap with nothing in it offers nothing.
  const won = lines.length > 0 || keptPhrase !== null;
  const offer = reminderOffer({ available: REMINDERS_AVAILABLE, won, stored, permission });
  const hasMore = closure.didWell.length > 0 || otherPhrases.length > 0 || otherFocus !== null;
  const [more, setMore] = useState(false);
  const [soundDetail, setSoundDetail] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const situation = closure.title;
  const savedHaptic = useRef(false);
  useEffect(() => { if (saveState === 'saved' && !savedHaptic.current && ownerScope === scopeGeneration() && keptPhrase !== null) { savedHaptic.current = true; if (savedHaptics.claim(`${ownerScope}:${keptPhrase.key}`)) arrived(); } }, [saveState, ownerScope, keptPhrase?.key]);
  const retrySave = () => {
    if (keptPhrase === null || saveState === 'saving' || ownerScope !== scopeGeneration()) return;
    setSaveState('saving');
    void onSave({ fr: keptPhrase.fr, en: keptPhrase.en, situation })
      .then((saved) => { if (mounted.current && ownerScope === scopeGeneration()) setSaveState(saved ? 'saved' : 'failed'); })
      .catch(() => { if (mounted.current && ownerScope === scopeGeneration()) setSaveState('failed'); });
  };

  useEffect(() => {
    if (keptPhrase === null) {
      setSaveState('idle');
      return;
    }
    let cancelled = false;
    setSaveState('saving');
    void onSave({ fr: keptPhrase.fr, en: keptPhrase.en, situation })
      .then((saved) => {
        if (!cancelled) setSaveState(saved ? 'saved' : 'failed');
      })
      .catch(() => {
        if (!cancelled) setSaveState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [keptPhrase?.en, keptPhrase?.fr, keptPhrase?.key, onSave, situation]);

  const saveLine =
    saveState === 'saved'
      ? 'Saved to Progress on this phone'
      : saveState === 'failed'
        ? 'Not saved yet'
        : 'Saving to Progress';

  const mission = completedMissionId ? getMission(completedMissionId) : undefined;
  const canDo = context === null ? null : recapCanDo(context.progress, completedMissionId);
  // The moment the room held back (recap/moment.ts), on its clock, once.
  const scene = recapMoment({ won, sceneFinished: mission !== undefined, independentFinish });
  const moment = useRecapMoment({ key: momentKey, plays: scene.plays });
  const strip = progressStripView(delta);
  // Every independent finish this session is stamped; a finish with help is not.
  const stamp = postcardStamp({ independent: independentFinish, firstEarned });
  const savableText = ownerScope === scopeGeneration() && adapter.kind === 'supabase'
    && conversationText?.ownerId === user?.id && (conversationText?.conversation?.lines.length ?? 0) > 0;
  const pages = recapPages({
    lines: lines.length > 0, phrase: keptPhrase !== null, repair: closure.repair !== null,
    sound: sound !== null, ability: canDo !== null,
    next: keptPhrase !== null || nextTime !== null || savableText || offer !== null || hasMore,
  });
  const pageIndex = Math.max(0, pages.indexOf(page));
  const currentPage = pages[pageIndex]!;
  const nextPage = adjacentRecapPage(pages, currentPage, 1);
  const previousPage = adjacentRecapPage(pages, currentPage, -1);
  const canPractise = keptPhrase !== null && saveState === 'saved' && onPractice !== undefined;
  const ground = currentPage === 'result' ? 'coral' : currentPage === 'sound' ? 'sun' : currentPage === 'ability' ? 'mint' : undefined;
  // The lines count up the first time their page shows, and are simply there after.
  const linesShown = useRef(false);
  useEffect(() => {
    if (currentPage === 'lines') linesShown.current = true;
  }, [currentPage]);
  const linesUnit = lines.length === 1 ? 'line you said' : 'lines you said';
  return (<>
    <ScrollScreen bottom="inset" ground={ground ? colour[ground] : paper.ground}
      header={<View style={{ flexDirection: 'row', gap: space(4), alignItems: 'center' }}>
        <RoundButton kind="close" accessibilityLabel="Finish conversation" onPress={onDone} tone="white" />
        <ProgressDots total={pages.length} index={pageIndex} ground={ground ?? 'paper'} />
      </View>}
      footer={<View style={{ gap: space(2) }}>
        {nextPage === null && canPractise
          ? <PillButton label="Practise this phrase" onPress={() => onPractice({ fr: keptPhrase.fr, en: keptPhrase.en, situation })} />
          : <PillButton tone={currentPage === 'result' ? 'white' : 'ink'} label={nextPage === null ? 'Finish conversation' : 'Next'}
              onPress={() => nextPage === null ? onDone() : setPage(nextPage)} />}
        {previousPage !== null && <IconAction layout="inline" icon="back" label="Previous"  onPress={() => setPage(previousPage)} />}
      </View>}>
      <View style={st.stack}>
        {contextFailed && <Card>
          <Text accessibilityLiveRegion="polite" style={type.body}>Saved progress could not be read. You can still read this conversation's recap and keep its phrase.</Text>
          <IconAction layout="inline" icon="refresh" label="Try reading progress again" onPress={() => setContextRead(value => value + 1)} />
        </Card>}
        {currentPage === 'result' && <View style={st.head}>
          {keptPhrase !== null ? <><KeptPhraseCard fr={keptPhrase.fr} en={keptPhrase.en} saveLine={saveLine} saved={saveState === 'saved'} eventKey={keptPhrase.key} />
            {saveState === 'failed' && <OutlineButton label="Retry save" onPress={retrySave} />}
            {canPractise && <IconAction layout="inline" icon="microphone" label="Practise this phrase" ground="blue" onPress={() => onPractice!({ fr: keptPhrase.fr, en: keptPhrase.en, situation })} />}
          </> : lines.length > 0 ? <Card><Label>Your French</Label><Text {...frenchText} style={type.french}>{lines[lines.length - 1]}</Text></Card> : null}
          <ResultArt moment={moment} burst={scene.burst} seed={`recap:${momentKey ?? recap.headline}`}>
            {mission ? <Illustration name={sceneIllustration(mission.id)} fit="small" /> : lines.length > 0 ? <Illustration name="celebrate-first-line" fit="small" /> : <Illustration name="state-waiting" fit="small" />}
          </ResultArt>
          <Text accessibilityRole="header" style={[type.title, { color: paper.onInk }]}>
            {recap.headline}
          </Text>
          {keptPhrase !== null ? <Text style={[type.body, { color: onColour.coral }]}>{situation}</Text> : null}
          {/* How it went, in a sentence. See tutor/recapLine.ts for why the
              old score-like arithmetic is gone. */}
          <Text style={[type.body, { color: onColour.coral }]}>{recapLine(recap.stats)}</Text>
          {settlementMessage && <Text accessibilityLiveRegion="polite" style={[type.body, { color: onColour.coral }]}>{settlementMessage}</Text>}
          {/* What the conversation changed, from the settle, on its beat. */}
          {strip !== null && moment.reached('strip') ? <ProgressStrip view={strip} final={moment.final} /> : null}
        </View>}

        {currentPage === 'lines' && <View style={{ gap: space(5) }}>
        {/* Your lines: what the learner actually said, in their own French. */}
        {lines.length > 0 && (
          <View>
            <Label>{KEEPSAKE_COPY.lines}</Label>
            <View style={st.lines}>
              {lines.map((line) => (
                <Text {...frenchText} key={line} style={[type.french, st.line, { color: paper.ink }]}>
                  {line}
                </Text>
              ))}
            </View>
          </View>
        )}

        {closure.repair !== null && <Card style={st.kept}>
          <Label>One change to try</Label>
          <Text style={type.small}>Your words</Text>
          <Text {...frenchText} style={type.frenchSm}>{closure.repair.quote}</Text>
          <Text style={type.small}>A natural alternative</Text>
          <Text {...frenchText} style={type.french}>{closure.repair.better}</Text>
          <Text style={type.body}>{closure.repair.betterEn}</Text>
          <Text style={type.small}>{closure.repair.why}</Text>
          <IconAction layout="inline" icon="microphone" label="Try this version" onPress={() => setFixingLine(true)} />
        </Card>}

        {/* One phrase kept, on the screen's one highlighter. */}
        {keptPhrase !== null ? (
          <View style={st.keptStack}>
            <KeptPhraseCard fr={keptPhrase.fr} en={keptPhrase.en} saveLine={saveLine} saved={saveState === 'saved'} eventKey={keptPhrase.key} />
            {saveState === 'failed' && <OutlineButton label="Try saving again" onPress={retrySave} />}
            {onPractice !== undefined ? (
              <IconAction layout="inline" icon="microphone"
                label="Practise this phrase"
                disabled={saveState !== 'saved'}
                onPress={() => onPractice({ fr: keptPhrase.fr, en: keptPhrase.en, situation })}
                accessibilityLabel={`Practise ${keptPhrase.fr}`}
              />
            ) : null}
          </View>
        ) : null}

        {lines.length > 0 && (
          <View style={st.count} accessible accessibilityLabel={`${lines.length} ${linesUnit}`}>
            <CountUp from={linesShown.current ? lines.length : 0} to={lines.length} label={`${lines.length} ${linesUnit}`} textStyle={[type.hero, { color: paper.ink }]} />
            <Text {...decorative} style={[type.title, { color: paper.ink, paddingBottom: space(1.5) }]}>{linesUnit}</Text>
          </View>
        )}
        </View>}

        {currentPage === 'sound' && <View>
        <Text accessibilityRole="header" style={[type.title, { color: paper.ink }]}>From a saved sound check</Text>
        {sound && <Text style={[type.small, { color: paper.ink }]}>This check concerns its recorded reference line, not your pronunciation overall. {getMission(sound.missionId)?.titleEn ?? 'A previous scene'}.</Text>}

        {/* One sound, met as a word; the notation is a detail the learner opens. */}
        {sound !== null && (
          <View>
            <Label>{KEEPSAKE_COPY.sound}</Label>
            <MouthGuide ipa={sound.ipa} />
            <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(2) }]}>{exampleFirstHeading(sound.acoustic, sound.example)}</Text>
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(1) }]}>{sound.acoustic.cue}</Text>
            <Pressable
              onPress={() => setSoundDetail((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: soundDetail }}
              style={({ pressed }) => [st.disclosure, pressed && st.pressed]}
            >
              <Text style={[type.small, { color: paper.ink }]}>{soundDetail ? SOUND_DETAIL.hide : SOUND_DETAIL.show}</Text>
            </Pressable>
            {soundDetail && <Text style={[type.notation, { color: paper.inkSoft }]}>{sound.acoustic.heading}</Text>}
            {sound.example !== null && <PrivatePractice key={sound.example} french={sound.example} />}
          </View>
        )}

        </View>}

        {currentPage === 'ability' && <View style={{ gap: space(4) }}>
          <Text accessibilityRole="header" style={[type.title, { color: paper.ink }]}>{canDo}</Text>
          {canDo !== null && mission && <>
            {stamp !== null
              ? <PostcardStamp art={postcardIllustration(mission.id)} kind={stamp} momentKey={momentKey} />
              : <Illustration name={postcardIllustration(mission.id)} />}
            <Text style={[type.body, { color: paper.ink }]}>{postcardLine(stamp)}</Text>
            {evidenceQuote && <View style={{ gap: space(2) }}>
              <Text style={[type.body, { color: paper.inkSoft }]}>Your line</Text>
              <Text accessibilityLanguage="fr" style={[type.title, { color: paper.ink }]}>{evidenceQuote}</Text>
            </View>}
          </>}
        </View>}

        {currentPage === 'next' && <View style={{ gap: space(4) }}>
        {keptPhrase !== null && <View style={{ gap: space(2) }}>
          <Text style={type.heading}>Your next practice</Text>
          <Text style={type.body}>Try the line you kept from {situation}. You can also finish and return later.</Text>
          <Text {...frenchText} style={type.french}>{keptPhrase.fr}</Text>
          <Text style={type.small}>{saveLine}</Text>
          {saveState === 'failed' && <OutlineButton label="Try saving again" onPress={retrySave} />}
        </View>}
        {conversationText && <SaveTextChoice {...conversationText} />}
        {/* Next time: the spine's next scene, the reason to come back. */}
        {nextTime !== null && <Text style={[type.heading, { color: paper.ink }]}>{nextTime}</Text>}

        {/* Only now, the one reminder ask. Its Remind me is the one thing on
            this card that may raise the phone's dialog. */}
        {offer !== null && reminder !== 'declined' && (
          <View style={st.offer}>
            {reminder === 'offered' ? (
              <ReminderAsk
                time={offer.choice}
                tutor={tutorNameOf(profile)}
                asks={offer.asks}
                onDone={(answer) => {
                  if (!mounted.current || scopeGeneration() !== ownerScope) return;
                  setReminder(answer.enabled ? { on: answer.time } : 'declined');
                }}
              />
            ) : (
              <Text accessibilityLiveRegion="polite" style={[type.body, { color: paper.ink }]}>
                {reminderAnswerLine('on', { choice: reminder.on, time: reminderTime(reminder.on) })}
              </Text>
            )}
          </View>
        )}



        {/* Everything else the closure chose, one tap away and closed by
            default. Drawn after Done so opening it never pushes the way out
            down the screen. */}
        {hasMore && (
          <View>
            <Pressable
              onPress={() => setMore((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={more ? 'Hide more from this conversation' : 'More from this conversation'}
              accessibilityState={{ expanded: more }}
              style={({ pressed }) => [st.disclosure, pressed && st.pressed]}
            >
              <Text style={[type.small, { color: paper.ink }]}>{more ? 'Show less' : 'More'}</Text>
            </Pressable>
            {more && (
              <View style={st.more}>
                {closure.didWell.length > 0 && (
                  <View>
                    <Label>Your wins</Label>
                    <Card style={st.section}>
                      <View style={{ gap: space(2.5) }}>
                        {closure.didWell.map((win) => (
                          <Text key={win} style={[type.french, { color: paper.ink }]}>« {win} »</Text>
                        ))}
                      </View>
                    </Card>
                  </View>
                )}
                {otherPhrases.length > 0 && (
                  <View>
                    <Label>New phrases</Label>
                    <Card style={st.section}>
                      <View style={{ gap: space(3) }}>
                        {otherPhrases.map((phrase, index) => (
                          <View key={phrase.key} style={index > 0 ? st.divider : undefined}>
                            <Text style={[type.french, { color: paper.ink }]}>{phrase.fr}</Text>
                            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{phrase.en}</Text>
                          </View>
                        ))}
                      </View>
                    </Card>
                  </View>
                )}
                {otherFocus !== null && (
                  <View>
                    <Label>One thing to tune</Label>
                    <Card style={st.section}>
                      {otherFocus.kind === 'clarity' ? (
                        <Text style={[type.bodyStrong, { color: paper.ink }]}>{otherFocus.line}</Text>
                      ) : (
                        <>
                          <Text style={[type.french, { color: paper.ink }]}>{otherFocus.fr}</Text>
                          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{otherFocus.en}</Text>
                          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{otherFocus.note}</Text>
                        </>
                      )}
                    </Card>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
        </View>}
      </View>
    </ScrollScreen>
    {fixingLine && closure.repair !== null && <FixLineSheet repair={closure.repair} onClose={() => setFixingLine(false)} />}
    </>
  );
}

const st = StyleSheet.create({
  stack: { paddingTop: space(3), paddingBottom: space(8), gap: space(6) },
  head: { gap: space(2) },
  // The number said and its words, set on one baseline as the hero number is.
  count: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: space(2) },
  lines: { marginTop: space(2), borderTopWidth: HAIRLINE, borderTopColor: paper.line },
  line: { paddingVertical: space(2.5), borderBottomWidth: HAIRLINE, borderBottomColor: paper.line },
  keptStack: { gap: space(3) },
  kept: { gap: space(2) },
  savedLine: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(2) },
  offer: { gap: space(2), paddingTop: space(4), borderTopWidth: HAIRLINE, borderTopColor: paper.line },
  disclosure: { minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  more: { gap: space(7), marginTop: space(3) },
  section: { marginTop: space(2) },
  divider: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard, paddingTop: space(3) },
});
