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
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { type ConversationPack, type ReviewCard } from '@luvani/core';

import { Card, GhostButton, Label, Ledger, LedgerRow, OutlineButton } from '../components.tsx';
import { ChatGlyph } from '../glyphs.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
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
import { useContinueArc } from '../purchases/useContinueArc.ts';
import { activeUserId, scopeGeneration } from '../storage/scope.ts';
import { MY_FRENCH_RETRY } from '../myfrench/copy.ts';

/** The archive could not be read. Said as itself, never as an empty archive. */
export const CONVERSATIONS_UNREAD = 'Your conversations could not be loaded just now. They are all still saved.';

export function ConversationsScreen({
  onBack,
  openPackId,
}: {
  onBack: () => void;
  /** Open straight onto this saved conversation, when it is here. */
  openPackId?: string;
}) {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { user, adapter } = useAuth();

  // Null while storage has not answered, which is not the same as a learner
  // with nothing: a feed drawn from an unanswered read would show an empty
  // archive to somebody who has had thirty conversations.
  const [archive, setArchive] = useState<Archive | null>(null);
  const [archiveOwner, setArchiveOwner] = useState<number | null>(null);
  const [archiveUserId, setArchiveUserId] = useState<string | null>(null);
  // Loading, read and unreadable are three facts. A failed read shows Retry
  // rather than an archive that looks empty; `attempt` re-runs the read.
  const [unread, setUnread] = useState(false);
  const [unreadOwner, setUnreadOwner] = useState<number | null>(null);
  const [unreadUserId, setUnreadUserId] = useState<string | null>(null);
  const [remotePending, setRemotePending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [packs, setPacks] = useState<readonly ConversationPack[]>([]);
  // Which filter the learner chose. `sessionsUnder` falls back to the whole
  // feed when the row stops earning its place, so this can stay put.
  const [filter, setFilter] = useState<FilterKey>('all');
  // A direct link from My French opens the library on its conversation.
  const [showingLibrary, setShowingLibrary] = useState(openPackId !== undefined);
  const continueArc = useContinueArc();
  const currentOwner = scopeGeneration();
  const currentUserId = user?.id ?? null;
  const archiveIsOwned = archiveOwner === currentOwner && archiveUserId === currentUserId && archiveUserId === activeUserId();
  const visibleArchive = archiveIsOwned ? archive : null;
  const visiblePacks = archiveIsOwned ? packs : [];
  const visibleUnread = unread && unreadOwner === currentOwner && unreadUserId === currentUserId && unreadUserId === activeUserId();

  useHardwareBack(showingLibrary && archiveIsOwned, () => setShowingLibrary(false));

  // Rebuilt on every return: a conversation that just finished has to be on
  // this feed the moment the learner lands back here.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // Bound to the account before the read: a result from a previous account
      // is dropped, never drawn for this one.
      const scope = scopeGeneration();
      const sameAccount = (): boolean => !cancelled && scopeGeneration() === scope && (user?.id ?? null) === activeUserId();
      setRemotePending(user !== null);
      const draw = (fetched: readonly ConversationPack[], deck: readonly ReviewCard[], marks: readonly PackMark[]) => {
        // This phone's marks folded in first, so the feed and the library
        // cannot disagree about a conversation that was already practised.
        const marked = withMarks(fetched, marks);
        setPacks(marked);
        setArchive(archiveFrom({ packs: marked, deck, now: Date.now() }));
        setArchiveOwner(scope);
        setArchiveUserId(user?.id ?? null);
        setUnread(false);
      };
      void Promise.all([loadConversationPacks(), loadDeck(), loadPackMarks()])
        .then(([stored, deck, marks]) => {
          if (!sameAccount()) return undefined;
          draw(stored, deck, marks);
          if (user === null) { setRemotePending(false); return undefined; }
          // The cache first, then the server-owned truth. A closed app can miss
          // the original delivery, so this pull is the recovery path.
          return refreshConversationPacks(user, adapter).then((result) => {
            if (sameAccount()) setRemotePending(false);
            if (sameAccount() && result.ok) draw(result.packs, deck, marks);
            else if (sameAccount() && stored.length === 0) { setUnreadOwner(scope); setUnreadUserId(user?.id ?? null); setUnread(true); setShowingLibrary(false); }
          });
        })
        .catch(() => {
          // The learner's conversations are safe on their account either way,
          // but a failed read is not an empty archive. Say so and offer Retry,
          // unless this same account already has an archive on screen.
          if (sameAccount()) { setRemotePending(false); setUnreadOwner(scope); setUnreadUserId(user?.id ?? null); setUnread(true); setShowingLibrary(false); }
        });
      return () => {
        cancelled = true;
      };
    }, [user, adapter, attempt]),
  );

  if (showingLibrary && !visibleUnread && visibleArchive !== null && (!remotePending || visiblePacks.length > 0)) {
    return (
      <ConversationPackLibrary
        packs={visiblePacks}
        initialPackId={openPackId}
        onBack={() => setShowingLibrary(false)}
        onReview={(pack) => nav.navigate('ConversationPractice', { packId: pack.id })}
        // The tutor revisit is offered only when the plan opens it, by the
        // same continueArc rule the Tutor tab reads. Otherwise the library
        // draws no door, and the learner still has Review phrases, which is
        // module practice and costs no minutes.
        onContinue={
          continueArc === true
            ? (pack) =>
                nav.navigate('Convo', {
                  seedTopic: { fr: pack.continuationSeed.titleFr, en: pack.continuationSeed.titleEn },
                  continuationPackId: pack.id,
                })
            : undefined
        }
        onDeleteOne={async (pack) => {
          if (!user) return { ok: false, message: 'Please sign in again before changing your Tutor history.' };
          const result = await deleteConversationPackForLearner(user, adapter, pack.id);
          if (currentOwner !== scopeGeneration() || currentUserId !== activeUserId()) return { ok: false, message: 'Account changed. Reopen your conversations.' };
          if (result.ok) {
            setPacks(result.packs);
            return { ok: true };
          }
          return result;
        }}
        onDeleteAll={async () => {
          if (!user) return { ok: false, message: 'Please sign in again before changing your Tutor history.' };
          const result = await deleteAllConversationPacksForLearner(user, adapter);
          if (currentOwner !== scopeGeneration() || currentUserId !== activeUserId()) return { ok: false, message: 'Account changed. Reopen your conversations.' };
          if (result.ok) {
            setPacks(result.packs);
            return { ok: true };
          }
          return result;
        }}
      />
    );
  }

  const shown = visibleArchive === null ? [] : sessionsUnder(visibleArchive, filter);

  return (
    <ScrollScreen bottom="inset" header={<ScreenHeader back={{ onPress: onBack }} />}>
      <Text accessibilityRole="header" style={st.title}>
        {CONVERSATIONS_TITLE}
      </Text>
      <Text style={st.purpose}>{CONVERSATIONS_PURPOSE}</Text>
      {adapter.kind === 'supabase' && <GhostButton label="Saved conversation text" onPress={() => nav.navigate('SavedConversationText')} />}

      {(visibleArchive === null || remotePending && visiblePacks.length === 0) && !visibleUnread && (
        <View style={st.block}>
          <ActivityIndicator color={paper.inkSoft} accessibilityLabel="Loading your conversations" />
        </View>
      )}

      {visibleUnread && visiblePacks.length === 0 && (
        <Card style={st.block}>
          <Text style={[type.body, { color: paper.ink }]}>{CONVERSATIONS_UNREAD}</Text>
          <View style={{ marginTop: space(3) }}>
            <OutlineButton
              label={MY_FRENCH_RETRY}
              onPress={() => {
                setUnread(false);
                setAttempt((n) => n + 1);
              }}
            />
          </View>
        </Card>
      )}

      {visibleArchive !== null && visibleArchive.filters.length > 0 && (
        <View style={st.block}>
          <SessionFilters filters={visibleArchive.filters} active={filter} onChange={setFilter} />
        </View>
      )}

      {visibleArchive !== null && visibleArchive.vault !== null && (
        <View style={st.block}>
          <VaultCard vault={visibleArchive.vault} />
        </View>
      )}

      {shown.length > 0 && (
        <View style={st.block}>
          <View style={st.feedHead}>
            <View style={st.feedWords}>
              <Label color={paper.ink}>{FEED.label}</Label>
            </View>
            {visibleArchive?.order != null && <Text style={st.order}>{visibleArchive.order}</Text>}
          </View>
          <View style={st.feed}>
            {shown.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                onRevisit={() => nav.navigate('ConversationPractice', { packId: session.id })}
              />
            ))}
          </View>
        </View>
      )}

      {/* What a learner with no conversations reads instead of an archive.
          Gated on the model rather than on the feed's length, so it cannot
          appear for half a second while storage is still answering. */}
      {!visibleUnread && !remotePending && visibleArchive?.opening != null && (
        <View style={st.block}>
          <Text style={st.openingTitle}>{visibleArchive.opening.title}</Text>
          <Text style={st.openingBody}>{visibleArchive.opening.body}</Text>
        </View>
      )}

      {visiblePacks.length > 0 && (
        <View style={st.block}>
          <Ledger>
            <LedgerRow
              glyph={<ChatGlyph color={accent.primary} />}
              label={LIBRARY_LABEL}
              title={LIBRARY_LINE}
              accessibilityLabel={libraryDoorLabel()}
              onPress={() => setShowingLibrary(true)}
            />
          </Ledger>
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
