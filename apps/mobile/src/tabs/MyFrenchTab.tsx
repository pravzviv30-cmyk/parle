import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  DAILY_SCENARIOS,
  missionStates,
  phraseKeyOf,
  seedTopicOf,
  suggestedMission,
  type ConversationPack,
  type DailyScenario,
  type MissionProgress,
  type ReviewCard,
} from '@luvani/core';

import { Card, GhostButton, Label, OutlineButton, PillButton, Stat, TabBar } from '../components.tsx';
import { ScrollScreen, TabHeader } from '../layout.tsx';
import { paper, radius, signal, space, type, HAIRLINE, HIT } from '../theme.ts';
import { loadDeck } from '../review/store.ts';
import { loadTopics } from '../topics/store.ts';
import { loadActivity } from '../progress/activity.ts';
import { evidenceFrom, hasEvidence, type Evidence } from '../progress/evidence.ts';
import { NextSituationCard } from '../home/NextSituationCard.tsx';
import { SAVED_SITUATIONS_LABEL, SAVED_SITUATION_ACTION, hasSaved, savedSituations } from '../bookmarks/view.ts';
import { loadBookmarks } from '../bookmarks/store.ts';
import { buildPhrasebook, hasPhrases, type Phrasebook } from '../phrases/phrasebook.ts';
import { NEXT_SITUATION, startLabel } from '../progress/portfolio.ts';
import { PhrasebookScreen } from '../phrases/PhrasebookScreen.tsx';
import { loadMissionCompletions } from '../missions/store.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { loadSoundChecks } from '../soundcheck/store.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { trackProductEvent } from '../analytics/track.ts';
import { hasStory, storyFrom, type WeekStory } from '../progress/story.ts';
import { loadHistory } from '../progress/store.ts';
import { useAuth } from '../auth/useAuth.tsx';
import {
  deleteAllConversationPacksForLearner,
  deleteConversationPackForLearner,
  loadConversationPacks,
  refreshConversationPacks,
} from '../conversationPacks/store.ts';
import { latestReadyPack } from '../conversationPacks/model.ts';
import { ConversationPackLibrary } from '../conversationPacks/ConversationPackLibrary.tsx';
import { OPENING, hasMyFrench, myFrenchFrom, type MyFrench } from '../myfrench/model.ts';
import { LANES, LANES_LABEL, MY_FRENCH_PURPOSE, openingLane, showLanes, type Lane } from '../myfrench/lanes.ts';
import { primaryFor } from '../myfrench/primary.ts';
import { OneLineCard } from '../myfrench/OneLineCard.tsx';
import { LedgerLane } from '../myfrench/LedgerLane.tsx';
import { SituationsCard } from '../myfrench/SituationsCard.tsx';
import { AcousticCard } from '../myfrench/AcousticCard.tsx';
import { CadenceCard } from '../myfrench/CadenceCard.tsx';

/**
 * My French — the ledger of what has become the learner's.
 *
 * Practice is the archive of everything they have said: its unit is the
 * session, and its question is what happened and what to redo. This is the
 * other question, and it has a different unit. Its unit is the phrase, and it
 * asks which lines are theirs now and which one is closest to joining them.
 *
 * ## The page is the evidence ladder
 *
 * `review/evidence.ts` ranks a phrase by what the learner has shown they can do
 * with it, and this page is that ranking rendered as a layout rather than as a
 * bar. `introduced` is never drawn, because a card nobody has recalled is not
 * something they can say. `recalled` is not a list either: it is the single
 * card at the top that asks for one line right now. `used` and `transferred`
 * are the one list, headed by the phrase worth naming. That is what makes the
 * climb visible without a percentage, which `progress/passport.ts` refuses and
 * `phrases/phrasebook.ts` refuses again for a second reason.
 *
 * ## Two lanes, one spine
 *
 * The founder's segmented switch separates two readings of one body of
 * evidence: the Spoken Map is keyed by place, the Memory Deck by phrase. The
 * one line card and the chooser sit outside both, so the page keeps a spine
 * whichever lane is showing and the primary never vanishes under a toggle.
 *
 * ## This file decides nothing
 *
 * Every judgement is `myfrench/model.ts`'s, and everything that module composes
 * is owned somewhere else again. There is no renderer in this workspace, so a
 * ternary here is a rule no test can reach; that is why the sound line, which
 * used to be decided in this file, is now `myfrench/sounds.ts`.
 *
 * The week's story is the one thing still read here rather than through the
 * model, and deliberately: F233 holds `progress/story.ts` to exactly one
 * importer in the whole app, so that nothing scheduled or notified can carry a
 * learner's week anywhere. This screen is that importer.
 */
export function MyFrenchTab() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { user, adapter } = useAuth();
  const [deck, setDeck] = useState<readonly ReviewCard[]>([]);
  const [missions, setMissions] = useState<readonly MissionProgress[]>([]);
  const [checks, setChecks] = useState<readonly SoundCheckEvidence[]>([]);
  const [book, setBook] = useState<Phrasebook>({ groups: [], count: 0, topics: 0 });
  const [showingPhrases, setShowingPhrases] = useState(false);
  const [showingPacks, setShowingPacks] = useState(false);
  const [packs, setPacks] = useState<ConversationPack[]>([]);
  // Which lane is showing. Component state on purpose: it dies with the mount,
  // and nothing on the page claims it is remembered.
  const [lane, setLane] = useState<Lane | null>(null);
  // null is "not read yet", which draws the same as a quiet week and is not the
  // same claim. The empty story is story.ts's to make, not this screen's.
  const [story, setStory] = useState<WeekStory | null>(null);
  // The next situation to walk into, from core, exactly as Home reads it. This
  // screen draws it and never decides which one; null draws nothing.
  const [next, setNext] = useState<MissionProgress | null>(null);
  // The situations the learner bookmarked on Home, newest decision first.
  const [saved, setSaved] = useState<readonly DailyScenario[]>([]);
  // The three facts at the head of the Map lane, decided in progress/evidence.ts.
  const [evidence, setEvidence] = useState<Evidence>(() => evidenceFrom({ missions: [], book: { count: 0 }, activity: [] }));
  // Bumped after a grade, so the page re-reads the deck it just wrote to.
  const [graded, setGraded] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([
        loadMissionCompletions(),
        loadDeck(),
        loadTopics(),
        loadSoundChecks(),
        loadHistory(),
        loadActivity(),
        loadBookmarks(),
      ]).then(
        ([completions, cards, topics, soundChecks, history, activity, bookmarks]) => {
          if (cancelled) return;
          const now = Date.now();
          const nextMissions = missionStates(missionCompletionsFrom(completions), cards, now);
          const nextBook = buildPhrasebook(cards, topics, now);
          const nextEvidence = evidenceFrom({ missions: nextMissions, book: nextBook, activity });
          setDeck(cards);
          setMissions(nextMissions);
          setBook(nextBook);
          setChecks(soundChecks);
          setNext(suggestedMission(nextMissions));
          setEvidence(nextEvidence);
          setSaved(savedSituations(bookmarks, DAILY_SCENARIOS));
          // The whole history, unnarrowed. Which seven days count is story.ts's
          // decision and filtering here would walk straight past it.
          setStory(storyFrom(history, now));
          void trackProductEvent({
            name: 'my_french_opened',
            properties: { situationsDone: nextEvidence.situations, linesKept: nextEvidence.lines },
          });
        },
      );
      void loadConversationPacks().then((stored) => {
        if (!cancelled) setPacks(stored);
      });
      if (user) {
        void refreshConversationPacks(user, adapter).then((result) => {
          if (!cancelled && result.ok) setPacks(result.packs);
        });
      }
      return () => {
        cancelled = true;
      };
    }, [user, adapter, graded]),
  );

  if (showingPhrases) return <PhrasebookScreen book={book} onDone={() => setShowingPhrases(false)} />;
  if (showingPacks) {
    return (
      <ConversationPackLibrary
        packs={packs}
        onBack={() => setShowingPacks(false)}
        onReview={(pack) => nav.navigate('Drill', {
          node: { id: pack.id, title: pack.title.en, phraseKeys: pack.keyPhrases.map((phrase) => phraseKeyOf(phrase.fr)) },
        })}
        onContinue={(pack) => nav.navigate('Convo', {
          seedTopic: { fr: pack.continuationSeed.titleFr, en: pack.continuationSeed.titleEn },
        })}
        onDeleteOne={async (pack) => {
          if (!user) return { ok: false, message: 'Please sign in again before changing your Tutor history.' };
          const result = await deleteConversationPackForLearner(user, adapter, pack.id);
          if (result.ok) {
            setPacks(result.packs);
            return { ok: true };
          }
          return result;
        }}
        onDeleteAll={async () => {
          if (!user) return { ok: false, message: 'Please sign in again before changing your Tutor history.' };
          const result = await deleteAllConversationPacksForLearner(user, adapter);
          if (result.ok) {
            setPacks(result.packs);
            return { ok: true };
          }
          return result;
        }}
      />
    );
  }

  const model: MyFrench = myFrenchFrom({
    deck,
    missions,
    checks,
    evidence,
    book,
    saved,
    next,
    packs,
    now: Date.now(),
  });
  const primary = primaryFor(model);
  const lanes = showLanes(model);
  const showing: Lane = lane ?? openingLane(model);
  const onMap = !lanes || showing === 'map';
  const onDeck = !lanes || showing === 'deck';

  return (
    <ScrollScreen bottom="tab">
      <View style={st.scroll}>
        <TabHeader title="My French" purpose={MY_FRENCH_PURPOSE} />

        {/* The one card this visit deals, above the switch, so the thing worth
            doing is never behind a toggle. Absent entirely on an empty deck. */}
        {model.oneLine !== null && (
          <OneLineCard line={model.oneLine} onGraded={() => setGraded((n) => n + 1)} />
        )}

        {lanes && (
          <View style={st.lanes}>
            <TabBar tabs={LANES} active={showing} onChange={setLane} accessibilityLabel={LANES_LABEL} />
          </View>
        )}

        {/* Nothing is yours yet. One warm sentence and one door, drawn instead
            of a page of empty headings. */}
        {!hasMyFrench(model) && (
          <Card style={{ marginTop: space(6) }}>
            <Text style={[type.title, { color: paper.ink }]}>{OPENING.title}</Text>
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{OPENING.body}</Text>
            <View style={{ marginTop: space(4) }}>
              <OutlineButton label={OPENING.action} onPress={() => nav.navigate('Convo')} />
            </View>
          </Card>
        )}

        {onMap && (
          <View>
            {/* The evidence, first: situations handled, lines kept, the level.
                Each fact appears once it is real, and the row is absent until
                one is. evidence.ts decides all of it. */}
            {hasEvidence(model.evidence) && (
              <View style={st.evidence} accessibilityRole="summary">
                {model.evidence.stats.map((stat) => (
                  <Stat key={stat.label} value={stat.value} label={stat.label} columns={3} />
                ))}
              </View>
            )}

            {/* What the learner saved from Home, to come back to. Absent
                entirely when nothing is saved: a shelf that says it is empty
                says the learner failed to fill it. */}
            {hasSaved(model.saved) && (
              <Card style={{ marginTop: space(6) }}>
                <Label>{SAVED_SITUATIONS_LABEL}</Label>
                <View style={st.saved}>
                  {model.saved.map((situation) => (
                    <View key={situation.id} style={st.savedRow}>
                      <View style={st.words}>
                        <Text style={[type.bodyStrong, { color: paper.ink }]}>{situation.titleEn}</Text>
                      </View>
                      <GhostButton
                        label={SAVED_SITUATION_ACTION}
                        color={paper.ink}
                        accessibilityLabel={startLabel(situation.titleEn)}
                        onPress={() => nav.navigate('Convo', { seedTopic: seedTopicOf(situation) })}
                      />
                    </View>
                  ))}
                </View>
              </Card>
            )}

            {story !== null && hasStory(story) && (
              <View style={st.week} accessibilityRole="summary">
                <Label>Your week</Label>
                {story.sentences.map((sentence) => (
                  <Text key={sentence} style={[type.body, { color: paper.ink }]}>
                    {sentence}
                  </Text>
                ))}
              </View>
            )}

            <SituationsCard
              model={model}
              onOpen={(missionId, refine) =>
                refine
                  ? nav.navigate('SoundCheck', { missionId })
                  : (void trackProductEvent({
                      name: 'mission_started',
                      properties: { missionId, entry: 'my-french' },
                    }), nav.navigate('Convo', { missionId }))
              }
            />

            {model.acoustic !== null && <AcousticCard acoustic={model.acoustic} />}

            {primary?.kind === 'situation' && model.next !== null && (
              <View style={st.nextSituation}>
                {/* The same card Home draws, so the two tabs cannot part
                    company. Drawn only when the deck cannot deal a line, so a
                    first morning is never left without a primary. */}
                <NextSituationCard next={model.next}>
                  <PillButton
                    label={NEXT_SITUATION.action}
                    accessibilityLabel={startLabel(model.next.mission.titleEn)}
                    onPress={() => {
                      void trackProductEvent({
                        name: 'mission_started',
                        properties: { missionId: model.next!.mission.id, entry: 'my-french' },
                      });
                      nav.navigate('Convo', { missionId: model.next!.mission.id });
                    }}
                  />
                </NextSituationCard>
              </View>
            )}
          </View>
        )}

        {onDeck && (
          <View>
            <LedgerLane ledger={model.ledger} onOpenPhrases={() => setShowingPhrases(true)} />

            {hasPhrases(model.book) && (
              <Card style={{ marginTop: space(6) }}>
                <Label>Your notebook</Label>
                <Text style={[type.title, { color: paper.ink, marginTop: space(2) }]}>What you can say now</Text>
                <Text style={[type.body, { color: paper.inkSoft, marginTop: space(1) }]}>
                  {model.book.count} {model.book.count === 1 ? 'line' : 'lines'} from your own conversations and practice.
                </Text>
                <View style={{ marginTop: space(4) }}>
                  <OutlineButton label="Open my phrases" onPress={() => setShowingPhrases(true)} />
                </View>
              </Card>
            )}

            <CadenceCard cadence={model.cadence} />

            {model.packs.length > 0 && (
              <Card style={{ marginTop: space(6) }}>
                <Label>Your conversations</Label>
                <Text style={[type.title, { color: paper.ink, marginTop: space(2) }]}>
                  {latestReadyPack(model.packs)?.title.en ?? 'Your conversation is becoming practice'}
                </Text>
                <Text style={[type.body, { color: paper.inkSoft, marginTop: space(1) }]}>Return to a real situation, its phrases and its next step whenever you need it.</Text>
                <View style={{ marginTop: space(4) }}>
                  <OutlineButton label="Open conversation packs" onPress={() => setShowingPacks(true)} />
                </View>
              </Card>
            )}
          </View>
        )}

        {/* Always reachable, outside both lanes: a learner with no suggestion
            can still choose. The quiet door, not a second primary. */}
        <View style={{ marginTop: space(6) }}>
          <GhostButton
            label="Choose another situation"
            color={paper.ink}
            onPress={() => nav.navigate('Missions')}
          />
        </View>
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  scroll: { flexGrow: 1 },
  // The switch, lifted off the card above it.
  lanes: { marginTop: space(6) },
  // The next situation, closing the Map lane. A top margin to lift it off the
  // list; no bottom padding, because the frame owns the bottom edge (F340).
  nextSituation: { marginTop: space(7) },
  // A week's account, at the head of the page of stamps rather than under it.
  // Sentences, so they are set in ink at body size: 4.5 is the floor for
  // something a learner reads, and the softer inks are below it.
  week: { marginTop: space(7), gap: space(2) },
  // Three facts to a row, under the header. Absent entirely at zero.
  evidence: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space(2), columnGap: space(3), rowGap: space(4) },
  // One saved situation to a row, the whole row at the touch floor so the verb
  // beside it is reachable one handed.
  saved: { marginTop: space(2) },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: HIT },
  words: { flex: 1 },
});
