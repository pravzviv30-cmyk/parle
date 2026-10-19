import type { ReactNode } from 'react';
import { Choice } from '../components.tsx';

/** C2 geometry and artwork, delegated to the app's one accessible choice owner. */
export function C2Choice({ title, detail, glyph, selected, onPress, minimumHeight = 64 }: {
  title: string; detail?: string; glyph?: ReactNode; selected: boolean; onPress: () => void; minimumHeight?: number;
}) {
  return <Choice appearance="onboarding" minimumHeight={minimumHeight} layout="row"
    title={title} detail={detail} glyph={glyph} selected={selected} onPress={onPress} />;
}
