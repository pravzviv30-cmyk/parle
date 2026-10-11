import { SceneActivity } from './SceneActivity.ts';
import { useContext, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { Asset } from 'expo-asset';
import { useRive, Layout, Fit, Alignment, RuntimeLoader } from '@rive-app/react-webgl2';
import { decorative } from '../../theme.ts';
import { useReduceMotion } from '../../motion.ts';
import { BOLD_FILES } from './boldSceneFiles.ts';
import { BoldStill, type BoldSceneProps } from './BoldStill.tsx';

RuntimeLoader.setWasmUrl(Asset.fromModule(require('../../../assets/bold-rhythm/rive.wasm')).uri);
RuntimeLoader.setWasmFallbackUrl(Asset.fromModule(require('../../../assets/bold-rhythm/rive_fallback.wasm')).uri);

export function BoldScene(props: BoldSceneProps) {
  return <Scene key={props.kind} {...props} />;
}
function Scene({ kind, width, active = true }: BoldSceneProps) {
  const visible = useContext(SceneActivity);
  const reduced = useReduceMotion(true);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);
  return <View {...decorative} style={{ width, maxWidth: '100%', aspectRatio: kind.startsWith('orb-') ? 1 : 350 / 320, alignSelf: 'center', overflow: 'hidden', pointerEvents: 'none' }}>
    {reduced !== false || !foreground || !active || !visible ? <BoldStill kind={kind} width={width} /> : <Playback kind={kind} width={width} />}
  </View>;
}
function Playback({ kind, width }: BoldSceneProps) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const { RiveComponent } = useRive({ src: Asset.fromModule(BOLD_FILES[kind]).uri,
    stateMachine: 'Scene', autoplay: true, layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    onLoad: () => setReady(true), onLoadError: () => setFailed(true) });
  return <>
    {(!ready || failed) && <BoldStill kind={kind} width={width} />}
    {!failed && <RiveComponent style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: ready ? 1 : 0 }} />}
  </>;
}
