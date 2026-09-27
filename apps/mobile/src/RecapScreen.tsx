/**
 * The conversation's end card, as a keepsake (F552, F584; notebook Phase 4, B1).
 *
 * The end of a conversation is where a learner decides whether to come back,
 * so since 2026-09-27 it is something kept rather than something scored. It
 * reads, in order: the lines the learner said, one phrase kept (on the screen's
 * one highlighter, saved to My French before the card calls it saved), one
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

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { missionStates, type RecapPayload } from '@luvani/core';

import { HAIRLINE, HIT, paper, signal, space, type } from './theme.ts';
import { BookmarkGlyph, Card, GhostButton, Highlight, Label, OutlineButton, PillButton } from './components.tsx';
import { ScrollScreen } from './layout.tsx';
import { arrived } from './motion/haptics.ts';
import { SOUND_DETAIL, exampleFirstHeading } from './tutor/soundExample.ts';
import { MAX_CLOSURE_PHRASES, closureFromRecap, type ClosureContext } from './conversationPacks/closure.ts';
import { missionCompletionsFrom } from './missions/chooserView.ts';
import { loadMissionCompletions } from './missions/store.ts';
import { loadDeck } from './review/store.ts';
import { loadSoundChecks } from './soundcheck/store.ts';
import { recapLine } from './tutor/recapLine.ts';
import { loadReminder, saveReminder } from './reminders/store.ts';
import { REMINDERS_AVAILABLE, askReminderPermission, reminderPermission, scheduleReminder } from './reminders/schedule.ts';
import type { ReminderPermission, StoredReminder } from './reminders/reminder.ts';
import {
  KEEPSAKE_COPY,
  acceptReminderOffer,
  nextTimeLine,
  reminderAnswerLine,
  reminderOffer,
  type ReminderAnswer,
} from './live/keepsake.ts';

export interface RecapPracticePhrase {
  fr: string;
  en: string;
  situation: string;
}

export function RecapScreen({
  recap,
  lines,
  onDone,
  onPractice,
  onSave,
}: {
  recap: RecapPayload;
  /** The learner's own lines from this conversation, from `keepsakeLines`. */
  lines: readonly string[];
  onDone: () => void;
  /** Opens the existing own-words drill with a phrase this conversation earned. */
  onPractice?: (phrase: RecapPracticePhrase) => void;
  /** Persists the exact keepsake phrase and answers only when the write is durable. */
  onSave: (phrase: RecapPracticePhrase) => Promise<boolean>;
}) {
  // Null until the reads answer: the keepsake draws at once from the recap,
  // and the sound and "Next time" arrive a beat later.
  const [context, setContext] = useState<ClosureContext | null>(null);
  // What the reminder offer is decided from. Both are reads: nothing on the
  // way in raises a dialog, and no offer is drawn until both have answered.
  const [stored, setStored] = useState<StoredReminder | null>(null);
  const [permission, setPermission] = useState<ReminderPermission | null>(null);
  const [reminder, setReminder] = useState<'offered' | 'asking' | 'declined' | ReminderAnswer>('offered');

  // Arriving somewhere earned: once, when the card first draws.
  useEffect(() => {
    arrived();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadMissionCompletions(), loadDeck(), loadSoundChecks()])
      .then(([completions, deck, checks]) => {
        if (cancelled) return;
        setContext({ progress: missionStates(missionCompletionsFrom(completions), deck, Date.now()), deck, checks });
      })
      .catch(() => {
        // A disk that will not answer leaves the recap as it arrived. Nothing
        // on it is a claim about the learner that a failed read could falsify.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!REMINDERS_AVAILABLE) return;
    let cancelled = false;
    void Promise.all([loadReminder(), reminderPermission()])
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
  const hasMore = closure.didWell.length > 0 || otherPhrases.length > 0 || closure.repair !== null || otherFocus !== null;
  const [more, setMore] = useState(false);
  const [soundDetail, setSoundDetail] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const situation = closure.title;
  const retrySave = () => {
    if (keptPhrase === null || saveState === 'saving') return;
    setSaveState('saving');
    void onSave({ fr: keptPhrase.fr, en: keptPhrase.en, situation })
      .then((saved) => setSaveState(saved ? 'saved' : 'failed'))
      .catch(() => setSaveState('failed'));
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
    if (offer === null || reminder !== 'offered') return;
    setReminder('asking');
    void acceptReminderOffer(offer, { ask: askReminderPermission, read: reminderPermission, save: saveReminder, schedule: scheduleReminder }).then(setReminder);
  };

  const saveLine =
    saveState === 'saved'
      ? 'Saved to My French'
      : saveState === 'failed'
        ? 'Not saved yet'
        : 'Saving to My French';

  return (
    <ScrollScreen>
      <View style={st.stack}>
        <View style={st.head}>
          <Text accessibilityRole="header" style={[type.display, { color: paper.ink }]}>
            {recap.headline}
          </Text>
          {keptPhrase !== null ? <Text style={[type.body, { color: paper.inkSoft }]}>{situation}</Text> : null}
          {/* How it went, in a sentence. See tutor/recapLine.ts for why the
              old score-like arithmetic is gone. */}
          <Text style={[type.body, { color: paper.inkSoft }]}>{recapLine(recap.stats)}</Text>
        </View>

        {/* Your lines: what the learner actually said, in their own French. */}
        {lines.length > 0 && (
          <View>
            <Label>{KEEPSAKE_COPY.lines}</Label>
            <View style={st.lines}>
              {lines.map((line) => (
                <Text key={line} style={[type.french, st.line, { color: paper.ink }]}>
                  {line}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* One phrase kept, on the screen's one highlighter. */}
        {keptPhrase !== null ? (
          <View style={st.keptStack}>
            <Card style={st.kept}>
              <Label>{KEEPSAKE_COPY.kept}</Label>
              <Highlight text={keptPhrase.fr} />
              <Text style={[type.body, { color: paper.inkSoft }]}>{keptPhrase.en}</Text>
              <View style={st.savedLine}>
                <BookmarkGlyph size={18} color={saveState === 'saved' ? signal.good : paper.ink} />
                <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.ink }]}>{saveLine}</Text>
              </View>
            </Card>
            {saveState === 'failed' && <OutlineButton label="Try saving again" onPress={retrySave} />}
            {onPractice !== undefined ? (
              <PillButton
                label="Practise this phrase"
                onPress={() => onPractice({ fr: keptPhrase.fr, en: keptPhrase.en, situation })}
                accessibilityLabel={`Practise ${keptPhrase.fr}`}
              />
            ) : null}
          </View>
        ) : null}

        {/* One sound, met as a word; the notation is a detail the learner opens. */}
        {sound !== null && (
          <View>
            <Label>{KEEPSAKE_COPY.sound}</Label>
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
          </View>
        )}

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

        <GhostButton label="Finish conversation" onPress={onDone} />

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
                {closure.repair !== null && (
                  <View>
                    <Label>Small fixes</Label>
                    <Card style={st.section}>
                      <Text style={[type.small, { color: paper.inkSoft }]}>« {closure.repair.quote} »</Text>
                      <Text style={[type.french, { color: paper.ink, marginTop: space(1) }]}>{closure.repair.better}</Text>
                      <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{closure.repair.betterEn}</Text>
                      <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{closure.repair.why}</Text>
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
      </View>
    </ScrollScreen>
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
