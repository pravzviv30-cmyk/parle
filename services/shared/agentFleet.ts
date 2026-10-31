/**
 * What makes an agent definition well formed, tested away from the filesystem.
 *
 * The fleet is markdown files and a map in scripts/gate.mjs, and the ways it
 * silently breaks are all structural: a model pin that was never added to the map, a
 * frontmatter field in the wrong order, a read-only guard that quietly grew an Edit tool.
 * None of those fail loudly. An agent with no pin still dispatches, still answers, and
 * runs on whatever model the session happened to be using.
 *
 * So the rules are pure functions over strings here, and the test does the reading. The
 * dispatching itself belongs to the harness and a test of that would be a test of Claude
 * Code.
 */

/** The four frontmatter fields every agent carries, in the order the house writes them. */
export const FRONTMATTER_FIELDS = ['name', 'description', 'tools', 'model'] as const;

/** Tools that let an agent change the repository. */
export const WRITE_TOOLS = ['Edit', 'Write'] as const;

/**
 * Agents whose role is to review rather than edit. design-architect hands over a
 * contract, work-judge and fix-verifier return a verdict, release-engineer says whether a
 * change can land, and scaling-engineer says whether it needs to scale at all. Give any of
 * them a Write and the separation between deciding and doing stops being real.
 * Excluding direct Edit/Write tools is not an OS-level prohibition on Bash writes;
 * reviews also require the stated read-only policy or an enforcing sandbox.
 */
export const READ_ONLY_AGENTS = [
  'design-architect',
  'work-judge',
  'fix-verifier',
  'release-engineer',
  'scaling-engineer',
  'repository-archaeologist',
  'social-systems-engineer',
  'qa-release-engineer',
  'backend-architect',
  'database-security-architect',
  'voice-reliability-architect',
  'deployment-architect',
  'push-reviewer',
] as const;

export type AgentFrontmatter = {
  name: string;
  description: string;
  tools: string[];
  model: string;
  /** The field keys in the order they appeared. */
  order: string[];
};

/** The frontmatter block only. A `model:` line in the prose body is not a pin. */
export function frontmatterBlock(source: string): string | null {
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return block?.[1] ?? null;
}

export function parseAgentFrontmatter(source: string): AgentFrontmatter | null {
  const head = frontmatterBlock(source);
  if (head === null) return null;

  const fields: Record<string, string> = {};
  const order: string[] = [];
  for (const line of head.split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1] as string;
    if (key in fields) continue;
    fields[key] = (kv[2] as string).trim();
    order.push(key);
  }

  return {
    name: fields.name ?? '',
    description: fields.description ?? '',
    tools: (fields.tools ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    model: fields.model ?? '',
    order,
  };
}

/**
 * Everything wrong with one agent file, as sentences. Empty means it is well formed.
 *
 * `slug` is the filename without its extension, which is the name the harness dispatches
 * by. A frontmatter `name` that disagrees with it produces an agent that cannot be called.
 */
export function agentProblems(slug: string, source: string): string[] {
  const problems: string[] = [];
  const head = parseAgentFrontmatter(source);

  if (head === null) {
    return [`${slug}: no frontmatter block, so nothing about it is configured`];
  }

  for (const field of FRONTMATTER_FIELDS) {
    if (!head.order.includes(field)) problems.push(`${slug}: no ${field} field`);
  }

  const present = head.order.filter((k) => (FRONTMATTER_FIELDS as readonly string[]).includes(k));
  const expected = FRONTMATTER_FIELDS.filter((f) => present.includes(f));
  if (present.join(',') !== expected.join(',')) {
    problems.push(`${slug}: frontmatter fields are ${present.join(', ')}, expected ${expected.join(', ')}`);
  }

  if (head.name && head.name !== slug) {
    problems.push(`${slug}: frontmatter name is ${head.name}, so it cannot be dispatched by its filename`);
  }
  if (head.tools.length === 0) problems.push(`${slug}: no tools, so it can do nothing`);
  if (!head.model) problems.push(`${slug}: no model pin, so it would inherit the session model`);

  if ((READ_ONLY_AGENTS as readonly string[]).includes(slug)) {
    for (const tool of WRITE_TOOLS) {
      if (head.tools.includes(tool)) {
        problems.push(`${slug}: is read-only by design but declares ${tool}`);
      }
    }
  }

  return problems;
}

/** The agent names pinned in scripts/gate.mjs, read out of its AGENT_MODELS block. */
export function pinnedAgents(gateSource: string): string[] {
  const block = gateSource.match(/const AGENT_MODELS = \{([\s\S]*?)\n\};/);
  if (!block) return [];
  return [...(block[1] as string).matchAll(/^\s*'([\w-]+)'\s*:/gm)].map((m) => m[1] as string);
}

/**
 * The agent names /forge routes work to, read out of its routing table.
 *
 * Every routed row names a real specialist. The learning-science specialist protects the
 * one canonical ladder rather than introducing another implementation.
 */
export function routedAgents(forgeSource: string): string[] {
  const names = new Set<string>();
  for (const row of forgeSource.matchAll(/\|\s*\*\*([\w-]+)\*\*\s*\|/g)) {
    const name = row[1] as string;
    if (name === 'you') continue;
    names.add(name);
  }
  return [...names];
}
