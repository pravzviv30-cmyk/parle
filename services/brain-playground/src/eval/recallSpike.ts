/**
 * Recall spike: do embeddings pick better learner memories for a scene than the
 * lexical scorer in packages/brain/src/profile/recall.ts?
 *
 *   npm run eval:recall -w @luvani/brain-playground
 *
 * Needs OPENAI_API_KEY (node --env-file=... or exported). Sends OpenAI only the
 * invented text in recallSpikeFixtures.ts. Makes one embeddings request.
 *
 * Three rankers over each learner's pooled items (facts, then patterns, then
 * summaries), top 3 per scene:
 *   lexical    recallTerms overlap with the scene, ties broken later item first
 *   embedding  cosine similarity of text-embedding-3-small vectors
 *   hybrid     0.5 * lexical / max lexical in the scene + 0.5 * cosine
 *
 * Decision rule, fixed before the first run: embeddings justify a later build
 * only if they beat lexical by 15+ points recall@3 on the gap cases without
 * losing on the overlap cases.
 *
 * Exit codes: 0 ran, 1 an API call failed or the key is missing.
 */

import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { recallTerms } from '@luvani/brain';

import { LEARNERS, SCENES, type Learner, type Scene } from './recallSpikeFixtures.ts';

const MODEL = 'text-embedding-3-small';
const TOP = 3;
const MARGIN_POINTS = 15;

interface Item { id: string; text: string }
type RankerName = 'lexical' | 'embedding' | 'hybrid';
const RANKERS: RankerName[] = ['lexical', 'embedding', 'hybrid'];

function itemsOf(l: Learner): Item[] {
  return [
    ...l.facts.map((x) => ({ id: x.id, text: `${x.en} ${x.fr ?? ''}`.trim() })),
    ...l.patterns.map((x) => ({ id: x.id, text: `${x.tag} ${x.example}` })),
    ...l.summaries.map((x) => ({ id: x.id, text: `${x.title} ${x.summary} ${x.topics.join(' ')}` })),
  ];
}

function shared(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Ids of the top `n` items by score, ties broken later item first. */
function top(items: Item[], scores: number[], n: number): string[] {
  return items
    .map((it, i) => ({ id: it.id, score: scores[i]!, i }))
    .sort((a, b) => b.score - a.score || b.i - a.i)
    .slice(0, n)
    .map((x) => x.id);
}

interface EmbedResult { vectors: number[][]; tokens: number; ms: number }

/** One request for every text. Fails loudly: a non-OK answer throws with the status and the API's own message. */
async function embed(texts: string[], apiKey: string): Promise<EmbedResult> {
  const started = Date.now();
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, input: texts }),
  });
  const ms = Date.now() - started;
  const body = (await res.json().catch(() => null)) as {
    data?: Array<{ index: number; embedding: number[] }>;
    usage?: { total_tokens?: number; prompt_tokens?: number };
    error?: { message?: string; type?: string; code?: string };
  } | null;
  if (!res.ok || !body?.data) {
    const why = body?.error ? `${body.error.type ?? 'error'}: ${body.error.message ?? ''}` : 'no error body';
    throw new Error(`embeddings request failed (HTTP ${res.status}, model ${MODEL}): ${why.slice(0, 300)}`);
  }
  const vectors = [...body.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  if (vectors.length !== texts.length) throw new Error(`embeddings returned ${vectors.length} vectors for ${texts.length} texts`);
  return { vectors, tokens: body.usage?.total_tokens ?? body.usage?.prompt_tokens ?? 0, ms };
}

interface CaseResult {
  scene: Scene;
  picks: Record<RankerName, string[]>;
  recall: Record<RankerName, number>;
}

function rankScene(scene: Scene, items: Item[], itemVecs: number[][], sceneVec: number[]): CaseResult {
  const sceneTerms = recallTerms([scene.scene]);
  const lex = items.map((it) => shared(recallTerms([it.text]), sceneTerms));
  const cos = itemVecs.map((v) => cosine(v, sceneVec));
  const maxLex = Math.max(...lex);
  const hyb = lex.map((l, i) => 0.5 * (maxLex > 0 ? l / maxLex : 0) + 0.5 * cos[i]!);
  const picks = { lexical: top(items, lex, TOP), embedding: top(items, cos, TOP), hybrid: top(items, hyb, TOP) };
  const hit = (ids: string[]) => scene.gold.filter((g) => ids.includes(g)).length / scene.gold.length;
  return {
    scene,
    picks,
    recall: { lexical: hit(picks.lexical), embedding: hit(picks.embedding), hybrid: hit(picks.hybrid) },
  };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x: number) => `${(x * 100).toFixed(1)}`.padStart(6);

async function main(): Promise<number> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set.');
    return 1;
  }

  const poolByLearner = new Map<string, Item[]>(LEARNERS.map((l) => [l.id, itemsOf(l)]));
  // Every text goes in one request: all items of all learners, then all scenes.
  const itemTexts: string[] = [];
  const itemOffset = new Map<string, number>();
  for (const l of LEARNERS) {
    itemOffset.set(l.id, itemTexts.length);
    for (const it of poolByLearner.get(l.id)!) itemTexts.push(it.text);
  }
  const texts = [...itemTexts, ...SCENES.map((s) => s.scene)];

  let result: EmbedResult;
  try {
    result = await embed(texts, apiKey);
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'embeddings request failed');
    return 1;
  }

  const cases = SCENES.map((scene, k) => {
    const items = poolByLearner.get(scene.learnerId)!;
    const from = itemOffset.get(scene.learnerId)!;
    return rankScene(scene, items, result.vectors.slice(from, from + items.length), result.vectors[itemTexts.length + k]!);
  });

  const avg = (kind: Scene['kind'] | 'all', r: RankerName) =>
    mean(cases.filter((c) => kind === 'all' || c.scene.kind === kind).map((c) => c.recall[r]));

  console.log(`Recall spike: ${SCENES.length} scenes, ${LEARNERS.length} learners, ${texts.length} texts, model ${MODEL}`);
  console.log(`\nrecall@${TOP} (percent of gold items found in the top ${TOP}, averaged)\n`);
  console.log('ranker       overlap     gap     all');
  for (const r of RANKERS) {
    console.log(`${r.padEnd(11)}  ${pct(avg('overlap', r))}  ${pct(avg('gap', r))}  ${pct(avg('all', r))}`);
  }

  console.log('\nCases that missed at least one gold item (picks per ranker)');
  for (const c of cases) {
    if (RANKERS.every((r) => c.recall[r] === 1)) continue;
    console.log(`\n[${c.scene.kind}] ${c.scene.learnerId}: ${c.scene.scene}`);
    console.log(`  gold       ${c.scene.gold.join(', ')}`);
    for (const r of RANKERS) {
      console.log(`  ${r.padEnd(10)} ${c.picks[r].join(', ')}  (${c.scene.gold.filter((g) => c.picks[r].includes(g)).length}/${c.scene.gold.length})`);
    }
  }

  console.log('\nCost and latency');
  console.log(`  embeddings requests: 1 (${texts.length} texts)`);
  console.log(`  embedding tokens:    ${result.tokens}`);
  console.log(`  latency per request: ${result.ms} ms`);

  const gapDelta = (avg('gap', 'embedding') - avg('gap', 'lexical')) * 100;
  const overlapDelta = (avg('overlap', 'embedding') - avg('overlap', 'lexical')) * 100;
  const beatsOnGap = gapDelta >= MARGIN_POINTS;
  const holdsOnOverlap = overlapDelta >= 0;
  console.log('\nDecision rule: embeddings justify a build only if they beat lexical by');
  console.log(`${MARGIN_POINTS}+ points recall@${TOP} on gap cases without losing on overlap cases.`);
  console.log(`  gap:     embedding minus lexical = ${gapDelta.toFixed(1)} points  ${beatsOnGap ? 'ok' : 'not enough'}`);
  console.log(`  overlap: embedding minus lexical = ${overlapDelta.toFixed(1)} points  ${holdsOnOverlap ? 'ok' : 'LOSES'}`);
  console.log(`  verdict: ${beatsOnGap && holdsOnOverlap ? 'PASS' : 'FAIL'}`);
  const hybridGap = (avg('gap', 'hybrid') - avg('gap', 'lexical')) * 100;
  const hybridOverlap = (avg('overlap', 'hybrid') - avg('overlap', 'lexical')) * 100;
  console.log(`  (for reference, hybrid minus lexical: gap ${hybridGap.toFixed(1)}, overlap ${hybridOverlap.toFixed(1)} points)`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().then((code) => process.exit(code));
}
