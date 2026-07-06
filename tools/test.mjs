#!/usr/bin/env node
// AUTHORED-BY Claude Fable 5
// Gate for the spec-companion guardrail: the worked example must VALIDATE (with quote
// fidelity against the pinned spec source), the minimal template must validate, and
// every deliberately-broken fixture must be REJECTED with the expected finding class.
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EX = resolve(HERE, '../examples');

function run(companion, extra = []) {
  const r = spawnSync(process.execPath, [resolve(HERE, 'validate.mjs'), companion, ...extra], {
    encoding: 'utf8',
  });
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
}

const cases = [
  {
    name: 'dpop-sk worked example (with quote fidelity)',
    file: `${EX}/dpop-sk/spec.statements.ttl`,
    extra: ['--spec-html', `${EX}/dpop-sk/index.html`],
    expectPass: true,
  },
  { name: 'valid minimal template', file: `${EX}/negative/valid-minimal.ttl`, expectPass: true },
  { name: 'MUST without test or gap', file: `${EX}/negative/must-without-test.ttl`, expectPass: false, marker: 'SHACL' },
  { name: 'missing testability', file: `${EX}/negative/missing-testability.ttl`, expectPass: false, marker: 'testability' },
  { name: 'anchor outside spec base', file: `${EX}/negative/bad-anchor.ttl`, expectPass: false, marker: 'G2' },
  { name: 'level/keyword mismatch', file: `${EX}/negative/wrong-level-keyword.ttl`, expectPass: false, marker: 'G3' },
  { name: 'duplicate stable id', file: `${EX}/negative/dup-id.ttl`, expectPass: false, marker: 'G1' },
  { name: 'orphan statement (not linked from the spec)', file: `${EX}/negative/orphan-statement.ttl`, expectPass: false, marker: 'orphan' },
  { name: 'sibling-prefix anchor (startsWith boundary trap)', file: `${EX}/negative/sibling-prefix-anchor.ttl`, expectPass: false, marker: 'G2' },
];

let failures = 0;
for (const c of cases) {
  const { code, out } = run(c.file, c.extra ?? []);
  const passed = code === 0;
  let ok = passed === c.expectPass;
  if (ok && !c.expectPass && c.marker && !out.includes(c.marker)) ok = false;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${c.name} (exit ${code})`);
  if (!ok) {
    failures += 1;
    console.log(out.split('\n').map((l) => `      ${l}`).join('\n'));
  }
}
if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nall tests passed');
