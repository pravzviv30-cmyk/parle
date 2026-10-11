import { SceneActivity } from './SceneActivity.ts';
import { useCallback, useContext, useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { DataBindMode, Fit, RiveView, useRiveFile, type RiveViewRef } from '@rive-app/react-native';
import { decorative } from '../../theme.ts';
import { useReduceMotion } from '../../motion.ts';
import { BoldStill as SceneStill, type BoldSceneProps as RiveSceneProps } from './BoldStill.tsx';
import { BOLD_FILES as FILES } from './boldSceneFiles.ts';

/** Re-keying the player makes a new scene independent of the previous scene's lifecycle. */
export function BoldScene(props: RiveSceneProps) {
  return <ScenePlayback key={props.kind} {...props} active={props.active ?? true} />;
}

/** Local continuous artwork stops off-screen and with reduced motion. */
function ScenePlayback(props: RiveSceneProps) {
  const visible = useContext(SceneActivity);
  const reduced = useReduceMotion(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  const { kind, width: size, active } = props;
  return (
    <View {...decorative} style={{ width: size, height: size * (kind.startsWith('orb-') ? 1 : 320 / 350), maxWidth: '100%', alignSelf: 'center', pointerEvents: 'none' }}>
      {reduced !== false || !foreground || !active || !visible ? <SceneStill kind={kind} width={size} /> : <NativeScene {...props} />}
    </View>
  );
}

function NativeScene({ kind, width: size }: RiveSceneProps) {
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
      if (live) { setReady(true); }
    }).catch(() => { if (live) setFailed(true); }).finally(() => { if (timeout) clearTimeout(timeout); });
    return () => {
      live = false;
      if (timeout) clearTimeout(timeout);
      void Promise.resolve().then(() => viewRef.pause()).catch(() => undefined);
    };
  }, [viewRef]);
  if (failed || error) return <SceneStill kind={kind} width={size} />;
  return <>
    {!ready && <SceneStill kind={kind} width={size} />}
    {/* Shape/timeline-only assets have no view model; never probe for one. */}
    {riveFile && <RiveView hybridRef={{ f: hybridRef }} file={riveFile} fit={Fit.Contain} dataBind={DataBindMode.None} autoPlay={false} frameRate={60} onError={() => setFailed(true)} style={[StyleSheet.absoluteFill, { opacity: ready ? 1 : 0 }]} />}
  </>;
}
