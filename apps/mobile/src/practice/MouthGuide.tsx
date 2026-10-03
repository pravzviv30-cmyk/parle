import { Illustration } from '../art/flat/Illustration.tsx';
import { mouthGuide } from './mouthGuide.ts';

/** The adjoining authored cue explains this decorative cross-section. */
export function MouthGuide({ ipa }: { ipa: string }) {
  const name = mouthGuide(ipa);
  return name === null ? null : <Illustration name={name} />;
}
