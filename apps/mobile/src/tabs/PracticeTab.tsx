/**
 * Practice — the archive of everything the learner has said.
 *
 * This tab used to draw an authored path: seven units of rows over the phrases
 * the bank could drill. The founder replaced it with their own mockup, and the
 * shape that arrived is better because it is the learner's, not ours. Every
 * conversation they finish becomes a card here with what it was called in both
 * languages, the topics it opened, how long they spoke and how many phrases it
 * left behind. The scripted café lesson and the drill bank did not disappear
 * with the path; the lesson is a door on the Tutor tab now, and the bank is
 * behind this tab's scenario card.
 *
 * The mockup is drawn full, and a learner on their first morning has none of
 * it. So the tab grows: no vault and no feed until there is a conversation, no
 * ordering line until there are two, no filters until four. Every one of those
 * decisions is in `practice/archive.ts` and none of them is here. This file is
 * null gates and a stylesheet, the same shape `home/MomentumCards.tsx` settled
 * on, because a screen that can count is a screen that can draw a nought.
 */

import { useCallback, useRef, useState } from 'react';
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
import { loadDeck } from '../review/store.ts';
import { loadActivity } from '../progress/activity.ts';
import { useLive } from '../app/LiveContext.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { loadConversationPacks, refreshConversationPacks } from '../conversationPacks/store.ts';
import { TUTOR_OFFLINE } from '../tutor/gate.ts';

export function PracticeTab() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { recheck } = useLive();
  const { user, adapter } = useAuth();

  // Null while storage has not answered yet, which is not the same as a learner
  // with nothing: an archive drawn from an unanswered read would flash the
  // first-conversation words at somebody who has had thirty.
  const [archive, setArchive] = useState<Archive | null>(null);
  // What to do now, answered whole by practice/nextStep.ts: a due deck, the
  // newest conversation nobody has come back to, or nothing at all.
  const [step, setStep] = useState<NextStep | null>(null);
  // Which filter the learner chose. Resets to nothing on purpose when the row
  // stops earning its place, since sessionsUnder falls back to the whole feed.
  const [filter, setFilter] = useState<FilterKey>('all');
  // The learner's own deal of the pool, and where they are in it.
  const [walk, setWalk] = useState<Walk | null>(null);
  // Which tier of the pool this learner is pitched at. The same rule the word
  // of the day already reads, so the two cannot disagree about how far somebody
  // has come. Null until the activity log answers.
  const [levelIndex, setLevelIndex] = useState<number | null>(null);
  // A probe is in flight. The one door here that touches the network runs one
  // before it navigates, and without the flag the tap does nothing visible for
  // up to a second and a half and a second tap queues a second navigation.
  const [checking, setChecking] = useState(false);
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

      const draw = (packs: readonly ConversationPack[], deck: readonly ReviewCard[]) => {
        setArchive(archiveFrom({ packs, deck, now }));
        setStep(nextStep(deck, packs, now));
      };

      // Draw the cache at once, then quietly replace it with the server-owned
      // truth. A closed app can miss the original live delivery, so this pull
      // is the recovery path rather than a decorative refresh.
      void Promise.all([loadConversationPacks(), loadDeck(), loadActivity()])
        .then(([packs, deck, activity]) => {
          if (cancelled()) return undefined;
          draw(packs, deck);
          setLevelIndex(levelFor(totalXp(activity)).index);

          if (user === null) return undefined;
          return refreshConversationPacks(user, adapter).then((result) => {
            if (!cancelled() && result.ok) draw(result.packs, deck);
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

  /** A drill is local. Nothing to probe, so nothing to wait for. */
  const revisit = (node: { id: string; title: string; phraseKeys: readonly string[] }) => {
    nav.navigate('Drill', { node: { id: node.id, title: node.title, phraseKeys: node.phraseKeys } });
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
          purpose="Everything you have said to your tutor, and what to do with it next."
        />

        {/* The one thing to do now, decided in practice/nextStep.ts and drawn
            here as the tab's only pill. When the deck is quiet and every
            conversation has been revisited there is no step, and this draws
            nothing rather than a cheerful message for a learner who is done. */}
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

        {step !== null && (
          <View style={st.block}>
            <Label>{NEXT_STEP.label}</Label>
            <View style={st.blockBody}>
              {step.kind === 'review' ? (
                <View>
                  <PillButton label={NEXT_STEP.review} onPress={() => nav.navigate('Review')} />
                  <Text style={st.stepSub}>{reviewLine(step.due)}</Text>
                </View>
              ) : (
                <View>
                  <PillButton
                    label={step.pack.title.en}
                    onPress={() => revisit({ id: step.pack.id, title: step.pack.title.en, phraseKeys: step.pack.keyPhrases.map((phrase) => phraseKeyOf(phrase.fr)) })}
                  />
                  <Text style={st.stepSub}>{packLine(step.pack)}</Text>
                </View>
              )}
            </View>
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
  openingTitle: { ...type.bodyStrong, color: paper.ink },
  openingBody: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  closing: { marginTop: space(7) },
  closingTitle: { ...type.bodyStrong, color: paper.ink },
  closingBody: { ...type.small, color: paper.inkSoft, marginTop: space(1) },
});
