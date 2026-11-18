/**
 * The one place a brain schema becomes the JSON schema a provider receives.
 *
 * zod 4.6 writes a nullable primitive as `type: ["string", "null"]`; zod 3
 * wrote `anyOf: [{ type: "string" }, { type: "null" }]`. The founder chose to
 * keep the zod 3 wire form (2026-11-18, F1258), so each `type` array goes back
 * to an `anyOf` in the same key position. Every request keeps its zod 3 bytes
 * except the scene frame: zod 4.6.7 extracts its beat object into a sixth
 * `$defs` entry, same meaning, accepted by the founder on 2026-11-18 and
 * pinned by hash in outputFormat.test.ts.
 */
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

export function outputFormat<T extends Parameters<typeof zodOutputFormat>[0]>(schema: T): ReturnType<typeof zodOutputFormat<T>> {
  const format = zodOutputFormat(schema);
  return { ...format, schema: typeArraysToAnyOf(format.schema) as typeof format.schema };
}

function typeArraysToAnyOf(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(typeArraysToAnyOf);
  if (typeof node !== 'object' || node === null) return node;
  return Object.fromEntries(Object.entries(node).map(([key, value]) =>
    key === 'type' && Array.isArray(value)
      ? ['anyOf', value.map((type) => ({ type }))]
      : [key, typeArraysToAnyOf(value)]));
}
