import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { inspectSourceReadiness } from '../scripts/check-source-readiness.mjs';

const root = resolve(import.meta.dirname, '..');
const trackedInputs = ['project/status.json', 'package.json', 'project/acceptance-baseline.json',
  'project/phase2-delivery.json', 'project/sdk-lock.json', 'project/evidence-lock.json',
  'specs/v0.1/coverage/games.json', 'specs/v0.1/games', 'specs/v0.1/capabilities', 'LICENSE'];

function sourceFixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'a2game-source-readiness-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  for (const path of trackedInputs) {
    mkdirSync(dirname(join(dir, path)), {recursive: true});
    cpSync(join(root, path), join(dir, path), {recursive: true});
  }
  return dir;
}

test('source-only readiness exposes missing prerequisites without claiming strict acceptance', t => {
  const dir = sourceFixture(t);
  const summary = inspectSourceReadiness(dir);
  assert.equal(summary.status, 'SOURCE_PREFLIGHT_PASS');
  assert.equal(summary.releaseAcceptance, 'NOT_EVALUATED');
  assert.equal(summary.browserOrDeviceExecution, 'NOT_RUN');
  assert.equal(summary.source.frozenGames, 32);
  assert.equal(summary.source.frozenHybridAcceptance, 5);
  assert.equal(summary.g3.plan.state, 'MISSING');
  assert.match(summary.g3.restore.lockedArchiveSha256, /^[a-f0-9]{64}$/);
  assert(summary.sdk.files.every(file => file.state === 'MISSING'));
  assert(summary.strictGates.includes('npm run project:check'));
  const plan = join(dir, summary.g3.plan.path);
  mkdirSync(dirname(plan), {recursive: true});
  writeFileSync(plan, '{}');
  assert.equal(inspectSourceReadiness(dir).g3.plan.state, 'PRESENT_NOT_VALIDATED');
  assert.equal(inspectSourceReadiness(dir).releaseAcceptance, 'NOT_EVALUATED');
});

test('source readiness detects frozen roster drift and refuses out-of-root pointers', t => {
  const dir = sourceFixture(t);
  const baselinePath = join(dir, 'project/acceptance-baseline.json');
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  baseline.ids[0] = 'G33';
  writeFileSync(baselinePath, JSON.stringify(baseline));
  const status = inspectSourceReadiness(dir);
  assert.equal(status.status, 'SOURCE_METADATA_DRIFT');
  assert(status.errors.includes('FROZEN_ACCEPTANCE_SCOPE_DRIFT'));
  const statusPath = join(dir, 'project/status.json');
  const source = JSON.parse(readFileSync(statusPath, 'utf8'));
  source.independentG3Run.plan = '../unrelated.json';
  writeFileSync(statusPath, JSON.stringify(source));
  assert.throws(() => inspectSourceReadiness(dir), /Invalid prerequisite path/);
});

test('standalone diagnostic is runnable without npm build and rejects unsupported flags', () => {
  const script = join(root, 'scripts/check-source-readiness.mjs');
  const diagnostic = spawnSync(process.execPath, [script], {cwd: tmpdir(), encoding: 'utf8'});
  assert.equal(diagnostic.status, 0, diagnostic.stderr);
  assert.equal(JSON.parse(diagnostic.stdout).releaseAcceptance, 'NOT_EVALUATED');
  const invalid = spawnSync(process.execPath, [script, '--accept'], {encoding: 'utf8'});
  assert.notEqual(invalid.status, 0);
});
