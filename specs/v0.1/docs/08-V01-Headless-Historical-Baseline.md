> **V0.1 Browser Bridge Slice 2（2026-10-24）**：新增完整 Schema 发布门禁、RFC 8785/SHA-256 状态哈希、三样例网页播放器、CocosAirJS/Three.js 适配器源码、Chromium Canvas2D 验证与 Node↔Chromium Hash 对照。当前状态与局限详见 [`IMPLEMENTATION-NEXT.md`](../../../IMPLEMENTATION-NEXT.md)。下面保留第一阶段 Headless 基线说明。

# A2Game V0.1 — Headless Runtime Reference Implementation

Version: `0.1.0-alpha.1` · Date: 2026-10-24 · Scope: **G0/G1 partial implementation**, not a production release.

This project implements the first usable slice of the previously approved, engine-neutral A2Game V0.1 design. The original formal specifications and benchmark candidates are bundled in `A2Game-V0.1-Spec/`. No CocosAirJS or Three.js repository has been modified, and no commits were pushed.

## Run

Requirements: Node.js 22+, TypeScript compiler (`tsc`, already available in the verification environment); Python 3 + `jsonschema` for the full supplied JSON Schema static suite.

```bash
npm run build
npm test
npm run conformance
python A2Game-V0.1-Spec/tools/validate_specs.py
```

`npm test` runs the Node test suite plus the four original conformance cases and additional algorithm/API tests. `npm run conformance` runs four JSON Conformance Suite files (7 cases) from the bundled specification + new headless samples and writes `reports/conformance.json`.

## Available source

| Location | Responsibilities |
|---|---|
| `src/registry.ts` | Trusted Capability Registry, exact-version dependencies, anyOf fallback, cycle/conflict detection and whitelist operations |
| `src/validator.ts` | Runtime semantic/structure subset: root fields, refs, states, AST, action IDs, asset URI restrictions, capability config subset |
| `src/rng.ts` | Reference xoshiro128** PRNG and unbiased inclusive integer sampling |
| `src/expression.ts` | Typed pure-expression AST evaluator (no eval/Function) |
| `src/runtime.ts` | Explicit logical Tick; input edges; timers; module proposals; frozen rule-read snapshot; ordered effects and terminal outcome; atomic publish/rollback; lifecycle and snapshot |
| `src/modules/grid-slide-merge.ts` | Engine-neutral, deterministic grid slide+merge with seeded spawn; config driven, no hardcoded game IDs |
| `src/conformance.ts` | Executes declared JSON Conformance Suite steps and emits structured PASS/FAIL receipt |
| `scripts/run-conformance.mjs` | Isolated Node CLI driver for the bundled sample suites |
| `test/core.test.mjs` | Independent Node assertions, original 7 negative fixtures, RNG vectors, rules/input/session/algorithm regression tests |
| `A2Game-V0.1-Spec/samples/games/grid-merge*.json` | Two new engine-neutral JSON-only headless puzzle examples |

## What has actually passed

- `tsc` strict TypeScript compilation.
- 36 Node `node:test` tests, including original 4 supplied Conformance cases, all 7 negative fixtures, tick conflict ordering, transactional failure, deferred events, timers, snapshot/RNG, input fallback/cancel, dynamic spawned modules, and grid merge algorithm.
- 7 cases in 4 JSON Conformance Suites (`tap-target`, `runtime-order`, `grid-merge`, `grid-merge-spawn`).
- 7 JSON Schema drafts, 8 sample capability declarations, 3 game specs, 32 benchmark candidate registry entries and 4 suites pass the Python static checker.

See `reports/` for real execution evidence. These counts are scoped to the runnable reference slice and **do not certify the entire 32-game coverage set**.

## Explicitly NOT implemented / NOT verified

- `G0`: The TypeScript loader currently validates a strict semantic/structural **subset**, not every JSON Schema 2020-12 feature. The separate Python script validates bundled samples with the full Draft 2020-12 validator; general untrusted JSON requires the production G0 gate.
- `G1`: No production board/Match3/Tetris/combat/economy/real-time movement service. The grid-slide-merge component is the first actual puzzle primitive; the 32 game categories remain candidates. Physics T5 is empty. No certified RFC 8785 JCS + SHA-256 exactHash (`observe().exactHash` is explicitly null).
- `Input`: Direct semantic actions, a bounded pointer tap recognizer, normalized IMU structure checking and keyboard fallback are available in Headless. Multi-touch Pinch/Rotate, IMU Tilt/Shake/permissions/hardware sampling and live device normalization are not implemented.
- `G2`: No CocosAirJS/Three.js adapter, live GPU render, UI hit-test, audio, actual mobile Touch/IMU or context-loss verification. **NOT_RUN**.
- `G3`: No gameplay quality/difficulty/Agent generation benchmark. **NOT_RUN**.
- No network loaders, production limits/stress certification, full scene transitioning, content patching or persistent save serialization.

## Reference usage

```js
import { HeadlessRuntime } from './dist/index.js';
import { makeRegistry, readJson, spec } from './scripts/registry.mjs';
import { resolve } from 'node:path';

const game = readJson(resolve(spec, 'samples/games/tap-target.game.json'));
const runtime = new HeadlessRuntime(game, makeRegistry());
runtime.start();
runtime.injectAction({ action: 'collect', phase: 'press' });
runtime.injectAction({ action: 'collect', phase: 'release' });
runtime.step(1);
console.log(runtime.observe().state.score); // 1
runtime.dispose();
```

All runtime gameplay APIs in `src/` are engine-neutral TypeScript. Node.js APIs appear only in the CLI/test scripts.

## Development follow-up

The next acceptance milestone should implement/certify a full `Schema 2020-12` production G0 validator + exactHash, then add a minimal real browser Adapter for CocosAirJS and a Three.js thin Adapter using the **same GameSpec and gameplay runtime**. These tasks should produce separate G2 receipts, not reuse the G1 result. Maintain per-capability/per-game gate results and do not turn `planned` CoverageRegistry entries into verified without evidence.

## Provenance & edits

The preceding formal spec package is retained as design evidence. Only the **isolated copy** of `tools/validate_specs.py` was updated to accept multiple game fixtures instead of hardcoding `tap-target`; new component manifest and games/suites were added. The original uploaded files and remote repositories were not changed.
