/**
 * The session surface, as pure presentation.
 *
 * Extracted so the mock driver (local session engine) and the live driver (agent
 * over the wire) render through the same component. Whatever drives it, the screen
 * cannot diverge — there is exactly one rendering of a session.
 */

import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SessionPrompt } from '@parle/core';
import { enamel, rungColor, rungLabel, rungLabelEn, signal, space, type, HIT, radius } from './theme.ts';
import { Plaque, Tag, LabeledTag, LineBullet, StationLine, DirectionPlaque, MicGlyph, EarGlyph, HelpGlyph } from './components.tsx';

/**
 * Signage lettering has to fit its plaque — a real sign is cut to its longest word.
 */
function plaqueType(text: string) {
  const n = text.length;
  if (n <= 16) return type.plaque;
  if (n <= 32) return { ...type.plaque, fontSize: 24, lineHeight: 31, letterSpacing: 1.1 };
  return { ...type.plaque, fontSize: 19, lineHeight: 26, letterSpacing: 0.7 };
}

/**
 * What the support block can render. A structural superset of the lesson path's
 * `SupportView` and the free-conversation path's `ConvoSupportView`: the lesson
 * carries IPA and no spoken/written split, the conversation carries the split
 * and no IPA. Optional fields absorb the difference so both feed one component.
 */
export type SupportContent =
  | { kind: 'full-line'; line: string; gloss: string; ipa?: string | null; written?: string | null }
  | { kind: 'options'; options: { text: string; en: string }[] }
  | { kind: 'hint'; hint: string }
  | { kind: 'none' };

/**
 * The scaffolding, rendered. One visual grammar for every mode: a raised plaque
 * when the tutor hands over the whole line, direction plaques when the learner
 * chooses, a white notice when they are nudged, quiet nothing when they are free.
 */
export function SupportBlock({
  support,
  onOptionPress,
  onOptionHear,
  onHearLine,
}: {
  support: SupportContent;
  /** Mock path: submits the option as spoken. Live paths omit it — say it aloud. */
  onOptionPress?: (text: string) => void;
  /** Replay a rung-2 option aloud without submitting it. */
  onOptionHear?: (text: string) => void;
  /** Replay the line on the plaque. Every cued turn should be hearable on demand. */
  onHearLine?: () => void;
}) {
  if (support.kind === 'full-line') {
    return (
      <Plaque raised style={st.mainPlaque}>
        <Text style={[plaqueType(support.line), { color: enamel.white, textAlign: 'center' }]}>
          {support.line.toUpperCase()}
        </Text>
        <Text style={[type.body, { color: enamel.whiteMuted, textAlign: 'center', marginTop: space(2) }]}>
          {support.gloss}
        </Text>
        {support.ipa ? (
          <Text style={[type.notation, { color: enamel.whiteFaint, textAlign: 'center', marginTop: space(1.5) }]}>
            /{support.ipa}/
          </Text>
        ) : null}
        {support.written && support.written !== support.line ? (
          <Text style={[type.small, { color: enamel.whiteFaint, textAlign: 'center', marginTop: space(1.5) }]}>
            {support.written}
          </Text>
        ) : null}
        {onHearLine && (
          <Pressable
            onPress={onHearLine}
            accessibilityRole="button"
            accessibilityLabel="Hear the line again"
            style={({ pressed }) => [st.hear, pressed && { opacity: 0.6 }]}
          >
            <EarGlyph size={15} color={enamel.whiteMuted} />
            <Text style={[type.small, { color: enamel.whiteMuted }]}>écouter · hear it</Text>
          </Pressable>
        )}
      </Plaque>
    );
  }

  if (support.kind === 'options') {
    return (
      <View style={st.options}>
        {support.options.map((o) => (
          <DirectionPlaque
            key={o.text}
            text={o.text}
            gloss={o.en}
            onPress={() => onOptionPress?.(o.text)}
            onHear={onOptionHear ? () => onOptionHear?.(o.text) : undefined}
          />
        ))}
      </View>
    );
  }

  if (support.kind === 'hint') {
    return (
      <Plaque tone="white" style={st.mainPlaque}>
        <LabeledTag fr="DITES-LUI" en="Tell them this, in French" color="rgba(15,59,44,0.6)" />
        <Text style={[type.plaqueSmall, { color: enamel.field, marginTop: space(2) }]}>{support.hint}</Text>
      </Plaque>
    );
  }

  return (
    <View style={st.freeBlock}>
      <Text style={[type.small, { color: enamel.whiteFaint, textAlign: 'center' }]}>
        No prompts from here. Answer however you like.
      </Text>
    </View>
  );
}

export interface SessionViewProps {
  lessonTitle: string;
  cefr: string;
  prompt: SessionPrompt;
  /** True when the learner has the floor. */
  listening: boolean;
  /** The one-line reaction to the last turn. Never a number, never a scold. */
  flash: string | null;
  /** What the learner just said, as heard. Shown for trust in the live path. */
  transcript?: string | null;
  /**
   * Mock path: submits the option as if spoken. Live path: absent — the learner
   * must say it aloud, and the plaques are read-along support, not buttons.
   */
  onOptionPress?: (text: string) => void;
  /** Mock path only: simulates speaking the target line. */
  onMicPress?: () => void;
  onHelp: () => void;
  /** Replay the line on the plaque. Every cued turn should be hearable on demand. */
  onHearLine?: () => void;
  /** Replay a rung-2 option aloud without submitting it. */
  onOptionHear?: (text: string) => void;
}

export function SessionView(props: SessionViewProps) {
  const insets = useSafeAreaInsets();
  const { prompt, listening, flash } = props;
  const rung = prompt.directive.rung;

  return (
    <View style={[st.root, { paddingTop: insets.top + space(2), paddingBottom: insets.bottom + space(2) }]}>
      <View style={st.header}>
        <View style={st.headerRow}>
          <Tag>LIGNE {props.cefr}</Tag>
          <Tag color={enamel.whiteFaint}>
            {prompt.position} / {prompt.total}
          </Tag>
        </View>
        <Text style={[type.heading, { color: enamel.white, marginTop: space(1) }]} numberOfLines={1}>
          {props.lessonTitle}
        </Text>
        <View style={{ marginTop: space(2.5) }}>
          <StationLine total={prompt.total} index={prompt.position - 1} />
        </View>
      </View>

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <View style={st.tutorBlock}>
          <View style={st.tutorHead}>
            <EarGlyph size={19} color={listening ? enamel.whiteFaint : enamel.white} />
            <Tag color={listening ? enamel.whiteFaint : enamel.white}>LE SERVEUR · THE WAITER</Tag>
          </View>
          <Text style={[type.bodyStrong, { color: enamel.white, marginTop: space(1.5) }]}>{prompt.turn.tutor}</Text>
          <Text style={[type.small, { color: enamel.whiteMuted, marginTop: space(0.5) }]}>{prompt.turn.tutorEn}</Text>
        </View>

        <SupportBlock
          support={prompt.support}
          onOptionPress={props.onOptionPress}
          onOptionHear={props.onOptionHear}
          onHearLine={props.onHearLine}
        />

        {props.transcript ? (
          <View style={st.heard}>
            <LabeledTag fr="ENTENDU" en="What the tutor heard" color={enamel.whiteFaint} />
            <Text style={[type.body, { color: enamel.whiteMuted, marginTop: space(1) }]}>« {props.transcript} »</Text>
          </View>
        ) : null}

        {prompt.turn.note && listening && (
          <View style={st.note}>
            <Text style={[type.small, { color: enamel.whiteMuted }]}>{prompt.turn.note}</Text>
          </View>
        )}
      </ScrollView>

      <View style={st.rungRow}>
        <View style={st.bullets}>
          {([1, 2, 3, 4] as const).map((r) => (
            <LineBullet key={r} rung={r} active={r === rung} />
          ))}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.tag, { color: rungColor[rung] }]}>{rungLabel[rung]}</Text>
          <Text style={[type.small, { color: enamel.whiteMuted, marginTop: 2 }]}>{rungLabelEn[rung]}</Text>
        </View>
      </View>

      <View style={st.controls}>
        {flash ? (
          <Text style={[type.bodyStrong, { color: enamel.white, textAlign: 'center', marginBottom: space(2) }]}>{flash}</Text>
        ) : (
          <View style={{ height: space(2) + 23, marginBottom: space(2) }} />
        )}

        <Pressable
          onPress={props.onMicPress}
          disabled={!listening || !props.onMicPress}
          accessibilityRole="button"
          accessibilityLabel={listening ? 'Speak your answer' : 'The tutor is speaking'}
          accessibilityState={{ disabled: !listening }}
          style={({ pressed }) => [st.speak, listening ? st.speakLive : st.speakIdle, pressed && listening && st.speakPressed]}
        >
          <MicGlyph size={28} color={listening ? enamel.white : enamel.whiteFaint} />
          <Text style={[type.tag, { color: listening ? enamel.white : enamel.whiteFaint, marginTop: space(1) }]}>
            {listening ? 'PARLEZ · SPEAK' : 'ÉCOUTEZ · LISTEN'}
          </Text>
        </Pressable>

        <Pressable
          onPress={props.onHelp}
          disabled={!listening}
          accessibilityRole="button"
          accessibilityLabel="Ask for help with this line"
          style={({ pressed }) => [st.help, pressed && { opacity: 0.6 }]}
        >
          <HelpGlyph size={15} />
          <Text style={[type.small, { color: enamel.whiteMuted }]}>aide-moi · help me out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: enamel.ground, paddingHorizontal: space(5) },
  header: { paddingBottom: space(3) },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scroll: { paddingTop: space(3), paddingBottom: space(5), gap: space(5), flexGrow: 1, justifyContent: 'center' },
  tutorBlock: { borderLeftWidth: 1, borderLeftColor: 'rgba(242,239,228,0.28)', paddingLeft: space(3.5) },
  tutorHead: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  mainPlaque: { marginTop: space(1) },
  options: { gap: space(2.5) },
  freeBlock: { paddingVertical: space(6) },
  hear: {
    marginTop: space(3),
    minHeight: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
  },
  heard: { borderTopWidth: 1, borderTopColor: 'rgba(242,239,228,0.14)', paddingTop: space(3) },
  note: { borderTopWidth: 1, borderTopColor: 'rgba(242,239,228,0.14)', paddingTop: space(3) },
  rungRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3.5),
    paddingVertical: space(3),
    borderTopWidth: 1,
    borderTopColor: 'rgba(242,239,228,0.14)',
  },
  bullets: { flexDirection: 'row', gap: space(1.5) },
  controls: { alignItems: 'center', paddingTop: space(1) },
  speak: { width: 108, height: 108, borderRadius: radius.bullet, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  speakLive: {
    backgroundColor: signal.live,
    borderColor: enamel.white,
    shadowColor: signal.live,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  speakIdle: { backgroundColor: 'transparent', borderColor: 'rgba(242,239,228,0.22)' },
  speakPressed: { transform: [{ scale: 0.96 }] },
  help: { marginTop: space(3), minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(4) },
});
