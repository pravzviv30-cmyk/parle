import { TimedExit } from '../motion/TimedExit.tsx';
import { useEffect, useRef, useState } from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { PillButton } from '../components.tsx';
import { colour, decorative, paper, type } from '../theme.ts';
import { useReduceMotion } from '../motion.ts';
import { celebrate } from '../motion/haptics.ts';
import { Burst } from '../motion/Burst.tsx';
import { OnboardingLayout } from './OnboardingLayout.tsx';
import { OnboardingScene, RevealItem } from './motion/OnboardingScenes.tsx';
import { firstLiveSummary, type FirstLiveRecord } from './firstLiveModel.ts';
import type { OnboardingProgressValue } from './onboardingProgress.ts';
import { useScreenReader } from '../celebrate/useScreenReader.ts';
import { C2 } from './c2Presentation.ts';
import { C2Scene } from './motion/C2Scene.tsx';
import { C2Action } from './C2Action.tsx';

export function FirstSessionCelebration({ record, progress, onDone }: { record: FirstLiveRecord; progress: OnboardingProgressValue; onDone: () => void }) {
  const reduced = useReduceMotion();
  const reader = useScreenReader();
  const { width, height } = useWindowDimensions();
  const called = useRef(false);
  const latest = useRef(onDone); latest.current = onDone;
  const haptic = useRef(false);
  const done = () => { if (!called.current) { called.current = true; latest.current(); } };
  useEffect(() => {
    if (!haptic.current && record.outcome === 'completed') { haptic.current = true; celebrate(); }
    if (record.outcome !== 'completed') { done(); return; }
  }, [record.outcome]);
  return <TimedExit style={{ flex: 1, backgroundColor: C2.violet }} automatic={Platform.OS === 'web' || reader === false} delayMs={reduced ? 1000 : 2600} onDone={done}>
    <OnboardingLayout page="recap" progress={progress} ground={C2.violet} footer={<C2Action label="See my achievements" gold onPress={done} />}>
      <View style={{ alignItems: 'center', gap: 24 }}>
        <C2Scene kind="celebration" width={Math.min(342, width - 48)} />
        <Text accessibilityRole="header" style={[type.display, { color: C2.white, textAlign: 'center' }]}>Well done!</Text>
        <Text style={[type.heading, { color: C2.white, textAlign: 'center' }]}>You completed your first session.</Text>
      </View>
    </OnboardingLayout>
    {!reduced && <View {...decorative} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <Burst seed={`first-session:${record.sessionId}`} origin={{ x: width / 2, y: height * 0.4 }} spread={150} power={[280, 550]} />
    </View>}
  </TimedExit>;
}
function Achievement({ text, index }: { text: string; index: number }) {
  const reduced = useReduceMotion();
  const [revealed, setRevealed] = useState(0);
  const words = text.split(' ');
  useEffect(() => {
    if (reduced) { setRevealed(3); return; }
    const timers = [1, 2, 3].map(step => setTimeout(() => setRevealed(step), 100 + index * 140 + step * 70));
    return () => timers.forEach(clearTimeout);
  }, [reduced, index]);
  return <RevealItem index={index}>
    <View accessible accessibilityLabel={text} style={{ flexDirection: 'row', gap: 14, paddingVertical: 18, borderBottomWidth: 1, borderColor: paper.groundDeep }}>
      <Text {...decorative} style={type.heading}>✓</Text>
      <View style={{ flex: 1 }}>
        {/* Full text reserves layout and is the accessible content throughout. */}
        <Text {...decorative} style={[type.bodyStrong, { opacity: 0 }]}>{text}</Text>
        <Text {...decorative} style={[type.bodyStrong, { position: 'absolute', inset: 0 }]}>{reduced ? text : words.slice(0, Math.ceil(words.length * revealed / 3)).join(' ')}</Text>
      </View>
    </View>
  </RevealItem>;
}
export function FirstSessionSummary({ record, progress, onSave, busy = false, issue = '' }: {
  record: FirstLiveRecord; progress: OnboardingProgressValue; onSave: () => void; busy?: boolean; issue?: string;
}) {
  const view = firstLiveSummary(record);
  return <OnboardingLayout page="keep" progress={progress} ground={C2.violet} footer={<RevealItem index={2}><C2Action label={busy ? 'Saving…' : 'Save your progress'} gold disabled={busy} onPress={onSave} /></RevealItem>}>
    <View style={{ gap: 18 }}>
      <Text accessibilityRole="header" style={[type.display, { color: C2.white, textAlign: 'center' }]}>{view.heading}</Text>
      <View style={{ alignItems: 'center' }}><C2Scene kind={record.outcome === 'completed' ? 'proud' : 'confidence'} width={192} /></View>
      <Text style={[type.body, { color: C2.white, textAlign: 'center' }]}>{view.detail}</Text>
      {view.achievements.length > 0 && <View style={{ backgroundColor: C2.reading, borderRadius: 24, padding: 18 }}>{view.achievements.map((text, index) => <Achievement key={text} text={text} index={index} />)}</View>}
      {view.achievements.length === 0 && <Text style={[type.body, { color: C2.white }]}>There are no confirmed replies to summarise yet. Your chosen plan and tutor are ready for your next practice.</Text>}
      <RevealItem index={3}><Text style={[type.body, { color: C2.white, textAlign: 'center', marginTop: 12 }]}>{view.next}</Text></RevealItem>
      {!!issue && <Text accessibilityLiveRegion="polite" style={[type.body, { color: C2.white }]}>{issue}</Text>}
    </View>
  </OnboardingLayout>;
}
