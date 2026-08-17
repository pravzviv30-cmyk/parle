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
import { paper, rungColor, rungLabel, space, type, HAIRLINE, HIT } from './theme.ts';
import { Card, Label, LineBullet, StationLine, OptionCard, SpeakCircle, EarGlyph, HelpGlyph, fitDisplay } from './components.tsx';

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
 * The scaffolding, rendered. One visual grammar for every mode: a white card
 * with the whole line when the tutor hands it over, option cards when the
 * learner chooses, a quiet notice when they are nudged, nothing when free.
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
  /** Replay the line on the card. Every cued turn should be hearable on demand. */
  onHearLine?: () => void;
}) {
  if (support.kind === 'full-line') {
    return (
      <Card style={st.mainCard}>
        <Label>Say this</Label>
        <Text style={[fitDisplay(support.line), { color: paper.ink, textAlign: 'center', marginTop: space(2) }]}>
          {support.line}
        </Text>
        <Text style={[type.body, { color: paper.inkSoft, textAlign: 'center', marginTop: space(2) }]}>
          {support.gloss}
        </Text>
        {support.ipa ? (
          <Text style={[type.notation, { color: paper.inkFaint, textAlign: 'center', marginTop: space(1.5) }]}>
            /{support.ipa}/
          </Text>
        ) : null}
        {support.written && support.written !== support.line ? (
          <Text style={[type.small, { color: paper.inkFaint, textAlign: 'center', marginTop: space(1.5) }]}>
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
            <EarGlyph size={15} color={paper.inkSoft} />
            <Text style={[type.small, { color: paper.inkSoft }]}>Hear it</Text>
          </Pressable>
        )}
      </Card>
    );
  }

  if (support.kind === 'options') {
    return (
      <View style={st.options}>
        {support.options.map((o) => (
          <OptionCard
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
      <Card style={st.mainCard}>
        <Label>Tell them this, in French</Label>
        <Text style={[type.title, { color: paper.ink, marginTop: space(2) }]}>{support.hint}</Text>
      </Card>
    );
  }

  return (
    <View style={st.freeBlock}>
      <Text style={[type.small, { color: paper.inkFaint, textAlign: 'center' }]}>
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
   * must say it aloud, and the cards are read-along support, not buttons.
   */
  onOptionPress?: (text: string) => void;
  /** Mock path only: simulates speaking the target line. */
  onMicPress?: () => void;
  onHelp: () => void;
  /** Replay the line on the card. Every cued turn should be hearable on demand. */
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
          <Label>Level {props.cefr}</Label>
          <Label color={paper.inkFaint}>
            {prompt.position} / {prompt.total}
          </Label>
        </View>
        <Text style={[type.heading, { color: paper.ink, marginTop: space(1) }]} numberOfLines={1}>
          {props.lessonTitle}
        </Text>
        <View style={{ marginTop: space(2.5) }}>
          <StationLine total={prompt.total} index={prompt.position - 1} />
        </View>
      </View>

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <View style={st.tutorBlock}>
          <View style={st.tutorHead}>
            <EarGlyph size={19} color={listening ? paper.inkFaint : paper.ink} />
            <Label color={listening ? paper.inkFaint : paper.ink}>The waiter</Label>
          </View>
          <Text style={[type.french, { color: paper.ink, marginTop: space(1.5) }]}>{prompt.turn.tutor}</Text>
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{prompt.turn.tutorEn}</Text>
        </View>

        <SupportBlock
          support={prompt.support}
          onOptionPress={props.onOptionPress}
          onOptionHear={props.onOptionHear}
          onHearLine={props.onHearLine}
        />

        {props.transcript ? (
          <View style={st.heard}>
            <Label color={paper.inkFaint}>What the tutor heard</Label>
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(1) }]}>« {props.transcript} »</Text>
          </View>
        ) : null}

        {prompt.turn.note && listening && (
          <View style={st.note}>
            <Text style={[type.small, { color: paper.inkSoft }]}>{prompt.turn.note}</Text>
          </View>
        )}
      </ScrollView>

      <View style={st.rungRow}>
        <View style={st.bullets}>
          {([1, 2, 3, 4] as const).map((r) => (
            <LineBullet key={r} rung={r} active={r === rung} />
          ))}
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
          <View style={[st.rungDot, { backgroundColor: rungColor[rung] }]} />
          <Text style={[type.bodyStrong, { color: paper.ink }]}>{rungLabel[rung]}</Text>
        </View>
      </View>

      <View style={st.controls}>
        {flash ? (
          <Text style={[type.bodyStrong, { color: paper.ink, textAlign: 'center', marginBottom: space(2) }]}>{flash}</Text>
        ) : (
          <View style={{ height: space(2) + 23, marginBottom: space(2) }} />
        )}

        <SpeakCircle
          onPress={props.onMicPress}
          active={listening}
          muted={!listening}
          disabled={!props.onMicPress}
          accessibilityLabel={listening ? 'Speak your answer' : 'The tutor is speaking'}
        />
        <Text style={[type.label, { color: listening ? paper.ink : paper.inkFaint, marginTop: space(2) }]}>
          {listening ? 'Speak' : 'Listen'}
        </Text>

        <Pressable
          onPress={props.onHelp}
          disabled={!listening}
          accessibilityRole="button"
          accessibilityLabel="Ask for help with this line"
          style={({ pressed }) => [st.help, pressed && { opacity: 0.6 }]}
        >
          <HelpGlyph size={15} />
          <Text style={[type.small, { color: paper.inkSoft }]}>Help me out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  header: { paddingBottom: space(3) },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scroll: { paddingTop: space(3), paddingBottom: space(5), gap: space(5), flexGrow: 1, justifyContent: 'center' },
  tutorBlock: { borderLeftWidth: HAIRLINE + 1, borderLeftColor: paper.line, paddingLeft: space(3.5) },
  tutorHead: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  mainCard: { alignItems: 'center' },
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
  heard: { borderTopWidth: HAIRLINE, borderTopColor: paper.line, paddingTop: space(3) },
  note: { borderTopWidth: HAIRLINE, borderTopColor: paper.line, paddingTop: space(3) },
  rungRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3.5),
    paddingVertical: space(3),
    borderTopWidth: HAIRLINE,
    borderTopColor: paper.line,
  },
  rungDot: { width: 8, height: 8, borderRadius: 999 },
  bullets: { flexDirection: 'row', gap: space(1.5) },
  controls: { alignItems: 'center', paddingTop: space(1) },
  help: { marginTop: space(2), minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(4) },
});
