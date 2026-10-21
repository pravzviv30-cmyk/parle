import { useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { decorative } from '../theme.ts';
import { IllustrationLayer, IllustrationMotion } from '../motion/IllustrationLayer.tsx';
import { illustrationScale, ILLUSTRATION_VIEWBOX } from '../motion/IllustrationPolicy.ts';
import { mainArtLayers, type MainArtLayer, type MainIllustrationMotif, type IllustrationTheme } from './MainIllustrationArt.ts';

export type { MainIllustrationMotif, IllustrationTheme } from './MainIllustrationArt.ts';
export interface MainIllustrationProps {
  motif: MainIllustrationMotif;
  theme?: IllustrationTheme;
  width?: number;
  active?: boolean;
  eventKey?: string | number;
  style?: StyleProp<ViewStyle>;
}

/** Original M2/M3 art, responsive in the approved 320:200 proportions. */
export function MainIllustration({ motif, theme = 'light', width = 320, active = true, eventKey, style }: MainIllustrationProps) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : ILLUSTRATION_VIEWBOX.width;
  const [measuredWidth, setMeasuredWidth] = useState(safeWidth);
  const layers = useMemo(() => mainArtLayers(motif, theme), [motif, theme]);
  const scale = illustrationScale(measuredWidth);
  const cueKey = `${motif}:${eventKey ?? 'entrance'}`;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={event => setMeasuredWidth(event.nativeEvent.layout.width)}
      style={[styles.canvas, { width: safeWidth }, style]}
    >
      <IllustrationMotion active={active} eventKey={cueKey}>
        {layers.map((layer, index) => (
          <Layer key={layer.id} layer={layer} index={index} active={active} eventKey={cueKey} scale={scale} />
        ))}
      </IllustrationMotion>
    </View>
  );
}

function Layer({ layer, index, active, eventKey, scale }: {
  layer: MainArtLayer; index: number; active: boolean; eventKey: string; scale: number;
}) {
  return (
    <IllustrationLayer
      role={layer.role} index={index} active={active} eventKey={eventKey}
      origin={layer.origin ? [layer.origin[0] * scale, layer.origin[1] * scale] : undefined}
      motionScale={scale} style={StyleSheet.absoluteFill}
    >
      <SvgXml {...decorative} xml={`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">${layer.svg}</svg>`} width="100%" height="100%" />
      {layer.children?.map(child => (
        <Layer key={child.id} layer={child} index={index} active={active} eventKey={eventKey} scale={scale} />
      ))}
    </IllustrationLayer>
  );
}

const styles = StyleSheet.create({ canvas: { maxWidth: '100%', aspectRatio: 1.6, overflow: 'visible' } });
