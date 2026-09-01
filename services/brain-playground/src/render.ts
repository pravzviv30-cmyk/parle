/**
 * Terminal rendering. Coach first, then the scene reply — a quick beat of
 * coaching, then straight back into the conversation, the same order the
 * voice pipeline will speak them one day.
 */

import type {
  CoachItem,
  LearnerProfile,
  NewPhrase,
  RescueView,
  ScenarioFrame,
  SessionRecap,
  SupportView,
  TurnView,
} from '@luvani/brain';

const useColor = process.env.NO_COLOR === undefined && process.stdout.isTTY === true;

function paint(code: string, text: string): string {
  return useColor ? `[${code}m${text}[0m` : text;
}

const ui = {
  title: (s: string) => paint('1', s),
  speaker: (s: string) => paint('1;36', s),
  scene: (s: string) => paint('36', s),
  gloss: (s: string) => paint('2', s),
  coach: (s: string) => paint('33', s),
  aide: (s: string) => paint('32', s),
  phrase: (s: string) => paint('35', s),
  meta: (s: string) => paint('2', s),
  warm: (s: string) => paint('1;32', s),
};

const RUNG_NAMES: Record<number, string> = { 1: 'Echo', 2: 'Cued', 3: 'Prompted', 4: 'Free' };

function rungLine(rung: number): string {
  const dots = '●'.repeat(rung) + '○'.repeat(4 - rung);
  return ui.meta(`${dots} rung ${rung} of 4 · ${RUNG_NAMES[rung]}`);
}

function coachDetail(item: CoachItem): string[] {
  const written = item.betterWritten ? ` (write: ${item.betterWritten})` : '';
  const lines = [`  · "${item.quote}" -> ${ui.coach(`"${item.better}"`)}${written} = ${item.betterEn}`];
  if (item.why.length > 0) lines.push(ui.gloss(`    ${item.why}`));
  return lines;
}

function phraseLine(p: NewPhrase): string {
  const written = p.frWritten ? ` (write: ${p.frWritten})` : '';
  const literal = p.enLiteral ? ` (literally: ${p.enLiteral})` : '';
  const note = p.note ? ` ${ui.gloss(p.note)}` : '';
  return `  ${ui.phrase('[+]')} ${ui.phrase(p.fr)}${written} = ${p.en}${literal} [${p.register}]${note}`;
}

export function renderSupport(view: SupportView): string[] {
  switch (view.kind) {
    case 'full-line': {
      const written = view.written ? ` (write: ${view.written})` : '';
      return [`${ui.aide('[AIDE]')} say: ${ui.aide(`"${view.line}"`)}${written} = ${view.gloss}`];
    }
    case 'options':
      return [
        `${ui.aide('[AIDE]')} pick one and say it:`,
        ...view.options.map((o) => `  · ${ui.aide(`"${o.text}"`)} = ${o.en}`),
      ];
    case 'hint':
      return [`${ui.aide('[AIDE]')} ${view.hint}`];
    case 'none':
      return [];
  }
}

export function renderOpening(frame: ScenarioFrame, rung: number, supportView: SupportView): string[] {
  const lines = [
    '',
    ui.title(`— ${frame.title} · ${frame.titleEn} —`),
    ui.gloss(frame.setting),
    ui.gloss(`You are: ${frame.learnerRole}`),
    ...frame.characters.map((c) => ui.gloss(`With: ${c.name}, ${c.role} [${c.register}]`)),
    '',
    `${ui.speaker(frame.openingLine.speaker.toUpperCase())}  ${ui.scene(frame.openingLine.fr)}`,
    `${' '.repeat(frame.openingLine.speaker.length + 2)}${ui.gloss(frame.openingLine.en)}`,
    ...renderSupport(supportView),
    rungLine(rung),
    '',
  ];
  return lines;
}

export function renderTurnView(view: TurnView): string[] {
  const lines: string[] = [];

  if (view.coachLine !== null) {
    lines.push(`${ui.coach('[COACH]')} ${view.coachLine}`);
    for (const item of view.coachNow) lines.push(...coachDetail(item));
  }

  const speaker = view.sceneReply.speaker.toUpperCase();
  lines.push(`${ui.speaker(speaker)}  ${ui.scene(view.sceneReply.fr)}`);
  lines.push(`${' '.repeat(speaker.length + 2)}${ui.gloss(view.sceneReply.en)}`);

  for (const phrase of view.newPhrases) lines.push(phraseLine(phrase));
  lines.push(...renderSupport(view.supportView));
  lines.push(rungLine(view.rung));

  return lines;
}

export function renderRescue(view: RescueView): string[] {
  if (!view.rescued) return [];
  return ['', ui.warm('The tutor steps in.'), ...renderSupport(view.supportView), rungLine(view.rung)];
}

export function renderRecap(recap: SessionRecap): string[] {
  const lines = [
    '',
    ui.title('———— fin de session ————'),
    ui.warm(recap.headline),
  ];

  if (recap.wins.length > 0) {
    lines.push('', ui.title('Said like a local:'));
    for (const win of recap.wins) lines.push(`  ${ui.phrase(win)}`);
  }

  if (recap.fixes.length > 0) {
    lines.push('', ui.title('For the workbench:'));
    for (const fix of recap.fixes) lines.push(...coachDetail(fix));
  }

  if (recap.phrases.length > 0) {
    lines.push('', ui.title('Session phrasebook:'));
    for (const phrase of recap.phrases) lines.push(phraseLine(phrase));
  }

  lines.push('', `${ui.title('Next:')} ${recap.nextFocus}`);
  lines.push(
    ui.meta(
      `${recap.stats.turns} turns · ${recap.stats.rescues} rescues · ${Math.round(recap.stats.unassistedRate * 100)}% on your own · CEFR ${recap.cefr.estimate} (${recap.cefr.confidence})`,
    ),
  );
  lines.push('');
  return lines;
}

export function renderProfile(profile: LearnerProfile): string[] {
  const phrases = Object.values(profile.phrases);
  const mastered = phrases.filter((p) => p.mastered).length;
  const patterns = Object.entries(profile.errorPatterns)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  const lines = [
    '',
    ui.title('What the brain remembers:'),
    `  CEFR ${profile.cefr.estimate} (${profile.cefr.confidence} confidence, ${profile.cefr.evidence.length} readings)`,
    `  ${profile.stats.sessions} sessions · ${profile.stats.totalTurns} turns · ${profile.stats.rescues} rescues`,
    `  ${phrases.length} phrases met · ${mastered} mastered`,
    `  Strictness: ${profile.preferences.strictness}`,
  ];
  if (patterns.length > 0) {
    lines.push('  Recurring trouble:');
    for (const [tag, info] of patterns) lines.push(`    · ${tag} (${info.count}x) e.g. "${info.example}"`);
  }
  if (profile.preferences.lastScenarios.length > 0) {
    lines.push(`  Recent scenes: ${profile.preferences.lastScenarios.join(' · ')}`);
  }
  lines.push('');
  return lines;
}

export const meta = ui.meta;
export const warm = ui.warm;
export const title = ui.title;
