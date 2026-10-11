import { Glint } from '../motion/Glint.tsx';
import type { ComponentProps } from 'react';
import { PillButton } from '../components.tsx';
export function BoldButton(props: ComponentProps<typeof PillButton>) {
  return <PillButton {...props} design="bold-rhythm" decoration={<><Glint when={!props.disabled && (!props.state || props.state === 'idle')} radius={12} />{props.decoration}</>} />;
}
