import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { loadConversationPacks, refreshConversationPacks } from '../conversationPacks/store.ts';
import { loadDeck } from '../review/store.ts';
import { loadDrillBank } from '../drill/store.ts';
import { loadPracticeHistory } from '../practice/historyStore.ts';
import { loadPracticeSession } from '../practice/sessionStore.ts';
import { loadPackMarks, withMarks } from '../conversationPacks/marks.ts';
import { recoverPracticeCompletion } from '../practice/completion.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { useAuth } from '../auth/useAuth.tsx';
async function readLearning() {
  await recoverPracticeCompletion();
  const [packs, deck, bank, history, session, marks, completions] = await Promise.all([loadConversationPacks(), loadDeck(), loadDrillBank(), loadPracticeHistory(), loadPracticeSession(), loadPackMarks(), loadMissionCompletions()]);
  return { packs: withMarks(packs, marks), deck, bank, history, session, completions };
}
export type MainLearning = Awaited<ReturnType<typeof readLearning>>;
/** A focused read over the existing owners, never a second learning store. */
export function useMainLearning() {
  const { user, adapter } = useAuth(); const [revision, retry] = useState(0);
  const [state, setState] = useState<{ owner: number; data: MainLearning | null; failed: boolean }>({ owner: -1, data: null, failed: false });
  useFocusEffect(useCallback(() => {
    let live = true; const owner = scopeGeneration();
    setState(old => old.owner === owner ? { ...old, failed: false } : { owner, data: null, failed: false });
    void readLearning().then(async data => {
      if (!live || owner !== scopeGeneration()) return;
      setState({ owner, data, failed: false });
      if (!user) return;
      const refreshed = await refreshConversationPacks(user, adapter);
      if (!live || owner !== scopeGeneration() || !refreshed.ok) return;
      // Refresh banks review material and merges the bounded pack cache. Read
      // those owners again rather than keeping a stale deck or one page only.
      const refreshedData = await readLearning();
      if (live && owner === scopeGeneration()) setState({ owner, data: refreshedData, failed: false });
    }).catch(() => { if (live && owner === scopeGeneration()) setState(old => ({ ...old, owner, failed: true })); });
    return () => { live = false; };
  }, [revision, user?.id, adapter]));
  return { data: state.owner === scopeGeneration() ? state.data : null, failed: state.owner === scopeGeneration() && state.failed, reload: () => retry(n => n + 1) };
}
