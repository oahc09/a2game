import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const json = (path) => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const sequence = (kind, first, last) =>
  Array.from({length: last - first + 1}, (_, index) =>
    kind + String(first + index).padStart(2, '0'));

test('expansion planning inventory covers only new IDs, not the formal registry', () => {
  const ledger = json('project/expansion-targets.json');
  const original = json(ledger.originalRegistry);
  const expected = [...sequence('G', 33, 192), ...sequence('H', 6, 32)].sort();
  assert.deepEqual(ledger.targets.map((row) => row.id).sort(), expected);
  const baseline = json("project/acceptance-baseline.json").ids.slice().sort();
  assert.deepEqual(original.games.map((row) => row.id).sort(), sequence("G", 1, 32));
  assert.deepEqual(baseline, [...sequence('G', 1, 32), ...sequence('H', 1, 5)].sort());
  assert.match(ledger.source.assessmentSha256, /^[\da-f]{64}$/);
  assert.deepEqual(ledger.next, ['G35', 'G41', 'G59']);
  for (const row of ledger.targets) {
    assert.deepEqual(Object.keys(row).sort(), [
      'id', 'kind', 'status', 'suggestedAcceptanceProfile', 'targetGroup', 'title',
    ]);
    assert.match(row.targetGroup, /^(T(0[1-9]|1[0-9]|20)|HYBRID)$/);
    assert.equal(row.kind, row.id.startsWith('G') ? 'game' : 'hybrid');
  }
});
