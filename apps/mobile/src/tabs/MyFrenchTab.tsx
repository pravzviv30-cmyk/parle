import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  DAILY_SCENARIOS,
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
import { HeaderArt } from '../art/HeaderArt.tsx';
import { HEADER_ART } from '../art/maps.ts';
import { DocumentGlyph, PlaceGlyph, QuoteGlyph } from '../glyphs.tsx';
import { ScrollScreen, TabHeader } from '../layout.tsx';
import { accent, space } from '../theme.ts';
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
  CONVERSATIONS_ROW,
  CONVERSATIONS_SUB,
  MY_FRENCH_PURPOSE,
  MY_FRENCH_TITLE,
  SAVED_LABEL,
  SHELF_LABEL,
  SHELF_OPEN,
} from '../myfrench/copy.ts';
import { SituationsCard } from '../myfrench/SituationsCard.tsx';

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
 * ## This file decides nothing
 *
 * Every judgement is `myfrench/model.ts`'s, and everything that module composes
 * is owned somewhere else again. There is no renderer in this workspace, so a
 * ternary here is a rule no test can reach, and a sentence here is a sentence
 * no sweep can read; that is why the words are `myfrench/copy.ts`'s.
 *
 * The week's story used to be read here. It lives on Profile now (F561), and
 * F233 still holds `progress/story.ts` to exactly one importer in the whole
 * app; that importer is Profile's, and this screen reads no history at all.
 */
export function MyFrenchTab() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { user, adapter } = useAuth();
  const [deck, setDeck] = useState<readonly ReviewCard[]>([]);
  const [missions, setMissions] = useState<readonly MissionProgress[]>([]);
  const [packs, setPacks] = useState<ConversationPack[]>([]);
  // The situation core suggests next, from the same call Home makes. It leads
  // "Next places" and has no card of its own any more.
  const [suggested, setSuggested] = useState<MissionProgress | null>(null);
  // The situations the learner bookmarked on Home, newest decision first.
  const [saved, setSaved] = useState<readonly DailyScenario[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([
        loadMissionCompletions(),
        loadDeck(),
        loadTopics(),
        loadActivity(),
        loadBookmarks(),
      ]).then(
        ([completions, cards, topics, activity, bookmarks]) => {
          if (cancelled) return;
          const now = Date.now();
          const nextMissions = missionStates(missionCompletionsFrom(completions), cards, now);
          setDeck(cards);
          setMissions(nextMissions);
          setSuggested(suggestedMission(nextMissions));
          setSaved(savedSituations(bookmarks, DAILY_SCENARIOS));
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
    }, [user, adapter]),
  );

  const model: MyFrench = myFrenchFrom({ deck, missions, saved, packs, suggested, now: Date.now() });

  return (
    <ScrollScreen bottom="tab">
      {/* The art and the words share one positioned parent, so the picture can
          bleed off the top-right corner behind the headline. */}
      <View style={st.head}>
        <HeaderArt name={HEADER_ART.myfrench} />
        <TabHeader title={MY_FRENCH_TITLE} purpose={MY_FRENCH_PURPOSE} />
      </View>

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

      {/* One line of French, and the whole phrasebook behind it. The row
          always draws: on an empty deck the module's own sentence says what
          the shelf is for, which is a different thing from telling a learner
          they have kept nothing. */}
      <View style={st.block}>
        <IconRowCard
          glyph={<QuoteGlyph color={accent.primary} />}
          label={SHELF_LABEL}
          line={model.shelf}
          accessibilityLabel={SHELF_OPEN}
          onPress={() => nav.navigate('Phrasebook')}
        />
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

      {/* The conversations the tutor turned into practice. Drawn only when
          one exists, so a learner is never offered an empty library. */}
      {model.showConversations && (
        <View style={st.block}>
          <IconRowCard
            glyph={<DocumentGlyph color={accent.primary} />}
            label={CONVERSATIONS_ROW}
            line={CONVERSATIONS_SUB}
            accessibilityLabel={CONVERSATIONS_ROW}
            onPress={() => nav.navigate('Conversations')}
          />
        </View>
      )}
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
});
