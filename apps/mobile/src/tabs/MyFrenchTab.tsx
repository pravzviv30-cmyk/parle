import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  DAILY_SCENARIOS,
  MISSIONS,
  missionStates,
  seedTopicOf,
  suggestedMission,
  type ConversationPack,
  type DailyScenario,
  type MissionProgress,
  type ReviewCard,
} from '@luvani/core';

import { Label, TintRow } from '../components.tsx';
import { IconRowCard } from '../surface/IconRowCard.tsx';
import { ChatGlyph, DocumentGlyph, PlaceGlyph, QuoteGlyph, WaveformGlyph } from '../glyphs.tsx';
import { ScrollScreen, TabHeader } from '../layout.tsx';
import { ProfileButton } from '../profile/ProfileButton.tsx';
import { accent, paper, space, type } from '../theme.ts';
import { loadDeck } from '../review/store.ts';
import { loadTopics } from '../topics/store.ts';
import { loadActivity } from '../progress/activity.ts';
import { evidenceFrom } from '../progress/evidence.ts';
import { savedSituations } from '../bookmarks/view.ts';
import { loadBookmarks } from '../bookmarks/store.ts';
import { buildPhrasebook } from '../phrases/phrasebook.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { trackProductEvent } from '../analytics/track.ts';
import { useAuth } from '../auth/useAuth.tsx';
import { loadConversationPacks, refreshConversationPacks } from '../conversationPacks/store.ts';
import { myFrenchFrom, type MyFrench } from '../myfrench/model.ts';
import {
  BROWSE_LABEL,
  BROWSE_LINE,
  BROWSE_OPEN,
  COLLECTION_LABEL,
  CONVERSATIONS_ROW,
  CONVERSATIONS_SUB,
  DAILY_LABEL,
  DAILY_LINE,
  DAILY_OPEN,
  GOALS_ROW_LABEL,
  RECENT_ALL,
  MY_FRENCH_RETRY,
  MY_FRENCH_UNREAD,
  MY_FRENCH_PURPOSE,
  MY_FRENCH_TITLE,
  SAVED_LABEL,
  SHELF_LABEL,
  SHELF_OPEN,
} from '../myfrench/copy.ts';
import { SituationsCard } from '../myfrench/SituationsCard.tsx';
import { allConversations, progressStatement, recentConversations, type HistoryItem } from '../myfrench/recentConversations.ts';
import { loadPracticeHistory } from '../practice/historyStore.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { legacyMarkItems } from '../practice/history.ts';
import { loadPackMarks } from '../conversationPacks/marks.ts';
import { loadSoundChecks } from '../soundcheck/store.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { SOUND_FINGERPRINT_LABEL, soundFingerprint } from '../myfrench/sounds.ts';
import { soundDoorLabel, soundJourney } from '../soundcheck/journey.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { goalRouteKey, goalRows } from '../goals/rows.ts';
import { GOALS_LABEL } from '../profile/tutorMemory.ts';

/**
 * My French — the record of what has become the learner's.
 *
 * Practice is the archive of everything they have said: its unit is the
 * session, and its question is what happened and what to redo. This is the
 * other question, and it has a different unit. Its unit is the place, and it
 * asks where this learner's French already works and which place is next.
 *
 * ## One page of rows
 *
 * Revamp A took the lanes out. The tab used to be a segmented switch over two
 * readings of one body of evidence, a card that dealt a line, a rail of counts,
 * a sound panel and a card at the foot with a pill on it. All of it was true
 * and most of it was one tap from somewhere better: the phrases moved to the
 * Phrasebook, the sound to the sound check, and the suggestion folded into the
 * first row under "Next places" rather than being drawn twice.
 *
 * What is left is the founder's mockup: the places, the shelf, the scenes the
 * learner saved and the conversations they can go back to. There is no primary
 * pill on this page at all, and that is the point of it. Nothing here is a
 * task. Every row is a door, and a learner who opens none of them has still
 * read something true about themselves.
 *
 * Whole-app phase 2 set the order: the tab's own name and one plain line; one
 * evidence-backed progress sentence; Your conversations (up to three, then one
 * See all); Your collection (the phrase shelf and the daily collection, in the
 * first useful scroll); the saved scenes and a measured sound when there are
 * any; French you can use and at most two places to try next; and one door
 * into every situation, which lives in Missions.
 *
 * ## This file decides nothing
 *
 * Every judgement is `myfrench/model.ts`'s, and everything that module composes
 * is owned somewhere else again. There is no renderer in this workspace, so a
 * ternary here is a rule no test can reach, and a sentence here is a sentence
 * no sweep can read; that is why the words are `myfrench/copy.ts`'s.
 *
 * The week's story used to be read here. It lives on Progress now (F561), and
 * F233 still holds `progress/story.ts` to exactly one importer in the whole
 * app; that importer is Progress's, and this screen reads none of it. What it
 * does read is the conversation-practice history (`practice/historyStore.ts`),
 * a different store of source-linked facts, and only to say what happened with
 * each recent saved conversation.
 */
export function MyFrenchTab() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { user, adapter } = useAuth();
  // The goals the learner wrote, read from the live profile (Stage 4).
  const { profile } = useProfile();
  const [deck, setDeck] = useState<readonly ReviewCard[]>([]);
  const [missions, setMissions] = useState<readonly MissionProgress[]>([]);
  const [packs, setPacks] = useState<ConversationPack[]>([]);
  // The situation core suggests next, from the same call Home makes. It leads
  // "Next places" and has no card of its own any more.
  const [suggested, setSuggested] = useState<MissionProgress | null>(null);
  // The situations the learner bookmarked on Home, newest decision first.
  const [saved, setSaved] = useState<readonly DailyScenario[]>([]);
  // Pronunciation can appear here only after a known-reference attempt was
  // assessed. The pure projection below rejects self-guided and unavailable
  // attempts, so an empty list and an unmeasured list both draw no row.
  const [checks, setChecks] = useState<readonly SoundCheckEvidence[]>([]);
  // What was recorded about the saved conversations: the synced practice
  // events, and this phone's old pack marks as reader-only labels. Empty until
  // read, which draws each recent row with its phrases and no outcome.
  const [history, setHistory] = useState<readonly HistoryItem[]>([]);
  // Whether the page's own read has answered. 'loading' and 'unread' are
  // facts of their own: neither may be drawn as an empty account. A retry
  // bumps `attempt`, which re-runs the focus read.
  const [status, setStatus] = useState<'loading' | 'ready' | 'unread'>('loading');
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // Bound to the account before any read, so a result from the previous
      // account is dropped rather than drawn for this one.
      const scope = scopeGeneration();
      const sameAccount = (): boolean => !cancelled && scopeGeneration() === scope;
      void Promise.all([
        loadMissionCompletions(),
        loadDeck(),
        loadTopics(),
        loadActivity(),
        loadBookmarks(),
        loadSoundChecks(),
      ]).then(
        ([completions, cards, topics, activity, bookmarks, soundChecks]) => {
          if (!sameAccount()) return;
          const now = Date.now();
          const nextMissions = missionStates(missionCompletionsFrom(completions), cards, now);
          setDeck(cards);
          setMissions(nextMissions);
          setSuggested(suggestedMission(nextMissions));
          setSaved(savedSituations(bookmarks, DAILY_SCENARIOS));
          setChecks(soundChecks);
          setStatus('ready');
          // The two numbers the product event has always carried, still counted
          // by evidence.ts and still never drawn: F348 took the rail of counts
          // off this page, and nothing here puts a digit back in front of a
          // learner.
          const nextEvidence = evidenceFrom({ missions: nextMissions, book: buildPhrasebook(cards, topics, now), activity });
          void trackProductEvent({
            name: 'my_french_opened',
            properties: { situationsDone: nextEvidence.situations, linesKept: nextEvidence.lines },
          });
        },
        () => {
          // A read that failed says so. What was already drawn for this same
          // account stays; only a first read with nothing to show becomes the
          // retry card.
          if (sameAccount()) setStatus((current) => (current === 'ready' ? 'ready' : 'unread'));
        },
      );
      // The recent rows are made from these packs, so they are held to the
      // same account binding.
      void loadConversationPacks().then((stored) => {
        if (sameAccount()) setPacks(stored);
      });
      // A history that cannot be read says nothing rather than something false.
      void Promise.all([loadPracticeHistory(), loadPackMarks()])
        .then(([events, marks]) => {
          if (cancelled) return;
          setHistory(sameAccount() ? [...events, ...legacyMarkItems(marks)] : []);
        })
        .catch(() => {
          if (!cancelled) setHistory([]);
        });
      if (user) {
        void refreshConversationPacks(user, adapter).then((result) => {
          if (sameAccount() && result.ok) setPacks(result.packs);
        });
      }
      return () => {
        cancelled = true;
      };
    }, [user, adapter, attempt]),
  );

  const model: MyFrench = myFrenchFrom({ deck, missions, saved, packs, suggested, now: Date.now() });
  const fingerprint = soundFingerprint(checks);
  // Once more than one measured check has called a sound out, the same row
  // opens the focused sound journey (Stage 4). Below that bar it is the door it
  // always was.
  const journey = soundJourney(checks, Date.now());
  // The recent saved conversations and the one progress sentence, from the
  // recorded history only, filtered against the pack cache this screen holds so
  // a deleted conversation is never brought back by its history.
  const recent = recentConversations({ packs, events: history });
  // The sentence reads every ready conversation, not only the rows drawn.
  const progress = progressStatement(allConversations({ packs, events: history }));
  // One row per goal, and the next task for it (Stage 4). Empty with no goals.
  const goals = goalRows(profile.learnerGoals, MISSIONS);

  return (
    <ScrollScreen bottom="tab">
      {/* The art and the words share one positioned parent, so the picture can
          bleed off the top-right corner behind the headline. */}
      <View style={st.head}>
        <TabHeader title={MY_FRENCH_TITLE} purpose={MY_FRENCH_PURPOSE} trailing={<ProfileButton />} />
      </View>

      {/* A failed read is a row like every other door on this page, not a
          button: the page is a record and asks for nothing. */}
      {status === 'unread' && (
        <View style={st.block}>
          <IconRowCard
            glyph={<DocumentGlyph color={accent.primary} />}
            label={MY_FRENCH_RETRY}
            line={MY_FRENCH_UNREAD}
            accessibilityLabel={`${MY_FRENCH_UNREAD} ${MY_FRENCH_RETRY}`}
            onPress={() => {
              setStatus('loading');
              setAttempt((n) => n + 1);
            }}
          />
        </View>
      )}

      {/* One concrete sentence of progress, only when completed practice
          recorded something. Nothing is drawn rather than a placeholder. */}
      {progress !== null && <Text style={st.progress}>{progress}</Text>}

      {/* Your conversations: up to three recent rows, each opening its own
          saved conversation, then one See all into the whole library. The
          group is drawn only once a conversation exists, so a learner is never
          offered an empty library. The title, the French preview and the
          outcome are three facts on three lines, and the row names all three
          to a screen reader in the model's words. */}
      {model.showConversations && (
        <View style={st.group}>
          <Label>{CONVERSATIONS_ROW}</Label>
          {recent.map((row) => (
            <IconRowCard
              key={row.pack.id}
              glyph={<DocumentGlyph color={accent.primary} />}
              label={row.pack.title.en}
              line={row.preview.join(' · ')}
              note={row.line}
              accessibilityLabel={row.accessibilityLabel}
              onPress={() => nav.navigate('Conversations', { packId: row.pack.id })}
            />
          ))}
          {/* The library door carries the conversation mark, not the saved-
              conversation document, so it never reads as one more saved row. */}
          <IconRowCard
            glyph={<ChatGlyph color={accent.primary} />}
            label={RECENT_ALL}
            line={CONVERSATIONS_SUB}
            accessibilityLabel={RECENT_ALL}
            onPress={() => nav.navigate('Conversations')}
          />
        </View>
      )}

      {/* Your collection, in the first useful scroll rather than under every
          situation: the phrases earned from conversations, then the daily
          items the learner saved. Two rows because they are two different
          kinds of saved French. The shelf always draws: on an empty deck the
          module's own sentence says what the shelf is for, which is a
          different thing from telling a learner they have kept nothing. */}
      <View style={st.group}>
        <Label>{COLLECTION_LABEL}</Label>
        <IconRowCard
          glyph={<QuoteGlyph color={accent.primary} />}
          label={SHELF_LABEL}
          line={model.shelf}
          accessibilityLabel={SHELF_OPEN}
          onPress={() => nav.navigate('Phrasebook')}
        />
        <IconRowCard glyph={<QuoteGlyph color={accent.primary} />} label={DAILY_LABEL} line={DAILY_LINE} accessibilityLabel={DAILY_OPEN} onPress={() => nav.navigate('DailyLibrary')} />
      </View>

      {/* What the learner saved from Home, to come back to. Absent entirely
          when nothing is saved: a shelf that says it is empty says the
          learner failed to fill it. */}
      {model.showSaved && (
        <View style={st.group}>
          <Label>{SAVED_LABEL}</Label>
          {model.saved.map((row) => (
            <TintRow
              key={row.scenario.id}
              tint={row.tint}
              glyph={<PlaceGlyph place={row.place} color={accent.primary} />}
              title={row.scenario.titleFr}
              gloss={row.scenario.titleEn}
              accessibilityLabel={row.accessibilityLabel}
              onPress={() => nav.navigate('Convo', { seedTopic: seedTopicOf(row.scenario) })}
            />
          ))}
        </View>
      )}

      {/* A small door back to pronunciation, and only after the assessor has
          returned real evidence. The sentence is the stored, timeless view of
          that check; the detailed acoustic guidance remains on Sound Check. */}
      {fingerprint !== null && (
        <View style={st.block}>
          <IconRowCard
            glyph={<WaveformGlyph color={accent.primary} />}
            label={SOUND_FINGERPRINT_LABEL}
            line={fingerprint.line}
            accessibilityLabel={soundDoorLabel(journey)}
            onPress={() => (journey !== null ? nav.navigate('SoundJourney') : nav.navigate('SoundCheck', { missionId: fingerprint.missionId }))}
          />
        </View>
      )}

      {/* The learner's own goals (Stage 4), just before the places to try:
          one row card each, the goal in their words and the next task under
          it, opening the goal screen. Nothing at all when there is no goal. */}
      {/* Under their own heading, in the goal editor's words, so the cards do
          not read as part of the collection above them. */}
      {goals.length > 0 && (
        <View style={st.group}>
          <Label>{GOALS_LABEL}</Label>
          {goals.map((row) => (
            <IconRowCard key={row.goal} glyph={<DocumentGlyph color={accent.primary} />} label={GOALS_ROW_LABEL} line={row.goal} note={row.line} accessibilityLabel={row.spoken} onPress={() => nav.navigate('GoalStep', { key: goalRouteKey(row.goal) })} />
          ))}
        </View>
      )}

      {/* French you can use, then at most two places to try next. The page's
          one block gap keeps the places off the rows above them;
          SituationsCard spaces only its inside. */}
      <View style={st.block}>
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
      </View>

      {/* Every situation, in any order, lives in Missions. One door. */}
      <View style={st.block}>
        <IconRowCard
          glyph={<DocumentGlyph color={accent.primary} />}
          label={BROWSE_LABEL}
          line={BROWSE_LINE}
          accessibilityLabel={BROWSE_OPEN}
          onPress={() => nav.navigate('Missions')}
        />
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  // Nothing wraps the page. F383 lost this whole tab at the largest reading
  // size because every block sat inside one `flexGrow: 1` view, which the
  // scroll frame already is: the blocks are the scroll's own children now, and
  // each one carries the mockup's single gap itself.
  head: { position: 'relative' },
  block: { marginTop: space(4) },
  // A heading and its rows, one gap apart, lifted off the block above.
  group: { marginTop: space(4), gap: space(4) },
  progress: { ...type.body, color: paper.ink, marginTop: space(3) },
});
