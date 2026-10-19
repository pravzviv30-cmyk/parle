import { useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Field } from '../components.tsx';
import { type } from '../theme.ts';
import { activeUserId, scopeGeneration } from '../storage/scope.ts';
import { OnboardingLayout } from './OnboardingLayout.tsx';
import { C2 } from './c2Presentation.ts';
import { C2Action } from './C2Action.tsx';
import { C2Scene } from './motion/C2Scene.tsx';
import { firstNameFrom, MAX_FIRST_NAME_CHARS } from './preAccountDraft.ts';
import { saveAccountName } from './accountName.ts';
import type { OnboardingProgressValue } from './onboardingProgress.ts';

/** The verified account owns the save; the typed name stays available on failure. */
export function AccountName({ progress, onSave }: { progress: OnboardingProgressValue; onSave: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState('');
  const alive = useRef(true);
  const operation = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const save = async () => {
    if (operation.current) return;
    const owner = scopeGeneration();
    const uid = activeUserId();
    const current = () => alive.current && owner === scopeGeneration() && uid === activeUserId();
    operation.current = true;
    setBusy(true); setIssue('');
    const result = await saveAccountName(name, onSave, current);
    if (!current()) return;
    operation.current = false;
    setBusy(false);
    if (result === 'invalid') setIssue('Enter the name you would like us to use.');
    else if (result === 'failed') setIssue('Your name could not be saved. Try again.');
  };
  return <OnboardingLayout page="account-name" progress={progress} ground={C2.reflection} avoidKeyboard
    footer={<C2Action label={busy ? 'Saving…' : 'Continue'} disabled={busy || firstNameFrom(name) === null} onPress={() => void save()} />}>
    <View style={{ gap: 20, paddingTop: 20 }}>
      <Text accessibilityRole="header" style={[type.title, { color: C2.ink, textAlign: 'center' }]}>What should we call you?</Text>
      <Text style={[type.body, { color: C2.muted, textAlign: 'center' }]}>Make yourself at home. You can change this later.</Text>
      <C2Scene kind="proud" width={210} active={!busy} />
      <View pointerEvents={busy ? 'none' : 'auto'}>
        <Field label="Your name" placeholder="e.g. Alex" value={name} error={issue || null}
          onChangeText={value => { if (!operation.current) { setName(value); setIssue(''); } }}
          autoCapitalize="words" autoComplete="given-name" maxLength={MAX_FIRST_NAME_CHARS}
          autoFocus={Platform.OS === 'web'} returnKeyType="done" onSubmitEditing={() => void save()} />
      </View>
    </View>
  </OnboardingLayout>;
}
