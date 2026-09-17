/**
 * Your conversations — the archive, as a route (F574).
 *
 * The vault, the filter chips and the feed lived at the foot of Practice, under
 * three cards about what to do next, which is two jobs on one tab: Practice
 * asks "what now", and this asks "what happened". The revamp gives Practice the
 * first question alone and this screen the second. Settings' saved-conversation
 * row points here too, because the screen that lists them is also the screen
 * that deletes them.
 *
 * ## One list, and one door to the rest
 *
 * `practice/archive.ts` builds the feed out of the learner's conversation
 * packs, which is the same set `ConversationPackLibrary` lists. Drawing both
 * would be the same conversations twice on one page, so the feed is the list
 * and the library sits behind one door as the place a conversation is opened
 * whole, continued, or deleted. Its flow is passed through untouched rather
 * than copied: a second delete confirmation is how two of them come to disagree
 * about what a learner just agreed to.
 *
 * The door is a sub-view in place rather than a second route, so Android's
 * hardware back closes it instead of popping this screen out from under it
 * (F312).
 *
 * ## Nothing here decides anything
 *
 * Which filters exist, which sessions pass one, what each card says and what
 * the vault counts are all `practice/archive.ts` and `practice/sessionCard.ts`.
 * This screen's own four lines are in `conversationsView.ts`. What is left is a
 * frame, three null gates and a stylesheet.
 */

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { phraseKeyOf, type ConversationPack, type ReviewCard } from '@luvani/core';

import { Label } from '../components.tsx';
import { ChatGlyph } from '../glyphs.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { IconRowCard } from '../surface/IconRowCard.tsx';
import { accent, paper, space, type } from '../theme.ts';
import { useAuth } from '../auth/useAuth.tsx';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { loadDeck } from '../review/store.ts';
import { archiveFrom, sessionsUnder, FEED, type Archive, type FilterKey } from '../practice/archive.ts';
import { SessionFilters } from '../practice/SessionFilters.tsx';
import { SessionRow } from '../practice/SessionRow.tsx';
import { VaultCard } from '../practice/VaultCard.tsx';
import { ConversationPackLibrary } from './ConversationPackLibrary.tsx';
import {
  CONVERSATIONS_PURPOSE,
  CONVERSATIONS_TITLE,
  LIBRARY_LABEL,
  LIBRARY_LINE,
  libraryDoorLabel,
} from './conversationsView.ts';
import {
  deleteAllConversationPacksForLearner,
  deleteConversationPackForLearner,
  loadConversationPacks,
  refreshConversationPacks,
} from './store.ts';
import { loadPackMarks, withMarks, type PackMark } from './marks.ts';

export function ConversationsScreen({ onBack }: { onBack: () => void }) {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { user, adapter } = useAuth();

  // Null while storage has not answered, which is not the same as a learner
  // with nothing: a feed drawn from an unanswered read would show an empty
  // archive to somebody who has had thirty conversations.
  const [archive, setArchive] = useState<Archive | null>(null);
  const [packs, setPacks] = useState<readonly ConversationPack[]>([]);
  // Which filter the learner chose. `sessionsUnder` falls back to the whole
  // feed when the row stops earning its place, so this can stay put.
  const [filter, setFilter] = useState<FilterKey>('all');
  const [showingLibrary, setShowingLibrary] = useState(false);

  useHardwareBack(showingLibrary, () => setShowingLibrary(false));

  // Rebuilt on every return: a conversation that just finished has to be on
  // this feed the moment the learner lands back here.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const draw = (fetched: readonly ConversationPack[], deck: readonly ReviewCard[], marks: readonly PackMark[]) => {
        // This phone's marks folded in first, so the feed and the library
        // cannot disagree about a conversation that was already practised.
        const marked = withMarks(fetched, marks);
        setPacks(marked);
        setArchive(archiveFrom({ packs: marked, deck, now: Date.now() }));
      };
      void Promise.all([loadConversationPacks(), loadDeck(), loadPackMarks()])
        .then(([stored, deck, marks]) => {
          if (cancelled) return undefined;
          draw(stored, deck, marks);
          if (user === null) return undefined;
          // The cache first, then the server-owned truth. A closed app can miss
          // the original delivery, so this pull is the recovery path.
          return refreshConversationPacks(user, adapter).then((result) => {
            if (!cancelled && result.ok) draw(result.packs, deck, marks);
          });
        })
        .catch(() => {
          // Nothing to draw and nothing to say about a disk. The learner's
          // conversations are safe on their account either way.
        });
      return () => {
        cancelled = true;
      };
    }, [user, adapter]),
  );

  if (showingLibrary) {
    return (
      <ConversationPackLibrary
        packs={packs}
        onBack={() => setShowingLibrary(false)}
        onReview={(pack) =>
          nav.navigate('Drill', {
            node: {
              id: pack.id,
              title: pack.title.en,
              phraseKeys: pack.keyPhrases.map((phrase) => phraseKeyOf(phrase.fr)),
            },
          })
        }
        onContinue={(pack) =>
          nav.navigate('Convo', {
            seedTopic: { fr: pack.continuationSeed.titleFr, en: pack.continuationSeed.titleEn },
          })
        }
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

  const shown = archive === null ? [] : sessionsUnder(archive, filter);

  return (
    <ScrollScreen bottom="inset" header={<ScreenHeader back={{ onPress: onBack }} />}>
      <Text accessibilityRole="header" style={st.title}>
        {CONVERSATIONS_TITLE}
      </Text>
      <Text style={st.purpose}>{CONVERSATIONS_PURPOSE}</Text>

      {archive !== null && archive.filters.length > 0 && (
        <View style={st.block}>
          <SessionFilters filters={archive.filters} active={filter} onChange={setFilter} />
        </View>
      )}

      {archive !== null && archive.vault !== null && (
        <View style={st.block}>
          <VaultCard vault={archive.vault} />
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
                onRevisit={() =>
                  nav.navigate('Drill', {
                    node: { id: session.id, title: session.titleEn, phraseKeys: session.phraseKeys },
                  })
                }
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
          <Text style={st.openingTitle}>{archive.opening.title}</Text>
          <Text style={st.openingBody}>{archive.opening.body}</Text>
        </View>
      )}

      {packs.length > 0 && (
        <View style={st.block}>
          <IconRowCard
            glyph={<ChatGlyph color={accent.primary} />}
            label={LIBRARY_LABEL}
            line={LIBRARY_LINE}
            accessibilityLabel={libraryDoorLabel()}
            onPress={() => setShowingLibrary(true)}
          />
        </View>
      )}
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  title: { ...type.display, color: paper.ink, marginTop: space(2) },
  purpose: { ...type.body, color: paper.inkSoft, marginTop: space(2) },
  block: { marginTop: space(6) },
  feedHead: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  feedWords: { flex: 1, minWidth: 0 },
  order: { ...type.small, color: paper.inkSoft },
  feed: { marginTop: space(3), gap: space(3) },
  openingTitle: { ...type.title, color: paper.ink },
  openingBody: { ...type.body, color: paper.inkSoft, marginTop: space(2) },
});
