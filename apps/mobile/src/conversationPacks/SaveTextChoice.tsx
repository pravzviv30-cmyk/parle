import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { ConversationText } from '@luvani/core';
import { useAuth } from '../auth/useAuth.tsx';
import { IconAction, GhostButton } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { saveText } from './textClient.ts';

export function SaveTextChoice({ ownerId, conversation }: { ownerId: string; conversation: ConversationText | null }) {
  const { user, adapter } = useAuth();
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  const scope = useRef(scopeGeneration()).current;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  if (user?.id !== ownerId || adapter.kind !== 'supabase' || scope !== scopeGeneration()) return null;
  if (!conversation?.lines.length) return <Text style={[type.small, { color: paper.inkSoft }]}>The complete conversation text is not available to save. Your curated practice stays available.</Text>;
  const save = () => {
    if (busy.current || state === 'saved') return;
    busy.current = true;
    setState('saving');
    setMessage(null);
    void saveText(user, adapter, conversation).then(result => {
      if (!alive.current || scope !== scopeGeneration()) return;
      setState(result.ok ? 'saved' : 'idle');
      setMessage(result.ok ? 'Conversation text saved. Read or delete it in Progress, Your conversations.' : result.message);
    }).finally(() => { busy.current = false; });
  };
  return <View style={{ gap: space(2) }}>
    <Text style={[type.bodyStrong, { color: paper.ink }]}>Keep the conversation text?</Text>
    <Text style={[type.small, { color: paper.inkSoft }]}>Save the conversation and tutor coaching to your account. Speech recognition can differ from what you said. No recording is saved. You can delete this text separately from your practice.</Text>
    {state !== 'saved' && <IconAction layout="inline" icon="download" label={state === 'saving' ? 'Saving conversation text…' : 'Save conversation text'} disabled={state === 'saving'} onPress={save} />}
    {message !== '' && message != null && <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.inkSoft }]}>{message}</Text>}
  </View>;
}
