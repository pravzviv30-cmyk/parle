/**
 * Make this phrase yours (F554, F557, F581).
 *
 * One tinted row. The phrase, its meaning and where it came from used to be
 * printed here beside two buttons; they belong in the sitting the row opens,
 * where the learner is actually going to work on them.
 *
 * The row opens the own-words drill rather than the recall drill. That is the
 * change worth reading twice: "say it" used to deal a scoped sitting that asked
 * the learner to reproduce the phrase they had just been shown, which is
 * copying. The node it hands over carries `ownWords`, so `DrillScreen` builds a
 * sitting that gives them the situation and the meaning and asks for whatever
 * French they have. The situation is the conversation the phrase came out of,
 * which is the only situation anybody here can honestly name.
 *
 * Keeping the phrase moved with it: the drill offers "Keep this phrase" once
 * the learner has said it their own way, which is a better moment to be asked
 * than before they have tried.
 */

import { QuoteGlyph } from '../glyphs.tsx';
import { TintRow } from '../components.tsx';
import { accent } from '../theme.ts';
import { MADE_FROM, type PhraseToOwn } from './madeFrom.ts';
import { MADE_FROM_TINT } from './madeFromTint.ts';

/** What the row asks the tab to open. The tab navigates; the row decides nothing else. */
export interface OwnWordsNode {
  id: string;
  title: string;
  phraseKeys: readonly string[];
  ownWords: { fr: string; en: string; situation: string };
}

export function MakePhraseCard({
  phrase,
  onSay,
}: {
  phrase: PhraseToOwn;
  /** Open the own-words sitting for this phrase. The node is built here. */
  onSay: (node: OwnWordsNode) => void;
  /**
   * The tab still passes these three while it is another engineer's file.
   * Saving moved into the drill's own-words outcome (F581) and hearing the
   * phrase moved into the sitting, so neither is a control on this row.
   */
  saving?: boolean;
  onHear?: () => void;
  onSave?: () => void;
}) {
  return (
    <TintRow
      tint={MADE_FROM_TINT.phrase}
      glyph={<QuoteGlyph color={accent.primary} />}
      title={MADE_FROM.phrase.label}
      gloss={MADE_FROM.phrase.gloss}
      onPress={() =>
        onSay({
          id: `ownwords:${phrase.packId}:${phrase.key}`,
          title: MADE_FROM.phrase.label,
          phraseKeys: [phrase.key],
          ownWords: { fr: phrase.fr, en: phrase.en, situation: phrase.from },
        })
      }
    />
  );
}
