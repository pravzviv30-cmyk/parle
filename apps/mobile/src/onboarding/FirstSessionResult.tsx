import { TimedExit } from '../motion/TimedExit.tsx';
import { useEffect, useRef, useState } from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { BoldButton as PillButton } from './BoldButton.tsx';
import { boldType as type, c } from './boldRhythm.ts';
import { BoldScene } from './motion/BoldScene.tsx';
import { decorative, paper } from '../theme.ts';
import { useReduceMotion } from '../motion.ts';
import { celebrate } from '../motion/haptics.ts';
import { Burst } from '../motion/Burst.tsx';
import { OnboardingLayout } from './OnboardingLayout.tsx';
import { OnboardingScene, RevealItem } from './motion/OnboardingScenes.tsx';
import { firstLiveSummary, type FirstLiveRecord } from './firstLiveModel.ts';
import type { OnboardingProgressValue } from './onboardingProgress.ts';
import { useScreenReader } from '../celebrate/useScreenReader.ts';

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
  return <TimedExit style={{ flex: 1, backgroundColor: c.paper }} automatic={Platform.OS === 'web' || reader === false} delayMs={reduced ? 1000 : 1700} onDone={done}>
    <OnboardingLayout page="recap" progress={progress} footer={<PillButton label="See my achievements" onPress={done} />}>
      <View style={{ alignItems: 'center', gap: 24 }}>
        <BoldScene kind="celebrate" width={240} />
        <Text accessibilityRole="header" style={[type.title, { textAlign: 'center' }]}>Well done!</Text>
        <Text style={[type.heading, { textAlign: 'center' }]}>You completed your first session.</Text>
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
  return <OnboardingLayout page="keep" progress={progress} footer={<RevealItem index={2}><PillButton label={busy ? 'Saving…' : 'Save your progress'} disabled={busy} onPress={onSave} /></RevealItem>}>
    <View style={{ gap: 18 }}>
      <View style={{ alignItems: 'center' }}><BoldScene kind={record.outcome === 'completed' ? 'summary' : 'pause'} width={200} /></View>
      <Text accessibilityRole="header" style={[type.title, { textAlign: 'center' }]}>{view.heading}</Text>
      <Text style={[type.body, { textAlign: 'center' }]}>{view.detail}</Text>
      <View>{view.achievements.map((text, index) => <Achievement key={text} text={text} index={index} />)}</View>
      {view.achievements.length === 0 && <Text style={type.body}>There are no confirmed replies to summarise yet. Your chosen plan and tutor are ready for your next practice.</Text>}
      <RevealItem index={3}><Text style={[type.body, { textAlign: 'center', marginTop: 12 }]}>{view.next}</Text></RevealItem>
      {!!issue && <Text accessibilityLiveRegion="polite" style={type.body}>{issue}</Text>}
    </View>
  </OnboardingLayout>;
}
