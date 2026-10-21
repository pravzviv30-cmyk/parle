/**
 * What the tutor is, said once.
 *
 * Four pages, in the onboarding idiom so it feels like the same app rather
 * than a bolted-on tour: the same ProgressDots, the same back chevron, the same
 * one-question-per-page rhythm.
 *
 * Deliberately NOT appended to onboarding. An explainer read four screens
 * before the thing it explains is a leaflet; read at the door of the tutor, it
 * is instructions. It also names the three controls the conversation actually
 * renders — Help me out, Simpler, In English — so it teaches the real UI rather
 * than a general idea of one.
 *
 * Notebook Phase 4 (2026-09-27): the clip-art left (the speech bubbles, the
 * wave and the postcard) and so did the chartreuse feature panel. The orb page
 * stays whole, because this is the only place the app teaches what the orb's
 * states mean.
 *
 * The first page does not write its own words. Its title and body come from
 * `onboarding/disclosure.ts`, the same module the welcome subline and the Meet
 * Luc page read, so the app says what the tutor is once and in one voice. That
 * page used to open with a biography, from Lyon and twenty years behind a bar,
 * while nothing anywhere told the learner they were talking to software. Luc
 * keeps the bar. He is introduced as a character now, which is what he is, and
 * `disclosure.test.ts` fails if this page tells the life story again without
 * saying so.
 *
 * Every page that names the tutor now names whoever this learner chose, and
 * every pronoun agrees with them. Two of the eight catalogue voices are women,
 * so a walkthrough with "Luc" and "he" written into it introduces Céline as a
 * man — the same defect as a voice from Quebec being read a biography set in
 * Lyon, and the learner believes the voice.
 */

import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { paper, space, type, HAIRLINE } from '../theme.ts';
import { ProgressDots, PillButton, Card, ROW_WORDS } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { VoiceOrb, type OrbState } from './VoiceOrb.tsx';
import { tutorPersonaOf, type TutorPersona } from './tutorName.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { PERSONA_BODY, PERSONA_TITLE, pronouns } from '../onboarding/disclosure.ts';

/**
 * The final page's lesson: the circle speaks traffic lights. Three live mini
 * orbs, each in one state, each with the sentence that state means. The same
 * component the conversation renders, so this page can never drift from the
 * real thing.
 */
function OrbWalkthrough({ persona }: { persona: TutorPersona }) {
  const rows: { state: OrbState; title: string; sub: string }[] = [
    { state: 'ready', title: 'Tap to talk', sub: 'The circle waits for you.' },
    { state: 'speaking', title: `${persona.name} is talking`, sub: 'Just listen.' },
    { state: 'listening', title: 'Your turn', sub: 'Say it out loud.' },
    { state: 'thinking', title: 'It is thinking', sub: 'One moment.' },
  ];
  // One card of four rows since revamp A, rather than four cards in a stack.
  // The four states are one lesson about one control, and four separate cards
  // read as four separate things to learn. The rest state leads, because an
  // untapped circle is the first one a learner meets and it is the one state
  // that is a control rather than a report.
  //
  // Revamp B (F595): each title names its state in words and never by colour.
  // The orb now carries a glyph and a caption for every state, so a colour word
  // here would teach the one cue a colour-blind learner cannot see.
  return (
    <Card style={st.states}>
      {rows.map((row, index) => (
        <View key={row.state} style={[st.stateRow, index > 0 && st.stateDivided]}>
          <VoiceOrb state={row.state} size={56} withCaption={false} announce={false} />
          <View style={st.stateWords}>
            <Text style={[type.heading, { color: paper.ink }]}>{row.title}</Text>
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{row.sub}</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

/**
 * The four pages, as a function of who the learner chose.
 *
 * It used to be a module constant, which is exactly what a set of pages
 * introducing a person should not be once the person can be a different one.
 * Rung one of this walkthrough says who is talking, and the hint card says whose
 * sentences the Simpler button shortens, and both name somebody.
 */
function pagesFor(persona: TutorPersona) {
  // Two of the eight voices are women, so every sentence on these pages that
  // used to say "he" said the wrong thing to a quarter of the people reading
  // it. One table, derived once, rather than a ternary at each call site.
  const p = pronouns(persona);
  return [
  {
    key: 'what',
    // Both are functions of the persona now. "AI tutor" is not something the
    // persona may move: that sentence is the disclosure itself, and
    // `disclosure.test.ts` fails for any of the eight if it goes.
    title: PERSONA_TITLE(persona),
    body: PERSONA_BODY(persona),
    note: null,
  },
  {
    key: 'stuck',
    title: 'Getting stuck is planned for',
    body: 'You always get the first attempt. If you get stuck, a small English hint appears without interrupting the scene. The answer stays hidden unless you ask again.',
    note: `Help reveals a hint, then choices, then the line. Simpler keeps ${persona.name}'s sentences short. In English tells you what ${p.subject} just said.`,
  },
  {
    key: 'after',
    title: 'Leave with something useful',
    body: 'Your recap keeps the lines you said, one phrase to take with you and one sound, and says what comes next time. Saved phrases wait in Progress.',
    note: null,
  },
  {
    key: 'orb',
    title: 'The circle runs the room',
    body: 'The circle names whose turn it is, with a symbol as well as a colour.',
    note: null,
  },
  ] as const;
}

export function TutorIntro({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  // The person this learner chose, so the walkthrough introduces the voice they
  // will actually hear rather than the one that happens to be the default.
  const persona = tutorPersonaOf(useProfile().profile);
  const pages = pagesFor(persona);
  const page = pages[index]!;
  const last = index === pages.length - 1;

  // The chevron and the hardware back agree: step back a page, or leave on page
  // one, so the walkthrough finally has a way out of its very first screen.
  const back = () => (index > 0 ? setIndex((i) => i - 1) : onDone());
  useHardwareBack(true, back);

  return (
    <ScrollScreen
      header={<ScreenHeader back={{ onPress: back }} title={<ProgressDots total={pages.length} index={index} />} />}
      footer={<PillButton label={last ? 'Ready to practise' : 'Next'} onPress={() => (last ? onDone() : setIndex((i) => i + 1))} />}
    >
      <View style={st.page}>
        <Text style={st.title} accessibilityRole="header">{page.title}</Text>
        <Text style={st.body}>{page.body}</Text>
        {page.key === 'orb' ? <OrbWalkthrough persona={persona} /> : null}
        {page.note ? (
          <Card style={{ marginTop: space(5) }}>
            <Text style={[type.bodyStrong, { color: paper.ink }]}>{page.note}</Text>
          </Card>
        ) : null}
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  page: { paddingTop: space(3), marginBottom: space(4) },
  states: { alignSelf: 'stretch', marginTop: space(5) },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: space(4), paddingVertical: space(2) },
  stateDivided: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard, marginTop: space(2) },
  stateWords: ROW_WORDS,
  title: { ...type.title, color: paper.ink },
  body: { ...type.body, color: paper.inkSoft, marginTop: space(3) },
});
