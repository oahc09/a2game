import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { A2GAME_RELEASE_VERSION, A2GAME_GAMESPEC_VERSION } from '../dist/index.js';
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const status=JSON.parse(readFileSync(new URL('../project/status.json',import.meta.url),'utf8'));
test('release version 1.0.0 remains independent of GameSpec 0.1.0',()=>{
  assert.equal(pkg.version,'1.0.0');
  assert.equal(A2GAME_RELEASE_VERSION,pkg.version);
  assert.equal(A2GAME_GAMESPEC_VERSION,status.release.gameSpecVersion);
  assert.equal(status.release.capabilityManifestVersion,'0.1.0');
  assert.equal(status.coverage.verifiedGames,0);
});
