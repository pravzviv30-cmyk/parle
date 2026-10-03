/**
 * The session surface, as pure presentation.
 *
 * Extracted so the mock driver (local session engine) and the live driver (agent
 * over the wire) render through the same component. Whatever drives it, the screen
 * cannot diverge — there is exactly one rendering of a session.
 */

import { useState, type ReactNode } from 'react';
import { View, Text, Pressable, PixelRatio, StyleSheet, TextInput } from 'react-native';
import type { SessionPrompt } from '@luvani/core';
import { accent, paper, radius, rungLabel, space, type, HAIRLINE, HIT, frenchText } from './theme.ts';
import { Card, GhostButton, Label, OptionCard, SpeakCircle, EarGlyph, HelpGlyph, fitDisplay, Press, ChevronRight, ControlTile } from './components.tsx';
import { ScrollScreen } from './layout.tsx';
import { KeyboardGlyph } from './glyphs.tsx';
import { MORE_HINT, MORE_LABEL, showsActionRow, soundNoteIn } from './lessonFooter.ts';
import { tutorNameOf } from './tutor/tutorName.ts';
import { useProfile } from './app/ProfileContext.tsx';
import { LiveRoomHeader } from './live/LiveRoomHeader.tsx';

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
  const [soundGuide, setSoundGuide] = useState(false);
  if (support.kind === 'full-line') {
    return (
      <Card>
        <Label>Your turn</Label>
        {/* Left, not centred, since revamp A: the mockup sets the line to say
            as a block you read from its left edge, and a long sentence centred
            on a phone leaves both ends ragged. Nothing is clipped; fitDisplay
            steps the serif down by length rather than cutting it. */}
        <Text {...frenchText} style={[fitDisplay(support.line), { color: paper.ink, marginTop: space(2) }]}>
          {support.line}
        </Text>
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>
          {support.gloss}
        </Text>
        {support.ipa ? (
          <View>
            <Pressable onPress={() => setSoundGuide((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: soundGuide }} style={st.hear}>
              <Text style={[type.small, { color: paper.ink }]}>{soundGuide ? 'Hide sound guide' : 'Show sound guide'}</Text>
            </Pressable>
            {soundGuide && <Text style={[type.notation, { color: paper.inkSoft }]}>/{support.ipa}/</Text>}
          </View>
        ) : null}
        {support.written && support.written !== support.line ? (
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1.5) }]}>
            {support.written}
          </Text>
        ) : null}
        {onHearLine && (
          <Pressable
            onPress={onHearLine}
            accessibilityRole="button"
            accessibilityLabel="Hear the line again"
            style={st.hear}
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
      <Card>
        <Label>Tell them this, in French</Label>
        <Text style={[type.body, { color: paper.ink, marginTop: space(2) }]}>{support.hint}</Text>
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
   * End this session. On the live path it opens the confirm sheet; on the mock
   * path it hands straight back to the caller. Either way the room's one door
   * is the compact outlined control in the safe-area header.
   */
  onLeave: () => void;
  /**
   * A quiet line in the header: a vendor hiccup, or a connection being rebuilt.
   * The live path fills it from `connectionLine`; the mock path has none.
   */
  headerLine?: string;
  /**
   * Anything the driver wants drawn above the end-session row, inside this frame.
   *
   * The live path puts two things here: the card asking a browser for the
   * gesture it wants before it will play the tutor, and the banner a safety
   * redirect leaves on screen. Both used to be siblings of this component in
   * `LiveSessionScreen`, which is the same as being above the frame, so on every
   * iPhone since the X they were drawn under the Dynamic Island. The frame pays
   * the inset exactly once and a second one around it would pay it twice, so
   * they come in here instead of the driver growing a root of its own.
   *
   * It is a slot rather than a prop per thing on purpose: what goes above the
   * header is the driver's business, and this surface's business is that it is
   * inside the safe area and above the end control.
   */
  above?: ReactNode;
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
  /** Switches the existing live room to typing without losing this lesson. */
  onSwitchToType?: () => void;
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
  // F462. At the accessibility reading sizes the frame's footer grows until the
  // card carrying the line to say has no room left above it, so the row of
  // quiet actions folds into one chip and opens on a tap. The rule is in
  // `lessonFooter.ts`; this only reads the size and remembers the tap.
  const [moreOpen, setMoreOpen] = useState(false);
  const actionRow = showsActionRow(PixelRatio.getFontScale(), moreOpen);
  // The turn's sound note sits above the mic footer, or in the body once the
  // footer has folded at the large reading sizes. `lessonFooter.ts` decides.
  const notePlace = soundNoteIn(PixelRatio.getFontScale(), prompt.turn.note, listening);

  const sendDraft = () => {
    const text = draft.trim();
    if (text.length === 0 || !listening) return;
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
      {notePlace === 'footer' && (
        <View style={st.soundNote}>
          <Text style={[type.small, { color: paper.inkSoft }]}>{prompt.turn.note}</Text>
        </View>
      )}
      <View style={st.rungRow}>
        {/* The rung is named once in words here; the bullets to the left mark it
            in colour. A bare colour dot beside both was a third telling that
            read ~1.4 against the ground for rung one (F329). */}
        <View style={{ flex: 1 }}>
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
              multiline
              scrollEnabled
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
              style={[type.body, st.input, { maxHeight: 100 }]}
            />
            <Press
              onPress={sendDraft}
              disabled={draft.trim().length === 0 || !listening}
              accessibilityRole="button"
              accessibilityLabel="Send your answer"
              accessibilityState={{ disabled: draft.trim().length === 0 || !listening }}
              style={st.send}
            >
              <ChevronRight size={22} color={paper.onInk} />
            </Press>
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
            {/* The caption under the voice circle reports which of us has the
                floor. It is words, so it clears the text floor in soft ink when
                the tutor holds it, not the faint ink a mark gets (F330). */}
            <Text style={[type.label, { color: listening ? paper.ink : paper.inkSoft, marginTop: space(2) }]}>
              {listening ? 'Speak' : 'Listen'}
            </Text>
          </>
        )}

        {actionRow ? (
          <View style={st.actions}>
            <ControlTile label="Help me out" glyph={<HelpGlyph size={22} />} onPress={props.onHelp}
              disabled={!listening} accessibilityLabel="Ask for help with this line" />
            {!props.onType && props.onSwitchToType && <ControlTile label="Type instead" glyph={<KeyboardGlyph size={22} />} onPress={props.onSwitchToType} />}
          </View>
        ) : (
          <Pressable
            onPress={() => setMoreOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={MORE_HINT}
            accessibilityState={{ expanded: false }}
            style={st.more}
          >
            <Text style={[type.small, { color: paper.ink }]}>{MORE_LABEL}</Text>
          </Pressable>
        )}
      </View>
    </>
  );

  return (
    <ScrollScreen
      avoidKeyboard
      topGap={space(2)}
      header={
        <>
          {props.above}
          <LiveRoomHeader
            title="Guided pronunciation"
            onEnd={props.onLeave}
            accessibilityLabel="End lesson"
            // The connection line is a status line: a learner mid-scene whose room
            // is being rebuilt must both see it and hear it. It is drawn as its own
            // polite live region here rather than handed to the header as a bare
            // string, which Fabric would drop in silence.
            status={
              props.headerLine ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}
                >
                  {props.headerLine}
                </Text>
              ) : undefined
            }
          />
        </>
      }
      footer={footer}
    >
      <View style={st.header}>
        <View style={st.headerRow}>
          <Label>Level {props.cefr}</Label>
        </View>
        {/* Wrapping, never clipped. `theme.ts` states it outright: nothing in
            this app is cut to fit, and a lesson title truncated at the largest
            reading size is the learner losing the name of what they are in. */}
        <Text accessibilityRole="header" style={[type.title, { color: paper.ink, marginTop: space(1) }]}>
          {props.lessonTitle}
        </Text>
      </View>

      <View style={st.body}>
        {/* The other person in the scene, as a white card: the caps name on
            top, the French in the serif, the English small underneath. The ear
            beside the name is a mark rather than a control, and it lights when
            the tutor holds the floor, which is the same grammar the thread in a
            conversation uses. */}
        <Card tone="journal">
          <View style={st.tutorHead}>
            <Label color={listening ? paper.inkSoft : paper.ink}>The waiter</Label>
            <EarGlyph size={19} color={listening ? paper.inkFaint : paper.ink} />
          </View>
          <Text style={[type.french, { color: paper.ink, marginTop: space(1.5) }]}>{prompt.turn.tutor}</Text>
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{prompt.turn.tutorEn}</Text>
        </Card>

        <SupportBlock
          support={prompt.support}
          onOptionPress={props.onOptionPress}
          onOptionHear={props.onOptionHear}
          onHearLine={props.onHearLine}
        />

        {props.transcript ? (
          <View style={st.heard}>
            <Label>{`What ${tutorName} heard`}</Label>
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(1) }]}>« {props.transcript} »</Text>
          </View>
        ) : null}

        {notePlace === 'body' && (
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
  // The violet pill the conversation's box already wears, so a typed lesson and
  // a typed conversation offer the same control. An empty draft is said the way
  // the shared PillButton says it, by filling the pill with the faint ink
  // instead of lettering the word in it: warm-white still clears the word floor
  // on that fill, and faint lettering on violet never did (F330).
  send: {
    minHeight: HIT,
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.ink,
    borderRadius: HIT / 2,
  },
  sendEmpty: { backgroundColor: paper.inkFaint },
  // The chip the action row folds into at the accessibility reading sizes.
  more: {
    minHeight: HIT,
    alignSelf: 'center',
    marginTop: space(2),
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.groundDeep,
    borderRadius: radius.pill,
  },
  actions: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', flexWrap: 'wrap' },
  header: { paddingBottom: space(3) },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // `flexGrow`, never `flex: 1`, and no vertical centring.
  //
  // `flex: 1` inside a ScrollScreen pins the body to the height of the viewport,
  // so content that grows past it is clipped instead of scrolled, and
  // `justifyContent: 'center'` then cuts it off symmetrically at both ends. At
  // the largest reading size that took the lesson title, the end control and
  // the whole Say this card off a session in progress: a learner could not see
  // the line they were being asked to say, and could not scroll to it. Same
  // defect as F383 on My French, in a worse place.
  //
  // `flexGrow: 1` still fills a short screen, which is all the centring was for,
  // and lets a tall one scroll.
  body: { flexGrow: 1, paddingTop: space(3), paddingBottom: space(5), gap: space(5) },
  tutorHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2) },
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
  // Above the rung row, on the page: a note, not a card, and no rule of its own
  // because the rung row under it already draws one.
  soundNote: { paddingTop: space(2), paddingBottom: space(1) },
  rungRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3.5),
    paddingVertical: space(3),
    borderTopWidth: HAIRLINE,
    borderTopColor: paper.line,
  },
  bullets: { flexDirection: 'row', gap: space(1.5) },
  controls: { alignItems: 'center', paddingTop: space(1) },
  help: { marginTop: space(2), minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(4) },
});
