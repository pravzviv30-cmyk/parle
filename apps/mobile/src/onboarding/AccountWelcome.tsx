import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { BoldButton } from './BoldButton.tsx';
import { boldType as type, c } from './boldRhythm.ts';
import { C2BrandLockup } from './C2Visuals.tsx';
import { OnboardingLayout } from './OnboardingLayout.tsx';
import { onboardingProgress, type OnboardingProgressValue } from './onboardingProgress.ts';

/** Durable account handoff precedes this welcome; Continue is deliberate. */
export function AccountWelcome({ onDone, progress = onboardingProgress({ page: 'account-welcome' }) }: { onDone: () => void | Promise<void>; progress?: OnboardingProgressValue }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const completed = useRef(false);
  const finish = async () => {
    if (completed.current) return;
    completed.current = true;
    setBusy(true);
    setError('');
    try { await onDone(); }
    catch { completed.current = false; setError('Your welcome could not be saved. Tap Continue to retry.'); }
    finally { setBusy(false); }
  };
  return <OnboardingLayout page="account-welcome" ground={c.violet} hideProgress center progress={{ ...progress, fraction: 1, complete: true }}
    footer={<BoldButton tone="sun" label="Continue" state={busy ? 'busy' : 'idle'} disabled={busy} onPress={() => void finish()} />}>
    <View style={{ alignItems: 'center', gap: 22, paddingBottom: 80 }}>
      <Text accessibilityRole="header" accessibilityLabel="Welcome to Luvani" style={[type.title, { color: c.white, textAlign: 'center' }]}>Welcome to</Text>
      <C2BrandLockup width={270} animated />
      {!!error && <Text accessibilityRole="alert" style={[type.small, { color: c.white, textAlign: 'center' }]}>{error}</Text>}
    </View>
  </OnboardingLayout>;
}
