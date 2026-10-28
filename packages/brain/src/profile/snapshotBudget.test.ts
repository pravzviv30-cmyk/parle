import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ERROR_PATTERNS, MAX_MEMORY_FACTS, MAX_PHRASES, applyTurnToProfile, createProfile, finishSession, patternStatus, type LearnerProfile } from './profile.ts';
import { sampleTurn } from '../contract/samples.ts';
import { createConversation } from '../engine/conversation.ts';
import { CAFE_FRAME } from '../fixtures.ts';
import { SNAPSHOT_MAX_BYTES, SNAPSHOT_MAX_EXAMPLE_CHARS, SNAPSHOT_MAX_PHRASE_CHARS, fitSnapshot, keepUnsent, snapshotBytes } from './snapshotBudget.ts';

type Snapshot = LearnerProfile & { reviewFocus?: unknown[]; previousCorrection?: unknown };

const FR = ["Je vous dois combien ?", "Un croissant, s'il vous plaît.", "Est-ce que vous pourriez répéter plus lentement ?", "J'aimerais réserver une table pour deux personnes.", 'Bonne journée !', "Je ne suis pas sûr d'avoir bien compris."];
const EN = ['How much do I owe you?', 'A croissant, please.', 'Could you repeat more slowly?', "I'd like to book a table for two.", 'Have a good day!', "I'm not sure I understood."];

const day = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString();

/**
 * A heavy learner: every count at its cap, text at realistic French lengths.
 * `worst` puts every string at the cap the writers enforce today (phrases are
 * not capped at all, so it uses the fitted cap; examples at 160).
 */
function heavy(worst = false): Snapshot {
  const p = createProfile() as Snapshot;
  const long = (n: number) => 'é'.repeat(n);
  for (let i = 0; i < MAX_PHRASES; i++) {
    const fr = worst ? `${i} ${long(SNAPSHOT_MAX_PHRASE_CHARS - 4)}` : `${FR[i % FR.length]} (${i})`;
    p.phrases[fr.toLowerCase()] = {
      fr, frWritten: worst ? long(SNAPSHOT_MAX_PHRASE_CHARS) : null, en: worst ? long(SNAPSHOT_MAX_PHRASE_CHARS) : EN[i % EN.length]!,
      register: 'courant', introducedAt: day(i), timesUsedWell: i % 5, timesAssisted: i % 2, mastered: i % 3 === 0,
    };
  }
  for (let i = 0; i < MAX_ERROR_PATTERNS; i++) {
    p.errorPatterns[`pattern-tag-${i}`] = { count: 3, lastSeen: day(i), example: worst ? long(SNAPSHOT_MAX_EXAMPLE_CHARS) : "j'ai allé au marché hier avec mon frère", sessions: i % 2 ? 1 : 3, lastSession: 9 };
  }
  for (let i = 0; i < MAX_MEMORY_FACTS; i++) {
    p.memory.facts.push({ en: `Has a job interview next week number ${i}`.padEnd(worst ? 120 : 40, '.'), fr: worst ? long(120) : undefined, happensAround: worst ? long(120) : undefined, notedAt: day(i) } as never);
  }
  p.memory.opener = { fr: 'Alors, cet entretien ?', en: 'So, that interview?' };
  p.memory.name = 'Sam';
  p.stats = { sessions: 40, totalTurns: 900, rescues: 12, lastRung: 2 };
  p.reviewFocus = [0, 1, 2].map(i => ({ phraseKey: `k${i}`, fr: worst ? long(240) : FR[i], ask: worst ? long(240) : 'Say it once' }));
  p.previousCorrection = { said: 'je suis allé', better: "j'y suis allé", why: worst ? long(240) : 'y replaces the place' };
  return p;
}

describe('the snapshot byte budget', () => {
  test('measurements: a heavy learner and the worst case are both over budget, and both fit', () => {
    const h = snapshotBytes(heavy());
    const w = snapshotBytes(heavy(true));
    const fh = fitSnapshot(heavy());
    console.log(`[snapshotBudget] heavy ${h} bytes, worst ${w} bytes, budget ${SNAPSHOT_MAX_BYTES}, heavy fitted ${snapshotBytes(fh)} with ${Object.keys(fh.phrases).length} phrases`);
    assert.ok(h > SNAPSHOT_MAX_BYTES, `heavy ${h}`);
    assert.ok(w > SNAPSHOT_MAX_BYTES, `worst ${w}`);
    assert.ok(snapshotBytes(fh) <= SNAPSHOT_MAX_BYTES);
    const light = createProfile();
    assert.deepEqual(fitSnapshot(light), light, 'a learner under budget goes as is');
  });

  test('fitSnapshot brings the worst case under budget without touching memory, stats or extras', () => {
    const input = heavy(true);
    const before = structuredClone(input);
    const fitted = fitSnapshot(input);
    assert.deepEqual(input, before, 'never mutates');
    assert.ok(snapshotBytes(fitted) <= SNAPSHOT_MAX_BYTES);
    for (const k of ['memory', 'cefr', 'stats', 'preferences', 'reviewFocus', 'previousCorrection'] as const) assert.deepEqual(fitted[k], input[k], k);
    assert.deepEqual(fitSnapshot(heavy(true)), fitted, 'deterministic');
  });

  test('long text is clamped, by characters', () => {
    const p = createProfile();
    p.phrases.x = { fr: 'a'.repeat(500), frWritten: null, en: '😀'.repeat(300), register: 'courant', introducedAt: day(1), timesUsedWell: 0, timesAssisted: 0, mastered: false };
    p.errorPatterns.t = { count: 1, lastSeen: day(1), example: 'b'.repeat(1000), sessions: 1, lastSession: 1 };
    const f = fitSnapshot(p);
    assert.equal(f.phrases.x!.fr.length, SNAPSHOT_MAX_PHRASE_CHARS);
    assert.equal(Array.from(f.phrases.x!.en).length, SNAPSHOT_MAX_PHRASE_CHARS);
    assert.equal(f.errorPatterns.t!.example.length, SNAPSHOT_MAX_EXAMPLE_CHARS);
  });

  test('drop order: mastered phrases oldest first, then unmastered, then suspected patterns; recurring stay', () => {
    // Pad an extra field (never dropped) so that removing every phrase and
    // some, not all, suspected patterns is exactly what fits.
    const p = heavy(true);
    const floor = snapshotBytes({ ...p, phrases: {}, errorPatterns: Object.fromEntries(Object.entries(p.errorPatterns).filter(([, e]) => e.sessions >= 2)) });
    const suspectedBytes = snapshotBytes(p.errorPatterns) - snapshotBytes(Object.fromEntries(Object.entries(p.errorPatterns).filter(([, e]) => e.sessions >= 2)));
    p.reviewFocus = [...p.reviewFocus!, 'x'.repeat(SNAPSHOT_MAX_BYTES - floor - Math.floor(suspectedBytes / 2))];
    const f = fitSnapshot(p);
    assert.ok(snapshotBytes(f) <= SNAPSHOT_MAX_BYTES);
    assert.equal(Object.keys(f.phrases).length, 0, 'every phrase went before any pattern');
    const droppedPatterns = Object.entries(p.errorPatterns).filter(([t]) => !f.errorPatterns[t]).map(([, e]) => e);
    const keptSuspected = Object.values(f.errorPatterns).filter(e => e.sessions < 2);
    assert.ok(droppedPatterns.length > 0 && keptSuspected.length > 0, 'some suspected patterns went, some stayed');
    assert.ok(droppedPatterns.every(e => e.sessions < 2), 'only suspected patterns are dropped');
    const newestDropped = droppedPatterns.map(e => e.lastSeen).sort().at(-1)!;
    assert.ok(keptSuspected.every(e => e.lastSeen > newestDropped), 'least recent lastSeen first');
    for (const [tag, e] of Object.entries(p.errorPatterns)) if (e.sessions >= 2) assert.ok(f.errorPatterns[tag], `recurring ${tag} kept`);

    const q = heavy(true);
    const g = fitSnapshot(q);
    const left = Object.values(g.phrases);
    const gone = Object.entries(q.phrases).filter(([k]) => !g.phrases[k]).map(([, e]) => e);
    assert.ok(gone.length > 0 && left.length > 0);
    if (left.some(e => e.mastered)) assert.ok(gone.every(e => e.mastered), 'unmastered only go after every mastered one');
    const newestGone = gone.filter(e => e.mastered).map(e => e.introducedAt).sort().at(-1)!;
    assert.ok(left.filter(e => e.mastered).every(e => e.introducedAt > newestGone), 'oldest mastered first');
    assert.equal(Object.keys(g.errorPatterns).length, MAX_ERROR_PATTERNS, 'patterns untouched while phrases can cover it');
  });

  test('junk shapes never throw', () => {
    for (const junk of [{}, { phrases: 'x' }, { phrases: { a: 1 }, errorPatterns: [] }, { phrases: { a: { introducedAt: 3 } }, pad: 'x'.repeat(60_000) }]) {
      assert.doesNotThrow(() => fitSnapshot(junk as never));
    }
  });
});

describe('keepUnsent', () => {
  test('round trip: fit, recap with one new phrase, keepUnsent loses nothing and the caps hold', () => {
    const current = heavy(true);
    const sent = fitSnapshot(current);
    assert.ok(Object.keys(sent.phrases).length < MAX_PHRASES);
    // The agent's profile: the fitted snapshot, one phrase used again, one new phrase learned.
    const recap: LearnerProfile = structuredClone(sent);
    const usedKey = Object.keys(recap.phrases)[0]!;
    recap.phrases[usedKey]!.timesUsedWell = 99;
    recap.phrases['nouvelle'] = { fr: 'Nouvelle', frWritten: null, en: 'New', register: 'courant', introducedAt: day(500), timesUsedWell: 0, timesAssisted: 0, mastered: false };
    const back = keepUnsent(current, recap);
    assert.equal(Object.keys(back.phrases).length, MAX_PHRASES, 'capped at 200');
    assert.ok(back.phrases['nouvelle'], 'the new phrase is kept');
    assert.equal(back.phrases[usedKey]!.timesUsedWell, 99, 'an entry in both keeps the recap version');
    // 201 phrases: the cap evicts exactly one, the oldest unmastered, as it always has.
    const evicted = Object.keys(current.phrases).filter(k => !back.phrases[k]);
    assert.equal(evicted.length, 1);
    assert.equal(current.phrases[evicted[0]!]!.mastered, false);
    assert.equal(Object.keys(back.errorPatterns).length, MAX_ERROR_PATTERNS);
    assert.deepEqual(back.memory, recap.memory, 'memory is the recap\'s');
  });

  test('a round trip under the cap loses no phrase at all, and clamped text comes back whole', () => {
    const current = heavy(true);
    delete current.phrases[Object.keys(current.phrases)[5]!];
    const longKey = Object.keys(current.phrases)[10]!;
    current.phrases[longKey]!.en = 'z'.repeat(400);
    current.errorPatterns['pattern-tag-1']!.example = 'y'.repeat(400);
    const recap = structuredClone(fitSnapshot(current)) as LearnerProfile;
    recap.phrases['nouvelle'] = { fr: 'Nouvelle', frWritten: null, en: 'New', register: 'courant', introducedAt: day(500), timesUsedWell: 0, timesAssisted: 0, mastered: false };
    const back = keepUnsent(current, recap);
    for (const k of Object.keys(current.phrases)) assert.ok(back.phrases[k], k);
    assert.ok(back.phrases['nouvelle']);
    assert.equal(back.phrases[longKey]!.en, 'z'.repeat(400));
    assert.equal(back.errorPatterns['pattern-tag-1']!.example, 'y'.repeat(400));
    for (const k of Object.keys(current.phrases)) assert.equal(back.phrases[k]!.fr, current.phrases[k]!.fr);
  });

  test('a recap that rewrote an example keeps its new example', () => {
    const current = createProfile();
    current.errorPatterns.t = { count: 1, lastSeen: day(1), example: 'old', sessions: 1, lastSession: 1 };
    const recap = structuredClone(current);
    recap.errorPatterns.t!.example = 'new';
    assert.equal(keepUnsent(current, recap).errorPatterns.t!.example, 'new');
  });

  const ended = () => createConversation(CAFE_FRAME, { cefr: 'A2', confidence: 'low', watchFor: [], lastRung: null, sessions: 0, name: null }, { strictness: 'balanced', maxTurns: 24 }, 1_000);
  const reintroduce = sampleTurn({
    newPhrases: [{ fr: "j'sais pas", frWritten: 'je sais pas', en: "I don't know", enLiteral: null, register: 'courant', note: null }],
    profileSignals: { errorPatterns: [{ tag: 'gender-agreement', example: 'le maison' }], usedWell: [] },
  } as never);

  /** A heavy learner holding a mastered phrase and a suspected pattern that fitting leaves out. */
  function learnerWithDroppedEntries(): Snapshot {
    const p = heavy(true);
    p.phrases['je sais pas'] = { fr: "j'sais pas", frWritten: 'je sais pas', en: "I don't know", register: 'courant', introducedAt: '2025-01-01T00:00:00.000Z', timesUsedWell: 5, timesAssisted: 1, mastered: true };
    p.errorPatterns['gender-agreement'] = { count: 2, lastSeen: '2025-01-01T00:00:00.000Z', example: 'la garçon', sessions: 1, lastSession: 30 };
    delete p.errorPatterns['pattern-tag-0'];
    // Pad a field that always rides so the fit reaches the suspected patterns.
    const floor = snapshotBytes({ ...p, phrases: {}, errorPatterns: Object.fromEntries(Object.entries(p.errorPatterns).filter(([, e]) => e.sessions >= 2)) });
    p.reviewFocus = [...p.reviewFocus!, 'x'.repeat(SNAPSHOT_MAX_BYTES - floor - 2000)];
    return p;
  }

  test('a dropped mastered phrase the session reintroduced stays mastered with its old uses', () => {
    const current = learnerWithDroppedEntries();
    const sent = fitSnapshot(current);
    assert.equal(sent.phrases['je sais pas'], undefined, 'the fixture drops the mastered phrase');
    const recap = finishSession(applyTurnToProfile(structuredClone(sent), reintroduce, '2026-10-28T10:00:00.000Z'), ended());
    assert.equal(recap.phrases['je sais pas']!.timesUsedWell, 0, 'the brain reintroduced it fresh');
    const back = keepUnsent(current, recap).phrases['je sais pas']!;
    assert.equal(back.mastered, true);
    assert.equal(back.timesUsedWell, 5);
    assert.equal(back.timesAssisted, 1);
    assert.equal(back.introducedAt, '2025-01-01T00:00:00.000Z');
  });

  test('a dropped suspected pattern seen again in a new session becomes recurring', () => {
    const current = learnerWithDroppedEntries();
    const sent = fitSnapshot(current);
    assert.equal(sent.errorPatterns['gender-agreement'], undefined, 'the fixture drops the suspected pattern');
    const recap = finishSession(applyTurnToProfile(structuredClone(sent), reintroduce, '2026-10-28T10:00:00.000Z'), ended());
    assert.equal(recap.errorPatterns['gender-agreement']!.sessions, 1);
    const back = keepUnsent(current, recap).errorPatterns['gender-agreement']!;
    assert.equal(back.sessions, 2);
    assert.equal(back.count, 3);
    assert.equal(patternStatus(back), 'recurring');
    assert.equal(back.lastSession, recap.errorPatterns['gender-agreement']!.lastSession);
  });

  test('a sent phrase credited in session and a sent pattern seen again are not double counted', () => {
    const current = createProfile();
    current.stats.sessions = 7;
    current.phrases.x = { fr: 'x', frWritten: null, en: 'x', register: 'courant', introducedAt: day(1), timesUsedWell: 2, timesAssisted: 0, mastered: false };
    current.errorPatterns.t = { count: 2, lastSeen: day(1), example: 'e', sessions: 1, lastSession: 3 };
    const recap = structuredClone(current);
    recap.phrases.x!.timesUsedWell = 3;
    recap.phrases.x!.mastered = true;
    recap.errorPatterns.t = { count: 3, lastSeen: day(2), example: 'f', sessions: 2, lastSession: 7 };
    const back = keepUnsent(current, recap);
    assert.deepEqual(back.phrases.x, recap.phrases.x);
    assert.deepEqual(back.errorPatterns.t, recap.errorPatterns.t);
    const unseen = structuredClone(current);
    assert.deepEqual(keepUnsent(current, unseen).errorPatterns.t, current.errorPatterns.t, 'sent and not seen again stays as is');
  });
});

