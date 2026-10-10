import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DataBindMode, Fit, RiveView, useRiveFile, type RiveViewRef } from '@rive-app/react-native';
import { decorative } from '../theme.ts';
import { createFlamePreparation } from './flamePreparation.ts';
import { StreakFlameStill, useFlameActivity, type StreakFlameProps } from './StreakFlame.shared.tsx';

export { StreakFlameStill, type StreakFlameProps } from './StreakFlame.shared.tsx';
const FLAME_FILE = require('../../assets/rive/streak.riv');
const PREPARE_LIMIT_MS = 5000;

/** Script-free local Rive: prepare invisibly before the owner starts its entrance. */
export function StreakFlame(props: StreakFlameProps) {
  const { running, reduced } = useFlameActivity(props);
  const played = useRef(false);
  const celebrating = props.celebrating ?? false;
  const onStarted = useCallback(() => { played.current = true; }, []);
  useEffect(() => {
    if (reduced === true) {
      if (celebrating) played.current = true;
      props.onReady?.(false);
    }
  }, [reduced, celebrating, props.onReady]);
  return <View {...decorative} style={{ width: props.size, height: props.size, alignSelf: 'center', pointerEvents: 'none' }}>
    {running ? <NativeFlame size={props.size} playing={props.playing ?? true} ignition={celebrating && !played.current} onStarted={onStarted} onReady={props.onReady} /> : <StreakFlameStill size={props.size} />}
  </View>;
}

function NativeFlame({ size, playing, ignition, onStarted, onReady }: {
  size: number;
  playing: boolean;
  ignition: boolean;
  onStarted: () => void;
  onReady?: (canAnimate: boolean) => void;
}) {
  const { riveFile, error } = useRiveFile(FLAME_FILE);
  const [preparation] = useState(() => createFlamePreparation(ignition));
  const [machine, setMachine] = useState(preparation.machine);
  const ignitionNow = useRef(ignition);
  ignitionNow.current = ignition;
  const [viewRef, setViewRef] = useState<RiveViewRef | null>(null);
  const hybridRef = useCallback((ref: RiveViewRef | null) => setViewRef(ref), []);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const idleBeforeStart = useCallback(() => {
    if (!preparation.setIgnition(false)) return;
    // RiveView disposes its old ref without forwarding null to hybridRef.
    // Clear it in the same update as the key change; never await/play a stale ref.
    setViewRef(null);
    setReady(false);
    setMachine(preparation.machine);
  }, [preparation]);
  const fail = useCallback(() => {
    if (preparation.resolve(preparation.generation, false)) setFailed(true);
  }, [preparation]);
  useEffect(() => { if (error) fail(); }, [error, fail]);
  useEffect(() => {
    if (!ignition) idleBeforeStart();
  }, [ignition, idleBeforeStart]);

  useEffect(() => {
    if (!ready && !failed && !error) return;
    onReady?.(ready && !failed && !error);
  }, [ready, failed, error, onReady]);

  // Bounds the whole preparation, including a file hook that never produces
  // a view. The owner can settle immediately on false instead of staying blank.
  useEffect(() => {
    if (ready || failed || error) return;
    const token = preparation.generation;
    const timeout = setTimeout(() => {
      if (preparation.resolve(token, false)) setFailed(true);
    }, PREPARE_LIMIT_MS);
    return () => clearTimeout(timeout);
  }, [ready, failed, error, preparation, machine]);

  useEffect(() => {
    if (!viewRef) return;
    let live = true;
    const token = preparation.generation;
    void Promise.resolve().then(() => viewRef.awaitViewReady()).then(ok => {
      if (!live || !preparation.resolve(token, Boolean(ok))) return;
      if (!ok) { setFailed(true); return; }
      setReady(true);
    }).catch(() => { if (live && preparation.resolve(token, false)) setFailed(true); });
    return () => {
      live = false;
      void Promise.resolve().then(() => viewRef.pause()).catch(() => undefined);
    };
  }, [viewRef, preparation]);

  useEffect(() => {
    if (!viewRef || !ready || failed || error || !playing) return;
    if (machine === 'Celebrate' && !ignitionNow.current) { idleBeforeStart(); return; }
    let live = true;
    const playback = preparation.start(playing);
    if (!playback.allowed) return;
    if (playback.first) onStarted();
    const token = preparation.generation;
    // File/view readiness does not advance animation. Only the owner's shared
    // entrance start plays this same prepared state machine through to idle.
    void Promise.resolve().then(() => viewRef.play()).catch(() => { if (live && preparation.resolve(token, false)) setFailed(true); });
    return () => {
      live = false;
      void Promise.resolve().then(() => viewRef.pause()).catch(() => undefined);
    };
  }, [viewRef, ready, failed, error, playing, machine, idleBeforeStart, onStarted, preparation, fail]);

  const playerToken = preparation.generation;
  if (failed || error) return <StreakFlameStill size={size} />;
  return <>
    {!ready && <StreakFlameStill size={size} />}
    {riveFile && <RiveView key={machine} hybridRef={{ f: hybridRef }} file={riveFile} stateMachineName={machine} fit={Fit.Contain} dataBind={DataBindMode.None} autoPlay={false} frameRate={30} onError={() => { if (preparation.resolve(playerToken, false)) setFailed(true); }} style={[StyleSheet.absoluteFill, { opacity: ready ? 1 : 0 }]} />}
  </>;
}
