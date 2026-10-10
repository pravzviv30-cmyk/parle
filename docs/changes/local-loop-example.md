# Local loop smoke example

- Status: ready to preview
- Owner: local runner, after user review

Prove that the local CLI can make one bounded change and that the runner checks
its result. This example has no product or account behaviour to change. Run it
from a clean dedicated checkout after committing this plan.

```luvani-loop
{
  "version": 1,
  "tasks": [
    {
      "id": "T1",
      "goal": "Create docs/loop-smoke.md with exactly the line 'Local loop smoke check passed.' followed by a newline. Do not change any other file.",
      "dependsOn": [],
      "files": ["docs/loop-smoke.md"],
      "checks": [["node", "--input-type=module", "-e", "import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs'; assert.equal(readFileSync('docs/loop-smoke.md', 'utf8'), 'Local loop smoke check passed.\\n');"]]
    }
  ]
}
```

## Execution log

Not run against a real model. The runner's automated tests use a temporary Git
repository and a fake local CLI to verify task ordering, failure handling and
resume. Preview this contract with `npm run loop -- --plan docs/changes/local-loop-example.md --dry-run`.
