import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { decorative } from '../../theme.ts';
import { IllustrationLayer, IllustrationMotion } from '../../motion/IllustrationLayer.tsx';
import sceneData from '../../../assets/onboarding-art/scenes.json';

export type C2SceneKind = keyof typeof sceneData;
type Layer = typeof sceneData.confidence.layers[number];

/** The approved C2 SVG layers, at their authored geometry. Only the wrappers move. */
export function C2Scene({ kind, width, active = true, eventKey }: {
  kind: C2SceneKind; width?: number; active?: boolean; eventKey?: string | number;
}) {
  const scene = sceneData[kind];
  const renderedWidth = width ?? scene.width;
  const scale = renderedWidth / scene.width;
  const groups = [...new Set(scene.layers.map(layer => layer.group))];
  const art = (layer: Layer, index: number) => <View key={layer.id} style={{
    position: 'absolute', left: layer.x, top: layer.y, width: layer.width, height: layer.height,
    transformOrigin: '0px 0px', transform: [{ rotate: `${layer.angle}deg` }], overflow: 'visible',
  }}>
    <IllustrationLayer role={layer.role as 'gesture' | 'face' | 'still'} active={active} eventKey={eventKey} index={index}
      origin={[layer.width / 2, layer.height / 2]} style={{ width: layer.width, height: layer.height }}>
      <SvgXml {...decorative} xml={layer.xml} width={layer.assetWidth} height={layer.assetHeight}
        style={{ position: 'absolute', left: layer.padX, top: layer.padY }} />
    </IllustrationLayer>
  </View>;
  return <IllustrationMotion active={active} eventKey={eventKey}><View {...decorative} pointerEvents="none" style={{ width: renderedWidth, height: scene.height * scale, alignSelf: 'center', overflow: 'visible' }}>
    <View style={{ width: scene.width, height: scene.height, transformOrigin: '0px 0px', transform: [{ scale }], overflow: 'visible' }}>
      {groups.map((group, index) => <IllustrationLayer key={group} role={group === 'cloud' || group === 'orange' ? 'body' : group === 'shadow' || group === 'halo' ? 'still' : 'prop'}
        active={active} eventKey={eventKey} index={index} origin={[scene.width / 2, scene.height / 2]}
        style={{ position: 'absolute', width: scene.width, height: scene.height }}>
        {scene.layers.filter(layer => layer.group === group).map(art)}
      </IllustrationLayer>)}
    </View>
  </View></IllustrationMotion>;
}
