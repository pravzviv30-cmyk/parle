/**
 * The recap's one focus, opened from its focus row (UI-020, the one-scroll
 * recap). A sound: where it was heard, the mouth, a word first and the cue,
 * the notation on request, and fresh private practice with the example. Not a
 * sound: "One thing to tune" with the tutor's line or the French.
 *
 * Mounted only while open, so closing it unmounts `PrivatePractice`, which
 * deletes its clip on the way out and never uploads one.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getMission } from '@luvani/core';

import { Label, Sheet } from '../components.tsx';
import type { ClosureFocus } from '../conversationPacks/closure.ts';
import { KEEPSAKE_COPY } from '../live/keepsake.ts';
import { useB } from '../main/bTheme.tsx';
import { MouthGuide } from '../practice/MouthGuide.tsx';
import { HIT, space, type } from '../theme.ts';
import { SOUND_DETAIL, SOUND_FOCUS_LABEL, exampleFirstHeading } from '../tutor/soundExample.ts';
import { PrivatePractice } from './PrivatePractice.tsx';

export function FocusSheet({ focus, onClose }: { focus: ClosureFocus; onClose: () => void }) {
  const t = useB();
  const [soundDetail, setSoundDetail] = useState(false);
  if (focus.kind !== 'sound') {
    return (
      <Sheet visible title="One thing to tune" onClose={onClose} surface={t.card} ink={t.text}>
        {focus.kind === 'clarity' ? (
          <Text style={[type.bodyStrong, { color: t.text }]}>{focus.line}</Text>
        ) : (
          <View>
            <Text style={[type.french, { color: t.text }]}>{focus.fr}</Text>
            <Text style={[type.small, { color: t.muted, marginTop: space(0.5) }]}>{focus.en}</Text>
            <Text style={[type.small, { color: t.muted, marginTop: space(1) }]}>{focus.note}</Text>
          </View>
        )}
      </Sheet>
    );
  }
  const sound = focus;
  return (
    <Sheet visible title={sound.source === 'live' ? 'From this conversation' : 'From a saved sound check'} onClose={onClose} surface={t.card} ink={t.text}>
      <View style={st.body}>
        {sound.source === 'live' ? (
          <Text style={[type.small, { color: t.text }]}>Heard when you said the line you were given.</Text>
        ) : (
          <Text style={[type.small, { color: t.text }]}>This check concerns its recorded reference line, not your pronunciation overall. {getMission(sound.missionId)?.titleEn ?? 'A previous scene'}.</Text>
        )}
        {/* One sound, met as a word; the notation is a detail the learner opens. */}
        <View>
          <Label>{sound.source === 'live' ? SOUND_FOCUS_LABEL : KEEPSAKE_COPY.sound}</Label>
          <MouthGuide ipa={sound.ipa} />
          <Text style={[type.bodyStrong, { color: t.text, marginTop: space(2) }]}>{exampleFirstHeading(sound.acoustic, sound.example)}</Text>
          <Text style={[type.body, { color: t.muted, marginTop: space(1) }]}>{sound.acoustic.cue}</Text>
          <Pressable
            onPress={() => setSoundDetail((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: soundDetail }}
            style={({ pressed }) => [st.disclosure, pressed && st.pressed]}
          >
            <Text style={[type.small, { color: t.text }]}>{soundDetail ? SOUND_DETAIL.hide : SOUND_DETAIL.show}</Text>
          </Pressable>
          {soundDetail && <Text style={[type.notation, { color: t.muted }]}>{sound.acoustic.heading}</Text>}
          {sound.example !== null && <PrivatePractice key={sound.example} french={sound.example} />}
        </View>
      </View>
    </Sheet>
  );
}

const st = StyleSheet.create({
  body: { gap: space(4) },
  disclosure: { minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
