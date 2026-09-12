/**
 * Practice — made from the learner's own conversations.
 *
 * This tab used to draw an authored path, then the archive of everything the
 * learner said. It keeps the archive and opens on what the newest conversation
 * left to practise (F554): the moment worth replaying, said as what they said
 * and a better way, never audio; the phrase worth making theirs; and the sound
 * to tune, from the newest sound check. Every one of those decisions is in
 * `practice/madeFrom.ts` and none of them is here. A learner with no
 * conversation behind them meets the same three shapes from the café lesson
 * (`practice/starter.ts`), one sentence saying the page becomes personal after
 * the first conversation, and the tab's one pill opening it.
 *
 * The mockup is drawn full, and a learner on their first morning has none of
 * it. So the tab grows: no vault and no feed until there is a conversation, no
 * ordering line until there are two, no filters until four. Every one of those
 * decisions is in `practice/archive.ts` and none of them is here. This file is
 * null gates and a stylesheet, the same shape `home/MomentumCards.tsx` settled
 * on, because a screen that can count is a screen that can draw a nought.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  DAILY_SCENARIOS,
  levelFor,
  phraseKeyOf,
  scenariosForLevel,
  seedTopicOf,
  totalXp,
  type ConversationPack,
  type DailyScenario,
  type ReviewCard,
} from '@luvani/core';
import { paper, space, type } from '../theme.ts';
import { Card, Label, OutlineButton, PillButton } from '../components.tsx';
import { ScrollScreen, TabHeader } from '../layout.tsx';
import {
  archiveFrom,
  sessionsUnder,
  ARCHIVE_LABEL,
  CLOSING,
  FEED,
  UNREAD,
  type Archive,
  type FilterKey,
} from '../practice/archive.ts';
import { SessionFilters } from '../practice/SessionFilters.tsx';
import { SessionRow } from '../practice/SessionRow.tsx';
import { VaultCard } from '../practice/VaultCard.tsx';
import { ScenarioCard } from '../practice/ScenarioCard.tsx';
import { NEXT_STEP, nextStep, packLine, reviewLine, type NextStep } from '../practice/nextStep.ts';
import { reshuffle, suggestionFor, walkOn, SUGGESTION, type Walk } from '../practice/suggestion.ts';
import { firstWalk, loadWalk, saveWalk } from '../practice/suggestionStore.ts';
import { MADE_FROM, madeFromConversations, type MadeFrom } from '../practice/madeFrom.ts';
import { STARTER, starterFrom } from '../practice/starter.ts';
import { ReplayMomentCard } from '../practice/ReplayMomentCard.tsx';
import { MakePhraseCard } from '../practice/MakePhraseCard.tsx';
import { TuneSoundCard } from '../practice/TuneSoundCard.tsx';
import { addPhrases, loadDeck } from '../review/store.ts';
import { loadActivity } from '../progress/activity.ts';
import { loadSoundChecks } from '../soundcheck/store.ts';
import { useLive } from '../app/LiveContext.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { loadConversationPacks, refreshConversationPacks } from '../conversationPacks/store.ts';
import { loadPackMarks, withMarks, type PackMark } from '../conversationPacks/marks.ts';
import { TUTOR_OFFLINE, tutorGate } from '../tutor/gate.ts';
import * as tutorVoice from '../speech/tutorVoice.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';

export function PracticeTab() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { recheck } = useLive();
  const { user, adapter } = useAuth();

  // Null while storage has not answered yet, which is not the same as a learner
  // with nothing: an archive drawn from an unanswered read would flash the
  // first-conversation words at somebody who has had thirty.
  const [archive, setArchive] = useState<Archive | null>(null);
  // What to do now, answered whole by practice/nextStep.ts: a due deck, the
  // newest conversation nobody has come back to, the first conversation for a
  // learner with none, or nothing at all.
  const [step, setStep] = useState<NextStep | null>(null);
  // The three cards made from the newest conversation, or the starter set when
  // there is none. Null while storage has not answered; `{ value: null }` is a
  // learner with no conversation yet, which is a fact rather than a wait.
  const [made, setMade] = useState<{ value: MadeFrom | null } | null>(null);
  // Which filter the learner chose. Resets to nothing on purpose when the row
  // stops earning its place, since sessionsUnder falls back to the whole feed.
  const [filter, setFilter] = useState<FilterKey>('all');
  // The learner's own deal of the pool, and where they are in it.
  const [walk, setWalk] = useState<Walk | null>(null);
  // Which tier of the pool this learner is pitched at. The same rule the word
  // of the day already reads, so the two cannot disagree about how far somebody
  // has come. Null until the activity log answers.
  const [levelIndex, setLevelIndex] = useState<number | null>(null);
  // A probe is in flight. The doors here that touch the network run one before
  // they navigate, and without the flag the tap does nothing visible for up to
  // a second and a half and a second tap queues a second navigation.
  const [checking, setChecking] = useState(false);
  // The start that did not happen, so the retry is the same start.
  const [heldBack, setHeldBack] = useState<{ textMode: boolean } | null>(null);
  // A phrase is being kept: a write and a read back, and the button says so.
  const [saving, setSaving] = useState(false);
  // The read did not finish, and the learner is told so.
  //
  // Without this there is no third state: `archive` was null both while storage
  // was answering and after something threw, and every gate below is
  // `x !== null && draw`, so a failure was invisible by construction. That is
  // exactly how F449 reached a real phone as a screen that sat there loading
  // and never said a word.
  const [failed, setFailed] = useState(false);
  // The clock, read once per focus and held. The suggestion is a pure function
  // of the day and the offset, and reading Date.now() while rendering would
  // let a redraw at midnight move the card under the learner's thumb.
  const [day, setDay] = useState<number | null>(null);
  // Whether the learner has moved the suggestion card since this focus began.
  // A ref rather than state: nothing renders from it, and it has to be readable
  // by the storage callback that resolves after the tap.
  const movedRef = useRef(false);

  // A voice started here stops when the tab goes.
  useEffect(() => () => tutorVoice.stop(), []);

  /**
   * Read everything the tab draws, and say so if it cannot.
   *
   * A `useCallback` rather than an inline effect body because the failure card
   * offers Try again, and the retry has to be the same work rather than a
   * second copy of it that could drift.
   *
   * `.catch` and not a second argument to `.then`: a throw inside the
   * fulfilment handler rejects the promise `.then` returns, and an `onRejected`
   * passed alongside it does not see that. The whole point here is the throw
   * inside the handler, so it has to be a `.catch` at the end of the chain, and
   * the inner refresh is returned rather than floated so its failures land in
   * the same place.
   */
  const load = useCallback(
    (cancelled: () => boolean) => {
      const now = Date.now();
      setDay(now);
      setFailed(false);

      void loadWalk(now).then((stored) => {
        // Only if the learner has not already moved the card themselves. A slow
        // disk answering after a tap used to snap the suggestion back.
        if (!cancelled() && !movedRef.current) setWalk(stored);
      });

      const draw = (fetched: readonly ConversationPack[], deck: readonly ReviewCard[], marks: readonly PackMark[], checks: readonly SoundCheckEvidence[]) => {
        // This phone's marks folded in first, so the archive, the step and the
        // cards read one set of packs and cannot disagree about a practised one.
        const packs = withMarks(fetched, marks);
        setArchive(archiveFrom({ packs, deck, now }));
        setStep(nextStep(deck, packs, now));
        setMade({ value: madeFromConversations({ packs, marks, deck, checks, now }) });
      };

      // Draw the cache at once, then quietly replace it with the server-owned
      // truth. A closed app can miss the original live delivery, so this pull
      // is the recovery path rather than a decorative refresh.
      void Promise.all([loadConversationPacks(), loadDeck(), loadActivity(), loadPackMarks(), loadSoundChecks()])
        .then(([packs, deck, activity, marks, checks]) => {
          if (cancelled()) return undefined;
          draw(packs, deck, marks, checks);
          setLevelIndex(levelFor(totalXp(activity)).index);

          if (user === null) return undefined;
          return refreshConversationPacks(user, adapter).then((result) => {
            if (!cancelled() && result.ok) draw(result.packs, deck, marks, checks);
          });
        })
        .catch(() => {
          if (!cancelled()) setFailed(true);
        });
    },
    [user, adapter],
  );

  // Rebuilt on every return: a conversation that just finished must be on the
  // feed the moment the learner lands back here.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      movedRef.current = false;
      load(() => cancelled);
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  // Pitched, then dealt. `scenariosForLevel` narrows the pool to the learner's
  // tier and the walk decides which of what is left they are looking at. Both
  // wait on storage, so the card arrives with the rest of the screen rather
  // than showing a beginner something meant for somebody two levels up.
  const pool = levelIndex === null ? [] : scenariosForLevel(DAILY_SCENARIOS, levelIndex);
  const scenario: DailyScenario | null = walk === null ? null : suggestionFor(pool, walk);

  /**
   * Back to the tutor, about this suggestion.
   *
   * Probed first, so a server that came up after launch is used. The navigation
   * happens either way because the Convo route is gated: a learner whose
   * servers are down lands on honest words with Check again and Back, rather
   * than on a press that appears to do nothing. `go` is passed twice so a probe
   * that ever threw still lets go of the flag instead of retiring the tab.
   */
  const talkAbout = (seed: DailyScenario) => {
    if (checking) return;
    setChecking(true);
    const go = () => {
      setChecking(false);
      nav.navigate('Convo', { seedTopic: seedTopicOf(seed) });
    };
    void recheck().then(go, go);
  };

  /**
   * The first conversation, probed the way the hero's start is (F555).
   *
   * Refused rather than opened blind, because the whole point of this branch
   * is a learner with nothing behind them, and the first thing they meet must
   * not be a dead press. A refusal is answered on the tab with the same start.
   */
  const startFirst = () => {
    if (checking) return;
    setChecking(true);
    void recheck().then((answered) => {
      setChecking(false);
      const decision = tutorGate(answered, false);
      if (!decision.go) {
        setHeldBack(decision.heldBack);
        return;
      }
      setHeldBack(null);
      nav.navigate(decision.screen, decision.params);
    }).catch(() => {
      setChecking(false);
      setHeldBack({ textMode: false });
    });
  };

  /** A drill is local. Nothing to probe, so nothing to wait for. */
  const revisit = (node: { id: string; title: string; phraseKeys: readonly string[] }) => {
    nav.navigate('Drill', { node: { id: node.id, title: node.title, phraseKeys: node.phraseKeys } });
  };

  /**
   * Keep a phrase from a conversation, then read the deck back so the card
   * says what the store holds rather than what this screen assumed it would.
   */
  const keepPhrase = (phrase: { fr: string; en: string }) => {
    if (saving) return;
    setSaving(true);
    void addPhrases([{ fr: phrase.fr, frWritten: null, en: phrase.en, enLiteral: null, register: 'courant', note: null }])
      .then(() => load(() => false))
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  /**
   * Another situation, from the same deal.
   *
   * When the walk comes back round to the top the pool is reshuffled rather
   * than repeated, so a learner who has been through all of them meets a new
   * order instead of the same one again. That is the whole of "shuffle" as far
   * as the learner is concerned, and it needs no second control on the card:
   * one button that never repeats until it has to.
   */
  const another = () => {
    movedRef.current = true;
    const stepped = walkOn(walk ?? firstWalk(Date.now()), pool.length);
    const moved = stepped.position === 0 ? reshuffle(Date.now()) : stepped;
    setWalk(moved);
    void saveWalk(moved);
  };

  const shown = archive === null ? [] : sessionsUnder(archive, filter);
  const starter = starterFrom();

  return (
    <ScrollScreen
      bottom="tab"
      // The frame header keeps only the F154 checking receipt, so a tap that
      // has to wait on the network stays acknowledged when the title scrolls
      // away. The gate's own word, so the tab and the tutor card do not grow
      // two vocabularies for the same second and a half.
      header={checking && (
        <Text
          accessibilityLiveRegion="polite"
          style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}
        >
          {TUTOR_OFFLINE.checking}
        </Text>
      )}
    >
      <View style={st.scroll}>
        <TabHeader
          title="Practice"
          purpose="Made from your conversations."
        />

        {/* The read did not finish. Said plainly, with the same work offered
            again rather than an instruction to leave and come back. */}
        {failed && (
          <View style={st.block}>
            <Card>
              <Text style={st.openingTitle}>{UNREAD.title}</Text>
              <Text style={st.openingBody}>{UNREAD.body}</Text>
              <View style={st.blockBody}>
                <OutlineButton label={UNREAD.retry} onPress={() => load(() => false)} />
              </View>
            </Card>
          </View>
        )}

        {/* The one thing to do now, decided in practice/nextStep.ts and drawn
            here as the tab's only pill, in three branches. When the deck is
            quiet and every conversation has been revisited there is no step,
            and this draws nothing rather than a cheerful message for a learner
            who is done. */}
        {step !== null && (
          <View style={st.block}>
            <Label>{NEXT_STEP.label}</Label>
            <View style={st.blockBody}>
              {step.kind === 'review' && (
                <View>
                  <PillButton label={NEXT_STEP.review} onPress={() => nav.navigate('Review')} />
                  <Text style={st.stepSub}>{reviewLine(step.due)}</Text>
                </View>
              )}
              {step.kind === 'pack' && (
                <View>
                  <PillButton
                    label={step.pack.title.en}
                    onPress={() => revisit({ id: step.pack.id, title: step.pack.title.en, phraseKeys: step.pack.keyPhrases.map((phrase) => phraseKeyOf(phrase.fr)) })}
                  />
                  <Text style={st.stepSub}>{packLine(step.pack)}</Text>
                </View>
              )}
              {step.kind === 'first' && (
                <View>
                  <PillButton label={NEXT_STEP.first} disabled={checking} onPress={startFirst} />
                  <Text style={st.stepSub}>{STARTER.line}</Text>
                  {heldBack !== null && (
                    <View style={st.offline}>
                      <Text style={st.openingBody}>{TUTOR_OFFLINE.body}</Text>
                      <OutlineButton label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry} disabled={checking} onPress={startFirst} />
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Made from the newest conversation, or the starter set for a learner
            with none. Gated on the model: null is a read that has not answered. */}
        {made !== null && (
          <View style={st.block}>
            {made.value === null ? (
              <View>
                <Label>{STARTER.label}</Label>
                <Card style={st.starterCard}>
                  <Label>{STARTER.moment.label}</Label>
                  <Text style={st.openingBody}>{STARTER.moment.lead}</Text>
                  <Text style={st.starterFr}>{starter.moment.tutorFr}</Text>
                  <Text style={st.openingBody}>{starter.moment.tutorEn}</Text>
                  <Text style={st.starterFr}>{starter.moment.fr}</Text>
                  <Text style={st.openingBody}>{starter.moment.en}</Text>
                  <View style={st.blockBody}>
                    <OutlineButton label={STARTER.moment.action} onPress={() => nav.navigate('Lesson')} />
                  </View>
                </Card>
                <Card style={st.starterCard}>
                  <Label>{STARTER.phrase.label}</Label>
                  <Text style={st.openingBody}>{STARTER.phrase.lead}</Text>
                  <Text style={st.starterFr}>{starter.phrase.fr}</Text>
                  <Text style={st.openingBody}>{starter.phrase.en}</Text>
                  <View style={st.blockBody}>
                    <OutlineButton label={MADE_FROM.phrase.hear} onPress={() => tutorVoice.speak(starter.phrase.fr)} />
                  </View>
                </Card>
                <TuneSoundCard sound={null} onCheck={() => {}} onChoose={() => nav.navigate('Missions')} />
              </View>
            ) : (
              <View>
                {made.value.replay !== null && (
                  <ReplayMomentCard
                    replay={made.value.replay}
                    onTry={() =>
                      nav.navigate('Drill', {
                        node: {
                          id: `replay:${made.value!.replay!.packId}`,
                          title: MADE_FROM.replay.label,
                          phraseKeys: [made.value!.replay!.key],
                          moment: { quote: made.value!.replay!.quote, better: made.value!.replay!.better, why: made.value!.replay!.why },
                        },
                      })
                    }
                  />
                )}
                {made.value.phrase !== null && (
                  <MakePhraseCard
                    phrase={made.value.phrase}
                    saving={saving}
                    onSay={() => revisit({ id: made.value!.phrase!.packId, title: made.value!.phrase!.from, phraseKeys: [made.value!.phrase!.key] })}
                    onHear={() => tutorVoice.speak(made.value!.phrase!.fr)}
                    onSave={() => keepPhrase(made.value!.phrase!)}
                  />
                )}
                <TuneSoundCard
                  sound={made.value.sound}
                  onCheck={(missionId) => nav.navigate('SoundCheck', { missionId })}
                  onChoose={() => nav.navigate('Missions')}
                />
              </View>
            )}
          </View>
        )}

        {archive !== null && archive.vault !== null && (
          <View style={st.block}>
            <Label>{ARCHIVE_LABEL}</Label>
            {archive.filters.length > 0 && (
              <View style={st.blockBody}>
                <SessionFilters filters={archive.filters} active={filter} onChange={setFilter} />
              </View>
            )}
            <View style={st.blockBody}>
              <VaultCard vault={archive.vault} />
            </View>
          </View>
        )}

        {shown.length > 0 && (
          <View style={st.block}>
            <View style={st.feedHead}>
              <View style={st.feedWords}>
                <Label color={paper.ink}>{FEED.label}</Label>
              </View>
              {archive?.order != null && <Text style={st.order}>{archive.order}</Text>}
            </View>
            <View style={st.feed}>
              {shown.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  onRevisit={() => revisit({ id: session.id, title: session.titleEn, phraseKeys: session.phraseKeys })}
                />
              ))}
            </View>
          </View>
        )}

        {/* What a learner with no conversations reads instead of an archive.
            Gated on the model rather than on the feed's length, so it cannot
            appear for half a second while storage is still answering. */}
        {archive?.opening != null && (
          <View style={st.block}>
            <Card>
              <Text style={st.openingTitle}>{archive.opening.title}</Text>
              <Text style={st.openingBody}>{archive.opening.body}</Text>
            </Card>
          </View>
        )}

        {scenario !== null && (
          <View style={st.block}>
            <Label>{SUGGESTION.label}</Label>
            <View style={st.blockBody}>
              <ScenarioCard
                scenario={scenario}
                checking={checking}
                onAnother={another}
                onDrill={archive?.canDrill === true ? () => nav.navigate('Drill', { mix: true }) : null}
                onTutor={() => talkAbout(scenario)}
              />
            </View>
          </View>
        )}

        <View style={st.closing}>
          <Text style={st.closingTitle}>{CLOSING.title}</Text>
          <Text style={st.closingBody}>{CLOSING.body}</Text>
        </View>
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  scroll: { flexGrow: 1 },
  block: { marginTop: space(7) },
  blockBody: { marginTop: space(3) },
  feedHead: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  feedWords: { flex: 1, minWidth: 0 },
  order: { ...type.small, color: paper.inkSoft },
  feed: { marginTop: space(3), gap: space(3) },
  stepSub: { ...type.small, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
  offline: { marginTop: space(3), gap: space(3) },
  openingTitle: { ...type.bodyStrong, color: paper.ink },
  openingBody: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  starterCard: { marginTop: space(3) },
  starterFr: { ...type.french, color: paper.ink, marginTop: space(2) },
  closing: { marginTop: space(7) },
  closingTitle: { ...type.bodyStrong, color: paper.ink },
  closingBody: { ...type.small, color: paper.inkSoft, marginTop: space(1) },
});
