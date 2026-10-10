import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { DataBindMode, Fit, RiveView, useRiveFile, type RiveViewRef } from '@rive-app/react-native';
import { decorative } from '../../theme.ts';
import { useReduceMotion } from '../../motion.ts';
import { SceneStill, type RiveSceneProps } from './SceneStill.tsx';

const FILES = {
  welcome: require('../../../assets/rive/welcome.riv'),
  level: require('../../../assets/rive/level.riv'),
  plan: require('../../../assets/rive/plan.riv'),
  account: require('../../../assets/rive/account.riv'),
} as const;
const SINGLE_SHOT = new Set<RiveSceneProps['kind']>(['plan', 'account']);
const BURST_MS = 2400;

/** Re-keying the player makes a new scene independent of the previous scene's lifecycle. */
export function RiveSceneRenderer(props: RiveSceneProps) {
  return <ScenePlayback key={props.kind} {...props} />;
}

/** Rive is native and local; a one-shot never replays after an app/background interruption. */
function ScenePlayback(props: RiveSceneProps) {
  const reduced = useReduceMotion();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [retired, setRetired] = useState(false);
  const started = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleShot = SINGLE_SHOT.has(props.kind);
  const onStarted = useCallback(() => {
    if (started.current) return;
    started.current = true;
    if (singleShot) timer.current = setTimeout(() => { timer.current = null; setRetired(true); }, BURST_MS);
  }, [singleShot]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
      if (state !== 'active' && singleShot && started.current) setRetired(true);
    });
    return () => { subscription.remove(); if (timer.current) clearTimeout(timer.current); };
  }, [singleShot]);
  useEffect(() => {
    if (singleShot && started.current && (reduced || !props.active)) setRetired(true);
  }, [singleShot, reduced, props.active]);
  useEffect(() => {
    if (retired && timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, [retired]);
  const { kind, size, active } = props;
  return (
    <View {...decorative} style={{ width: size, height: size, maxWidth: '100%', alignSelf: 'center', pointerEvents: 'none' }}>
      {reduced || !foreground || !active || retired ? <SceneStill kind={kind} size={size} /> : <NativeScene {...props} onStarted={onStarted} />}
    </View>
  );
}

function NativeScene({ kind, size, onStarted }: RiveSceneProps & { onStarted: () => void }) {
  const { riveFile, error } = useRiveFile(FILES[kind]);
  const [viewRef, setViewRef] = useState<RiveViewRef | null>(null);
  const hybridRef = useCallback((ref: RiveViewRef | null) => setViewRef(ref), []);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!viewRef) return;
    let live = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const boundedReady = Promise.race([
      Promise.resolve().then(() => viewRef.awaitViewReady()),
      new Promise<boolean>(resolve => { timeout = setTimeout(() => resolve(false), 5000); }),
    ]);
    void boundedReady.then(async ok => {
      if (!live) return;
      if (!ok) { setFailed(true); return; }
      await viewRef.play();
      if (live) { setReady(true); onStarted(); }
    }).catch(() => { if (live) setFailed(true); }).finally(() => { if (timeout) clearTimeout(timeout); });
    return () => {
      live = false;
      if (timeout) clearTimeout(timeout);
      void Promise.resolve().then(() => viewRef.pause()).catch(() => undefined);
    };
  }, [viewRef, onStarted]);
  if (failed || error) return <SceneStill kind={kind} size={size} />;
  return <>
    {!ready && <SceneStill kind={kind} size={size} />}
    {/* Shape/timeline-only assets have no view model; never probe for one. */}
    {riveFile && <RiveView hybridRef={{ f: hybridRef }} file={riveFile} fit={Fit.Contain} dataBind={DataBindMode.None} autoPlay={false} frameRate={30} onError={() => setFailed(true)} style={[StyleSheet.absoluteFill, { opacity: ready ? 1 : 0 }]} />}
  </>;
}
