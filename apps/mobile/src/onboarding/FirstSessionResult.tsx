import { TimedExit } from '../motion/TimedExit.tsx';
import { useEffect, useRef, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { BoldButton as PillButton } from './BoldButton.tsx';
import { GhostButton } from '../components.tsx';
import { boldType as type, c } from './boldRhythm.ts';
import { BoldScene } from './motion/BoldScene.tsx';
import { decorative } from '../theme.ts';
import { useReduceMotion } from '../motion.ts';
import { celebrate } from '../motion/haptics.ts';
import { Burst } from '../motion/Burst.tsx';
import { OnboardingLayout } from './OnboardingLayout.tsx';
import { RevealItem } from './motion/OnboardingScenes.tsx';
import { firstLiveSummary, type FirstLiveRecord } from './firstLiveModel.ts';
import type { OnboardingProgressValue } from './onboardingProgress.ts';
import { guestScenePhrases } from '@luvani/core';

export function FirstSessionCelebration({ record, progress, onDone }: { record: FirstLiveRecord; progress: OnboardingProgressValue; onDone: () => void }) {
  const reduced = useReduceMotion();
  const { width, height } = useWindowDimensions();
  const called = useRef(false);
  const latest = useRef(onDone); latest.current = onDone;
  const haptic = useRef(false);
  const done = () => { if (!called.current) { called.current = true; latest.current(); } };
  useEffect(() => {
    if (!haptic.current && record.outcome === 'completed') { haptic.current = true; celebrate(); }
    if (record.outcome !== 'completed') { done(); return; }
  }, [record.outcome]);
  return <TimedExit style={{ flex: 1, backgroundColor: c.violet }} automatic={false} delayMs={1700} onDone={done}>
    <OnboardingLayout page="recap" ground={c.violet} progress={progress} footer={<PillButton tone="sun" label="See my achievements" onPress={done} />}>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <BoldScene kind="celebrate" width={Math.min(342, width - 48)} />
        <Text accessibilityRole="header" style={[type.celebration, { color: c.white, textAlign: 'center' }]}>Well done!</Text>
        <Text style={[type.celebrationSupport, { color: c.white, textAlign: 'center' }]}>You practised French.{'\n'}That’s a real step forward.</Text>
        <View style={{ width: '100%', marginTop: 8, backgroundColor: c.paper, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 16, gap: 6 }}>
          <Text style={[type.small, { color: c.muted, textAlign: 'center' }]}>Your first session</Text>
          <Text style={[type.heading, { color: c.ink, textAlign: 'center' }]}>{record.scene ? 'The café scene, done.' : 'A conversation completed.'}</Text>
          {record.scene ? guestScenePhrases(record.sceneTurns ?? []).map(line => <Text key={line.turnId} style={[type.body, { color: c.ink, textAlign: 'center' }]}>“{line.fr}”</Text>) : null}
        </View>
      </View>
    </OnboardingLayout>
    {!reduced && <View {...decorative} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <Burst seed={`first-session:${record.sessionId}`} origin={{ x: width / 2, y: height * 0.4 }} ground="blue" spread={150} power={[280, 550]} />
    </View>}
  </TimedExit>;
}
function Achievement({ text, index }: { text: string; index: number }) {
  const reduced = useReduceMotion(true);
  const [revealed, setRevealed] = useState(0);
  const revealStep = useRef(0);
  const words = text.split(' ');
  useEffect(() => {
    if (reduced === null) return;
    if (reduced || revealStep.current === 3) { revealStep.current = 3; setRevealed(3); return; }
    let alive = true;
    const timers = [1, 2, 3].filter(step => step > revealStep.current).map(step => setTimeout(() => {
      if (!alive) return;
      revealStep.current = Math.max(revealStep.current, step);
      setRevealed(revealStep.current);
    }, 100 + index * 140 + step * 70));
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, [reduced, index]);
  return <RevealItem index={index}>
    <View accessible accessibilityLabel={text} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8 }}>
      <Text {...decorative} style={[type.body, { color: c.violet }]}>✓</Text>
      <View style={{ flex: 1 }}>
        {/* Full text reserves layout and is the accessible content throughout. */}
        <Text {...decorative} style={[type.body, { color: c.ink, opacity: 0 }]}>{text}</Text>
        <Text {...decorative} style={[type.body, { color: c.ink, position: 'absolute', inset: 0 }]}>{reduced ? text : words.slice(0, Math.ceil(words.length * revealed / 3)).join(' ')}</Text>
      </View>
    </View>
  </RevealItem>;
}
/**
 * `onFinish` (founder decision 16, F925): after a guest leaves the café scene
 * early, "Save and finish the scene" comes first. It keeps the practice like
 * Save does, then the new account opens the café scene (firstPracticeEntry.ts).
 * "Save your progress" stays second with its own behaviour.
 */
export function FirstSessionSummary({ record, progress, onSave, onFinish, busy = false, issue = '' }: {
  record: FirstLiveRecord; progress: OnboardingProgressValue; onSave: () => void; onFinish?: () => void; busy?: boolean; issue?: string;
}) {
  const view = firstLiveSummary(record);
  const completed = record.outcome === 'completed';
  const foreground = completed ? c.white : c.ink;
  const finishable = !completed && record.scene !== undefined && onFinish !== undefined;
  const footer = <RevealItem index={2}><View style={{ gap: 4 }}>
    {finishable && <PillButton tone="brand" label={busy ? 'Saving…' : 'Save and finish the scene'} disabled={busy} onPress={onFinish} />}
    {finishable ? <GhostButton label={busy ? 'Saving…' : 'Save your progress'} disabled={busy} onPress={onSave} />
      : <PillButton tone={completed ? 'sun' : 'brand'} label={busy ? 'Saving…' : 'Save your progress'} disabled={busy} onPress={onSave} />}
  </View></RevealItem>;
  return <OnboardingLayout page="keep" ground={completed ? c.violet : c.paper} progress={progress} footer={footer}>
    <View style={{ gap: 14 }}>
      {completed && <Text style={[type.small, { color: c.white, textAlign: 'center', letterSpacing: 1.6 }]}>YOUR FIRST SESSION</Text>}
      <Text accessibilityRole="header" style={[completed ? type.achievement : type.title, { color: foreground, textAlign: 'center' }]}>{completed ? 'Look what\nyou can do.' : view.heading}</Text>
      <View style={{ alignItems: 'center' }}><BoldScene kind={completed ? 'summary' : 'pause'} width={192} /></View>
      <Text style={[type.body, { color: foreground, textAlign: 'center' }]}>{view.detail}</Text>
      {/* No confirmed reply, no box: the empty card read as missing content (F925). */}
      {view.achievements.length > 0 && <View style={{ backgroundColor: completed ? c.paper : c.lavender, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 18 }}>{view.achievements.map((text, index) => <Achievement key={text} text={text} index={index} />)}</View>}
      {view.achievements.length === 0 && <Text style={type.body}>Your plan and tutor are ready for your next practice.</Text>}
      <RevealItem index={3}><Text style={[type.label, { color: foreground, textAlign: 'center', marginTop: 8 }]}>{view.next}</Text></RevealItem>
      {!!issue && <Text accessibilityLiveRegion="polite" style={[type.body, { color: foreground }]}>{issue}</Text>}
    </View>
  </OnboardingLayout>;
}
