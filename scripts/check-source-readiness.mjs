/**
 * Read-only clean-checkout diagnostics. This is not project:check or acceptance.
 * Missing generated or historical files are reported, never produced or waived.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, isAbsolute, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');

export function inspectSourceReadiness(root = ROOT) {
  const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  const status = read('project/status.json');
  const pkg = read('package.json');
  const coverage = read('specs/v0.1/coverage/games.json');
  const baseline = read('project/acceptance-baseline.json');
  const delivery = read('project/phase2-delivery.json');
  const sdk = read('project/sdk-lock.json');
  const evidence = read('project/evidence-lock.json');
  const count = (path, suffix) => readdirSync(resolve(root, path)).filter(name => name.endsWith(suffix)).length;
  const games = count('specs/v0.1/games', '.game.json');
  const capabilities = count('specs/v0.1/capabilities', '.capability.json');
  const frozenIds = Array.from({length: 32}, (_, i) => `G${String(i + 1).padStart(2, '0')}`);
  const acceptanceIds = [...frozenIds, 'H01', 'H02', 'H03', 'H04', 'H05'];
  const matchingIds = (actual, expected) => Array.isArray(actual)
    && JSON.stringify([...actual].sort()) === JSON.stringify(expected);
  const errors = [];
  if (pkg.version !== status.release.version) errors.push('RELEASE_VERSION_MISMATCH');
  if (!matchingIds(coverage.games.map(row => row.id), frozenIds) || status.coverage.plannedGames !== 32)
    errors.push('FROZEN_COVERAGE_DRIFT');
  if (!matchingIds(baseline.ids, acceptanceIds)) errors.push('FROZEN_ACCEPTANCE_SCOPE_DRIFT');
  if (games !== status.coverage.referenceDemoGames || capabilities !== status.coverage.referenceCapabilityManifests)
    errors.push('REFERENCE_COUNTS_DRIFT');

  const presence = (kind, path) => {
    if (typeof path !== 'string' || !path || isAbsolute(path) || /[\\]/.test(path))
      throw new Error(`Invalid prerequisite path: ${kind}`);
    const target = resolve(root, path);
    const local = relative(root, target);
    if (!local || local === '..' || local.startsWith('..' + sep) || isAbsolute(local))
      throw new Error(`Invalid prerequisite path: ${kind}`);
    return { kind, path, state: existsSync(target) ? 'PRESENT_NOT_VALIDATED' : 'MISSING' };
  };
  const g3Plan = presence('historical_g3_plan', status.independentG3Run.plan);
  const sdkFiles = ['three.module.js', 'three.core.js', 'cocosair.js', 'sdk-provenance.json']
    .map(name => presence('prepared_sdk_artifact', `player/vendor/${name}`));
  const license = readFileSync(resolve(root, 'LICENSE'), 'utf8').startsWith('MIT License') ? 'MIT' : 'UNDETERMINED';
  return {
    format: 'a2game-source-readiness', version: 1,
    status: errors.length ? 'SOURCE_METADATA_DRIFT' : 'SOURCE_PREFLIGHT_PASS',
    releaseAcceptance: 'NOT_EVALUATED',
    browserOrDeviceExecution: 'NOT_RUN',
    errors,
    source: { release: pkg.version, frozenGames: 32, frozenHybridAcceptance: 5, referenceGames: games, referenceCapabilities: capabilities },
    g3: {
      recordedStatus: status.independentG3Run.status,
      recordedIndependentPasses: status.independentG3Run.independentG3Passed,
      plan: g3Plan,
      restore: { command: 'npm run evidence:restore -- <trusted-archive>', lockedArchiveSha256: evidence.archiveSha256,
        note: 'Locate the matching authorized archive. Do not generate replacement historical evidence.' },
    },
    sdk: {
      threeVersion: sdk.three.version, cocosairjsCommit: sdk.cocosairjs.commit, files: sdkFiles,
      preparation: 'npm ci; provide the pinned CocosAirJS checkout/build via A2GAME_AIR_ROOT; npm run sdk:prepare',
      note: 'Artifact presence alone does not verify provenance or demonstrate playback.',
    },
    distribution: {
      recordedPhase2State: delivery.status,
      rootLicenseDocument: license,
      npmMetadataLicense: pkg.license ?? null,
      licenseTextReview: license === pkg.license ? 'DECLARATION_MATCH' : 'DECLARATION_REVIEW_REQUIRED',
      note: 'Source metadata comparison only. Newly prepared SDK packages and actual hosted/browser evidence must be checked separately.',
    },
    strictGates: ['npm run project:check', 'npm run verify', 'node scripts/g3-codex-report.mjs --check', 'npm run acceptance:ready'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 2) throw new Error('Usage: node scripts/check-source-readiness.mjs');
    const result = inspectSourceReadiness();
    console.log(JSON.stringify(result, null, 2));
    if (result.errors.length) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
