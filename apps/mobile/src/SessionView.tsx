/**
 * The session surface, as pure presentation.
 *
 * Extracted so the mock driver (local session engine) and the live driver (agent
 * over the wire) render through the same component. Whatever drives it, the screen
 * cannot diverge — there is exactly one rendering of a session.
 */

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import type { SessionPrompt } from '@luvani/core';
import { paper, radius, rungColor, rungLabel, space, type, HAIRLINE, HIT } from './theme.ts';
import { Card, Label, LineBullet, StationLine, OptionCard, SpeakCircle, EarGlyph, HelpGlyph, fitDisplay } from './components.tsx';
import { ScrollScreen, ScreenHeader } from './layout.tsx';
import { tutorNameOf } from './tutor/tutorName.ts';
import { useProfile } from './app/ProfileContext.tsx';

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

  return null;
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
   * Submits the option as the learner's answer.
   *
   * Saying it aloud is the product, and on the live path the cards are still
   * read-along support first. But a learner in a quiet carriage who cannot
   * speak used to have no way to answer at all, and finished the session having
   * said nothing — so a tap answers, and is recorded as an answer nobody heard
   * rather than one that was heard and went well.
   */
  onOptionPress?: (text: string) => void;
  /** Mock path only: simulates speaking the target line. */
  onMicPress?: () => void;
  onHelp: () => void;
  /**
   * Leave this session. On the live path it opens the confirm sheet; on the mock
   * path it hands straight back to the caller. Either way the meter's one door
   * is the shared header's Leave, not a control this surface hand-rolls.
   */
  onLeave: () => void;
  /**
   * A quiet line in the header: a vendor hiccup, or a connection being rebuilt.
   * The live path fills it from `connectionLine`; the mock path has none.
   */
  headerLine?: string;
  /** Replay the line on the card. Every cued turn should be hearable on demand. */
  onHearLine?: () => void;
  /** Replay a rung-2 option aloud without submitting it. */
  onOptionHear?: (text: string) => void;
  /**
   * Typed answers, for a lesson taken without a microphone. Present only in text
   * mode; the mic circle stands down and this takes its place.
   */
  onType?: (text: string) => void;
  /**
   * "Still here", while the learner composes.
   *
   * The agent counts silence to decide when a learner is stuck, and a typed
   * learner is silent by definition, so a lesson that sent nothing while the
   * box filled up was rescued for thinking. Hand it every keystroke: the hook
   * throttles, and the draft itself never goes on the wire.
   */
  onTyping?: () => void;
}

export function SessionView(props: SessionViewProps) {
  // Read here rather than taken as a prop so both drivers name the same person
  // without either of them having to remember to pass it. It is the same kind
  // of ambient fact as the safe-area inset above: whose voice this session is
  // in belongs to the learner, not to whatever is driving the turns.
  const tutorName = tutorNameOf(useProfile().profile);
  const { prompt, listening, flash } = props;
  const rung = prompt.directive.rung;
  const [draft, setDraft] = useState('');

  const sendDraft = () => {
    const text = draft.trim();
    if (text.length === 0) return;
    setDraft('');
    props.onType?.(text);
  };

  // Typing is presence. The hook throttles, so this can be handed every letter.
  // The same seam ConvoScreen has used since the conversation gained a box.
  const changeDraft = (text: string) => {
    setDraft(text);
    props.onTyping?.();
  };

  // The rung row and the control row hold the bottom of the screen, so they ride
  // in the frame's footer rather than scrolling with the thread above them.
  const footer = (
    <>
      <View style={st.rungRow}>
        <View style={st.bullets}>
          {([1, 2, 3, 4] as const).map((r) => (
            <LineBullet key={r} rung={r} active={r === rung} />
          ))}
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
          <View style={[st.rungDot, { backgroundColor: rungColor[rung] }]} />
          <Text style={[type.bodyStrong, { color: paper.ink }]}>{rungLabel(rung, tutorName)}</Text>
        </View>
      </View>

      <View style={st.controls}>
        {flash ? (
          <Text style={[type.bodyStrong, { color: paper.ink, textAlign: 'center', marginBottom: space(2) }]}>{flash}</Text>
        ) : (
          <View style={{ height: space(2) + 23, marginBottom: space(2) }} />
        )}

        {props.onType ? (
          <View style={st.typeRow}>
            <TextInput
              value={draft}
              onChangeText={changeDraft}
              onSubmitEditing={sendDraft}
              returnKeyType="send"
              submitBehavior="submit"
              placeholder="Type your answer"
              placeholderTextColor={paper.inkFaint}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Type your answer in French"
              style={[type.body, st.input]}
            />
            <Pressable
              onPress={sendDraft}
              disabled={draft.trim().length === 0}
              accessibilityRole="button"
              accessibilityLabel="Send your answer"
              style={({ pressed }) => [st.send, pressed && { opacity: 0.6 }]}
            >
              <Text style={[type.bodyStrong, { color: draft.trim().length === 0 ? paper.inkFaint : paper.ink }]}>Send</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <SpeakCircle
              onPress={props.onMicPress}
              active={listening}
              muted={!listening}
              disabled={!props.onMicPress}
              accessibilityLabel={listening ? 'Speak your answer' : `${tutorName} is speaking`}
            />
            <Text style={[type.label, { color: listening ? paper.ink : paper.inkFaint, marginTop: space(2) }]}>
              {listening ? 'Speak' : 'Listen'}
            </Text>
          </>
        )}

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
    </>
  );

  return (
    <ScrollScreen
      topGap={space(2)}
      header={<ScreenHeader leave={{ onPress: props.onLeave, label: 'Leave' }} title={props.headerLine} />}
      footer={footer}
    >
      <View style={st.header}>
        {/* The position is the dot rail below, and only the dot rail. It used
            to be printed here as "2 / 5" as well, which is the numeric progress
            ConvoScreen deliberately dropped: a count mid-session is a score,
            and this surface is the one place a learner is already exposed. */}
        <View style={st.headerRow}>
          <Label>Level {props.cefr}</Label>
        </View>
        <Text style={[type.heading, { color: paper.ink, marginTop: space(1) }]} numberOfLines={1}>
          {props.lessonTitle}
        </Text>
        <View style={{ marginTop: space(2.5) }}>
          <StationLine total={prompt.total} index={prompt.position - 1} />
        </View>
      </View>

      <View style={st.body}>
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
            <Label color={paper.inkFaint}>{`What ${tutorName} heard`}</Label>
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(1) }]}>« {props.transcript} »</Text>
          </View>
        ) : null}

        {prompt.turn.note && listening && (
          <View style={st.note}>
            <Text style={[type.small, { color: paper.inkSoft }]}>{prompt.turn.note}</Text>
          </View>
        )}
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), alignSelf: 'stretch' },
  input: {
    flex: 1,
    color: paper.ink,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: radius.input,
    paddingHorizontal: space(3),
    paddingVertical: space(2.5),
    backgroundColor: paper.card,
  },
  send: { paddingHorizontal: space(3), paddingVertical: space(2.5), minHeight: HIT },
  header: { paddingBottom: space(3) },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  body: { flex: 1, paddingTop: space(3), paddingBottom: space(5), gap: space(5), justifyContent: 'center' },
  tutorBlock: { borderLeftWidth: HAIRLINE + 1, borderLeftColor: paper.line, paddingLeft: space(3.5) },
  tutorHead: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  mainCard: { alignItems: 'center' },
  options: { gap: space(2.5) },
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
