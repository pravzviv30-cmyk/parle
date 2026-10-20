/**
 * Ported by path from ce1fa976 (Codex, 2026-10-19) for Phase B, B3 (2026-10-20).
 * The one reader behind the Practice tab: it adds the strict sound-check read
 * the old tab owned, so every store the tab drew is still recovered and read
 * here, under the same account fence.
 */
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { ConversationPack, DrillExercise, PracticeTopic, ReviewCard } from '@luvani/core';
import { useAuth } from '../auth/useAuth.tsx';
import { activeUserId, scopeGeneration } from '../storage/scope.ts';
import { loadConversationPacks, refreshConversationPacks, CONVERSATION_PAGE_SIZE, type UnavailablePack } from '../conversationPacks/store.ts';
import { loadDeck } from '../review/store.ts';
import { loadDrillBank } from '../drill/store.ts';
import { loadTopics } from '../topics/store.ts';
import { loadSoundChecks } from '../soundcheck/store.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { loadPackMarks, withMarks } from '../conversationPacks/marks.ts';
import { loadPracticeSession, type PracticeSessionRecord } from './sessionStore.ts';
import { recoverPracticeCompletion } from './completion.ts';
import { ownsPracticeRead, type PracticeReadOwner } from './readOwner.ts';
import { localConversationPage } from './library.ts';

export interface LibraryData {
  /** One finite server page. Search and filters deliberately describe this page. */
  page: readonly ConversationPack[];
  /** Bounded cache used only to attribute deck phrases and build the existing recommendation. */
  packs: readonly ConversationPack[];
  deck: readonly ReviewCard[];
  bank: readonly DrillExercise[];
  session: PracticeSessionRecord | null;
  topics: readonly PracticeTopic[];
  unavailable: readonly UnavailablePack[];
  /** Stored sound checks, read strictly so unreadable evidence is a failed read, not an empty history. */
  checks: readonly SoundCheckEvidence[];
}

/**
 * Read the existing stores, recover an interrupted completion, then reconcile
 * this page with the server. This hook owns no persistence and no scheduler.
 * Both drawing and taps must remain owned by the signed-in account.
 */
export function useLibraryData() {
  const { user, adapter } = useAuth();
  const [stored, setStored] = useState<{ owner: PracticeReadOwner; value: LibraryData } | null>(null);
  const [failure, setFailure] = useState<PracticeReadOwner | null>(null);
  const [pending, setPending] = useState<PracticeReadOwner | null>(null);
  const [remoteFailed, setRemoteFailed] = useState<PracticeReadOwner | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<{ owner: PracticeReadOwner; value: string | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const pageScope = useRef(scopeGeneration());
  const currentScope = scopeGeneration();
  const userId = user?.id ?? null;
  const current = (owner: PracticeReadOwner | null): boolean => ownsPracticeRead(owner, scopeGeneration(), userId, activeUserId());

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    const owner = { scope: scopeGeneration(), userId: user?.id ?? null };
    const isCurrent = () => !cancelled && ownsPracticeRead(owner, scopeGeneration(), owner.userId, activeUserId());
    if (pageScope.current !== owner.scope) {
      pageScope.current = owner.scope;
      setStored(null);
      if (cursor !== null) { setCursor(null); return () => { cancelled = true; }; }
    }
    setFailure(null);
    setRemoteFailed(null);
    setNextCursor(null);
    setPending(owner);
    if (cursor !== null) setStored(null);

    const read = () => Promise.all([loadConversationPacks(), loadDeck(), loadDrillBank(), loadPracticeSession(), loadPackMarks(), loadTopics(), loadSoundChecks({ strict: true })]);
    const draw = (values: Awaited<ReturnType<typeof read>>, page?: readonly ConversationPack[], unavailable: readonly UnavailablePack[] = []) => {
      if (!isCurrent()) return;
      const [packs, deck, bank, session, marks, topics, checks] = values;
      setStored({ owner, value: { page: withMarks(page ?? packs.slice(0, CONVERSATION_PAGE_SIZE), marks), packs: withMarks(packs, marks), deck, bank, session, topics, unavailable, checks } });
    };
    // A recovery that cannot finish is retried on the next read; it never
    // hides the learner's material (as the old Practice tab did).
    void recoverPracticeCompletion().catch(() => null).then(read).then(async values => {
      if (!isCurrent()) return;
      if (cursor === null) draw(values);
      if (!user || adapter.kind === 'mock') {
        const page = localConversationPage(values[0], cursor, CONVERSATION_PAGE_SIZE);
        draw(values, page.packs);
        setNextCursor({ owner, value: page.nextCursor });
        setPending(null);
        return;
      }
      const result = await refreshConversationPacks(user, adapter, fetch, cursor);
      if (!isCurrent()) return;
      if (result.ok) {
        // Refresh banks the page's exercises/phrases; read the real bank again
        // before offering practice, rather than navigate with a stale preview.
        const fresh = await read();
        if (!isCurrent()) return;
        draw(fresh, result.packs, result.unavailable);
        setNextCursor({ owner, value: result.nextCursor });
      } else {
        setRemoteFailed(owner);
        if (cursor !== null) setFailure(owner);
      }
      if (isCurrent()) setPending(null);
    }).catch(() => {
      if (!isCurrent()) return;
      setPending(null);
      setFailure(owner);
    });
    return () => { cancelled = true; };
  }, [user, adapter, cursor, attempt, currentScope]));

  const data = stored !== null && current(stored.owner) ? stored.value : null;
  return {
    data,
    loading: current(pending),
    failed: current(failure),
    cached: current(remoteFailed),
    olderPage: cursor !== null,
    nextCursor: nextCursor !== null && current(nextCursor.owner) ? nextCursor.value : null,
    ownsNow: () => stored !== null && current(stored.owner),
    retry: () => setAttempt(value => value + 1),
    older: () => { if (nextCursor !== null && current(nextCursor.owner) && nextCursor.value !== null) setCursor(nextCursor.value); },
    newest: () => setCursor(null),
  };
}
