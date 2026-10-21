import { Glint } from '../motion/Glint.tsx';
import type { ComponentProps } from 'react';
import { radius } from '../theme.ts';
import { PillButton } from '../components.tsx';

/**
 * A thin alias of the one pill (UI-004/UI-005). The bold-rhythm look is folded
 * into PillButton, so onboarding's primary draws exactly like every other.
 * It keeps only its come-alive glint, a motion cue rather than a style.
 */
export function BoldButton(props: ComponentProps<typeof PillButton>) {
  return <PillButton {...props} decoration={<><Glint when={!props.disabled && (!props.state || props.state === 'idle')} radius={radius.pill} />{props.decoration}</>} />;
}
