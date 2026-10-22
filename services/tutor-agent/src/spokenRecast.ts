import { normalise } from '@luvani/core';
import type { TurnView } from '@luvani/brain';

const exactForm = (text: string): string => text.normalize('NFC').toLocaleLowerCase('fr').replace(/[’']/g, "'").replace(/[.,!?;:«»"()\-]/g, ' ').replace(/\s+/g, ' ').trim();
const words = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

/** A single earned echo of an inline correction, inside the character's reply. */
export function inCharacterRecast(view: TurnView, learnerText: string, alreadyUsed: boolean): { view: TurnView; used: boolean } {
  if (alreadyUsed || view.reachedForEnglish || view.narration !== null) return { view, used: false };
  const said = ' ' + normalise(learnerText) + ' ';
  const finding = view.coachNow.find((item) => {
    const quote = normalise(item.quote);
    const better = normalise(item.better);
    return item.kind !== 'english-to-french' && quote.length > 0 && better.length > 0
      && quote !== better && said.includes(' ' + quote + ' ')
      && item.better.trim().length <= 240 && item.betterEn.trim().length > 0 && item.betterEn.trim().length <= 240;
  });
  if (!finding) return { view, used: false };
  // The character may already have echoed this exact form. Count it rather
  // than saying it twice; punctuation/case do not change what the learner hears.
  if ((' ' + exactForm(view.sceneReply.fr) + ' ').includes(' ' + exactForm(finding.better) + ' ')) return { view, used: true };
  const closed = (text: string): string => /[.!?…]$/.test(text.trim()) ? text.trim() : text.trim() + '.';
  const fr = 'Ah, ' + closed(finding.better) + ' ' + view.sceneReply.fr;
  // This adds one brief echo, never a second long answer. These are display/
  // speech length budgets; they do not change any learning judgment or rung.
  if (finding.better.trim().length > 120 || words(finding.better) > 12
    || fr.length > (view.rung <= 2 ? 120 : 240) || words(fr) > (view.rung <= 2 ? 20 : 40)) return { view, used: false };
  return {
    used: true,
    view: { ...view, sceneReply: { ...view.sceneReply,
      fr,
      // A recast changes the spoken display form, so any separate spelling
      // supplied for the old reply no longer describes the entire utterance.
      frWritten: null,
      // No English yet (an early, provisional reply) stays no English: half
      // a translation would describe only the echo, not what was said.
      en: view.sceneReply.en.trim() === '' ? '' : 'Ah, ' + closed(finding.betterEn) + ' ' + view.sceneReply.en,
    } },
  };
}
