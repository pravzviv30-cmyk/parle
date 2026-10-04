import { KeptPhraseCard } from './recap/KeptPhraseCard.tsx';
import { PrivatePractice } from './recap/PrivatePractice.tsx';
import { OnceConfetti } from './recap/OnceConfetti.tsx';
import { OnceCount } from './recap/OnceCount.tsx';
import { Illustration } from './art/flat/Illustration.tsx';
import { sceneIllustration } from './art/flat/scenes.ts';
import { recapCanDo } from './recap/evidence.ts';
import { postcardIllustration } from './recap/postcardArt.ts';
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
 * next scene>". Only after all of that does it offer a daily reminder at the
 * time the learner chose, and the phone's notification dialog is raised only
 * when they accept that offer: never before the first win, and never by the
 * card opening. Every one of those decisions is `live/keepsake.ts`'s.
 *
 * Everything else the closure chose (what went well, the other phrases, the
 * small fix, a focus that is not a sound) is one tap away under a closed More,
 * drawn after Done so opening it never pushes the way out down the screen.
 *
 * The postcard, the feature-paper header and the tinted panels left with the
 * notebook redesign, and the card sits on the shared frame rather than
 * measuring the safe area itself.
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from './auth/useAuth.tsx';
import { scopeGeneration } from './storage/scope.ts';
import { recapPages, adjacentRecapPage, type RecapPage } from './recap/pages.ts';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { getMission, missionStates, type RecapPayload } from '@luvani/core';

import { HAIRLINE, HIT, paper, space, type, frenchText, onColour, colour } from './theme.ts';
import { Card, GhostButton, Label, OutlineButton, OptionRow, PillButton, ProgressDots, RoundButton } from './components.tsx';
import { ScrollScreen } from './layout.tsx';
import { arrived } from './motion/haptics.ts';
import { FeedbackLedger } from './motion/feedbackPolicy.ts';
import { SOUND_DETAIL, exampleFirstHeading } from './tutor/soundExample.ts';
import { MouthGuide } from './practice/MouthGuide.tsx';
import { MAX_CLOSURE_PHRASES, closureFromRecap, type ClosureContext } from './conversationPacks/closure.ts';
import { missionCompletionsFrom } from './missions/chooserView.ts';
import { loadMissionCompletions } from './missions/store.ts';
import { loadDeck } from './review/store.ts';
import { loadSoundChecks } from './soundcheck/store.ts';
import { recapLine } from './tutor/recapLine.ts';
import { loadReminder, saveReminder } from './reminders/store.ts';
import { REMINDERS_AVAILABLE, askReminderPermission, reminderPermission, scheduleReminder } from './reminders/schedule.ts';
import { REMINDER_TIMES, type ReminderTimeId, type ReminderPermission, type StoredReminder } from './reminders/reminder.ts';
import {
  KEEPSAKE_COPY,
  acceptReminderOffer,
  nextTimeLine,
  reminderAnswerLine,
  reminderOffer,
  type ReminderAnswer,
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
}: {
  recap: RecapPayload;
  settlementMessage?: string | null;
  /** Already checked against this session’s independent finish and learner source. */
  evidenceQuote?: string | null;
  completedMissionId?: string;
  firstEarned?: boolean;
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
  const ownerScope = useRef(scopeGeneration()).current;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
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
  const [offerTime, setOfferTime] = useState<ReminderTimeId | null>(null);
  const [choosingTime, setChoosingTime] = useState(false);
  const [reminder, setReminder] = useState<'offered' | 'asking' | 'declined' | ReminderAnswer>('offered');


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
  const offeredReminder = offerTime === null ? stored : { enabled: stored?.enabled ?? false, time: offerTime };
  const offer = reminderOffer({ available: REMINDERS_AVAILABLE, won, stored: offeredReminder, permission });
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

  /**
   * The learner said yes to the reminder. This is the only place on the card
   * the phone's notification dialog can be raised, and only when the offer
   * says a dialog is the honest next step.
   */
  const acceptReminder = () => {
    const owns = () => mounted.current && scopeGeneration() === ownerScope;
    if (offer === null || reminder !== 'offered' || !owns()) return;
    setReminder('asking');
    void acceptReminderOffer(offer, { owns, ask: askReminderPermission, read: reminderPermission, save: saveReminder, schedule: scheduleReminder }).then(answer => { if (owns()) setReminder(answer); });
  };

  const saveLine =
    saveState === 'saved'
      ? 'Saved to Progress on this phone'
      : saveState === 'failed'
        ? 'Not saved yet'
        : 'Saving to Progress';

  const mission = completedMissionId ? getMission(completedMissionId) : undefined;
  const canDo = context === null ? null : recapCanDo(context.progress, completedMissionId);
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
        {nextPage !== null || canPractise ? <GhostButton label="Finish conversation" color={ground === 'coral' ? paper.onInk : paper.ink} onPress={onDone} /> : null}
        {previousPage !== null && <GhostButton label="Previous" color={paper.ink} onPress={() => setPage(previousPage)} />}
      </View>}>
      <View style={st.stack}>
        {contextFailed && <Card>
          <Text accessibilityLiveRegion="polite" style={type.body}>Saved progress could not be read. You can still read this conversation's recap and keep its phrase.</Text>
          <GhostButton label="Try reading progress again" onPress={() => setContextRead(value => value + 1)} />
        </Card>}
        <OnceConfetti active={currentPage === 'ability' && firstEarned && canDo !== null} />

        {currentPage === 'result' && <View style={st.head}>
          {keptPhrase !== null ? <><KeptPhraseCard fr={keptPhrase.fr} en={keptPhrase.en} saveLine={saveLine} saved={saveState === 'saved'} eventKey={keptPhrase.key} />
            {saveState === 'failed' && <OutlineButton label="Retry save" onPress={retrySave} />}
            {canPractise && <GhostButton label="Practise this phrase" color={paper.onInk} onPress={() => onPractice!({ fr: keptPhrase.fr, en: keptPhrase.en, situation })} />}
          </> : lines.length > 0 ? <Card><Label>Your French</Label><Text {...frenchText} style={type.french}>{lines[lines.length - 1]}</Text></Card> : null}
          {mission ? <Illustration name={sceneIllustration(mission.id)} fit="small" /> : lines.length > 0 ? <Illustration name="celebrate-first-line" fit="small" /> : <Illustration name="state-waiting" fit="small" />}
          <Text accessibilityRole="header" style={[type.title, { color: paper.onInk }]}>
            {recap.headline}
          </Text>
          {keptPhrase !== null ? <Text style={[type.body, { color: onColour.coral }]}>{situation}</Text> : null}
          {/* How it went, in a sentence. See tutor/recapLine.ts for why the
              old score-like arithmetic is gone. */}
          <Text style={[type.body, { color: onColour.coral }]}>{recapLine(recap.stats)}</Text>
          {settlementMessage && <Text accessibilityLiveRegion="polite" style={[type.body, { color: onColour.coral }]}>{settlementMessage}</Text>}
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
          <GhostButton label="Try this version" onPress={() => setFixingLine(true)} />
        </Card>}

        {/* One phrase kept, on the screen's one highlighter. */}
        {keptPhrase !== null ? (
          <View style={st.keptStack}>
            <KeptPhraseCard fr={keptPhrase.fr} en={keptPhrase.en} saveLine={saveLine} saved={saveState === 'saved'} eventKey={keptPhrase.key} />
            {saveState === 'failed' && <OutlineButton label="Try saving again" onPress={retrySave} />}
            {onPractice !== undefined ? (
              <GhostButton
                label="Practise this phrase"
                disabled={saveState !== 'saved'}
                onPress={() => onPractice({ fr: keptPhrase.fr, en: keptPhrase.en, situation })}
                accessibilityLabel={`Practise ${keptPhrase.fr}`}
              />
            ) : null}
          </View>
        ) : null}

        {lines.length > 0 && <OnceCount value={lines.length} />}
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
            <Illustration name={postcardIllustration(mission.id)} />
            <Text style={[type.body, { color: paper.ink }]}>{firstEarned ? 'Your first independent finish here.' : 'A can-do you have earned.'}</Text>
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

        {/* Only now, a reminder at the learner's chosen time. Accepting it is
            the one thing on this card that may raise the phone's dialog. */}
        {offer !== null && reminder !== 'declined' && (
          <View style={st.offer}>
            {reminder === 'offered' || reminder === 'asking' ? (
              <>
                <Text style={[type.bodyStrong, { color: paper.ink }]}>{offer.title}</Text>
                <Text style={[type.small, { color: paper.inkSoft }]}>{offer.body}</Text>
                <GhostButton label={choosingTime ? 'Keep this time' : 'Change time'} disabled={reminder === 'asking'} onPress={() => setChoosingTime(value => !value)} />
                {choosingTime && reminder === 'offered' && REMINDER_TIMES.map(time => <OptionRow key={time.value} selected={time.value === offer.time.value} title={time.label} detail={time.gloss} onPress={() => setOfferTime(time.value)} />)}
                <View style={st.offerActions}>
                  <OutlineButton label={offer.accept} disabled={reminder === 'asking'} onPress={acceptReminder} />
                  <GhostButton label={offer.decline} disabled={reminder === 'asking'} onPress={() => setReminder('declined')} />
                </View>
              </>
            ) : (
              <Text accessibilityLiveRegion="polite" style={[type.body, { color: paper.ink }]}>
                {reminderAnswerLine(reminder, offer)}
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
  lines: { marginTop: space(2), borderTopWidth: HAIRLINE, borderTopColor: paper.line },
  line: { paddingVertical: space(2.5), borderBottomWidth: HAIRLINE, borderBottomColor: paper.line },
  keptStack: { gap: space(3) },
  kept: { gap: space(2) },
  savedLine: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(2) },
  offer: { gap: space(2), paddingTop: space(4), borderTopWidth: HAIRLINE, borderTopColor: paper.line },
  offerActions: { gap: space(1) },
  disclosure: { minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  more: { gap: space(7), marginTop: space(3) },
  section: { marginTop: space(2) },
  divider: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard, paddingTop: space(3) },
});
