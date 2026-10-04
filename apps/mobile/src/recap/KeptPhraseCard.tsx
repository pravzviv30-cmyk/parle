import { Text } from 'react-native';
import { Card, Highlight, Label } from '../components.tsx';
import { Feedback } from '../motion/Feedback.tsx';
import { type } from '../theme.ts';
export function KeptPhraseCard({ fr, en, saveLine, saved, eventKey }: { fr: string; en: string; saveLine: string; saved: boolean; eventKey: string }) {
  return <Card><Label>A phrase to keep</Label><Highlight text={fr} /><Text style={type.body}>{en}</Text><Feedback kind="saved" active={saved} eventKey={eventKey}><Text accessibilityLiveRegion="polite" style={type.small}>{saveLine}</Text></Feedback></Card>;
}
