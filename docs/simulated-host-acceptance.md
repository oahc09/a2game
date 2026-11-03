# Simulated Host project acceptance

The user-selected alternative is **SIMULATED_HOST_ACCEPTANCE**, distinct from actual Qoder/WorkBuddy/TRAE client acceptance. The original `project/host-first-tasks.json` real-host matrix and formal counts remain unchanged. Neutral replicates A/B/C have no branded-client behavioral attestation.

`project/simulated-host-acceptance-profile.json` freezes 3 replicates × G01/G03/G17/G21/H01 = 15 independent cells, maximum three validation calls per cell, zero MCP Provider budget, and explicit mechanics/input/visual/lifecycle requirements. Native author identity, usage and cost are UNKNOWN unless independently available; this profile currently requires UNKNOWN. Previous Pilot outputs do not enter a new batch.

Use fresh native agents with no inherited turns, one public-context workspace and service session per cell. Only Schema, capability contracts and the shared Skill are author-visible; never provide reference levels, winning traces or another cell's output. This is instruction isolation, not an OS security boundary. Freeze task text, source/profile/public-resource hashes, feedback policy, input/browser checks and stopping conditions before generation. Keep every failed candidate and tool receipt. Actual experiment files, screenshots and logs remain private and Git-ignored.

For every admitted candidate, preserve real MCP calls and actual dual-SDK WPE input/Node replay evidence. Independently inspect gameplay requirements rather than trusting authored tests or a final `won` hash. Review actual initial/intermediate/terminal screenshots at desktop and narrow viewports. Font measurements are advisory; geometric placeholder visibility is not polished aesthetic or human acceptance. Atomic gameplay implementations do not imply observable intermediate animation phases. Unsupported mechanics or missing counterexamples remain PARTIAL, not inferred passes.

## Read-only inventory

`node scripts/simulated-host-acceptance.mjs <local-batch.json>` verifies canonical run/session/call receipts, source and profile fingerprints, unique cell/run bindings, bounded attempts, closed sessions, complete captures and controller evidence file hashes. See the exported `checkSimulatedHostAcceptance(batch, workspace)` API and synthetic tests for the versioned input format.

Each run has an immutable local `controller-binding.json`; its SHA is pinned in the batch entry. A failed candidate need not be exported: an explicit `reviewArtifactId` must belong to a successful validation in that same canonical run; failure diagnostics remain in the inventory. Each controller category report binds batch/cell/run/source/profile/artifact and a distinct controller label, and contains required check IDs with concrete observations, results and nonempty evidence file SHAs. Paths must stay inside the run. These labels/digests bind local files; they are **LOCAL_CONTROLLER_NOT_ATTESTED**, not cryptographic identity or a generic proof of semantics.

A complete inventory returns **READY_FOR_CONTROLLER_ACCEPTANCE**, never automatic gameplay acceptance. Its `accepted` count stays zero: the independent controller must assess actual semantics and imagery and provide a separate, explicitly scoped simulated-project decision. FAIL/PARTIAL and all attempts remain in the denominator; no resampling to select successes. Human quality, OS isolation, physical devices, Chromium and actual branded-client discovery/configuration/permissions remain separate unverified gates.

## Profile v2 coverage (structural, not semantic acceptance)

Version 2 adds mandatory `replay`, `inputCoverage` and `runtimeObservations` categories without removing any previous check. Its new profile SHA rejects old-profile batches; old evidence stays immutable and is not upgraded or rewritten.

- `second-independent-session-replay`: for **both air and three**, record a distinct second runtime Session, the same seed, complete input trace, ticks and exactHash comparison. Restarting the original Session alone does not meet this requirement.
- `keyboard-hold`, `pointer-drag`, `pointer-cancel`, `blur-input-clear`, `restart-input-clear`: record actual canvas input and cleared state on both backends. Applicable observations require `applicability: {"status":"APPLICABLE"}`. Unsupported declared inputs must remain FAIL/PARTIAL, not be waived.
- `console-errors`, `page-errors`, `performance-measurement`: retain both backends' logs and measured samples with metric, units, sample interval, environment and limitations. An error-free console is not a performance measurement.

Only optional hold/drag/cancel contracts genuinely absent from the selected candidate may use `result: "NOT_APPLICABLE"` with `applicability: {"status":"NOT_DECLARED","reason":"specific absent input contract and why it is optional"}`, a concrete observation, and nonempty SHA-bound evidence. Missing reasons/files, generic `UNSUPPORTED`, and N/A for old mandatory checks, replay, errors/performance, blur or restart clearing are rejected. G17 must have hold **or** drag coverage; both cannot be N/A. Applicable drag requires cancellation coverage. Reviewers must reject false applicability declarations or omitted task-required inputs; the structural checker cannot infer these from prose or certify game semantics.

`checkControllerObservations` is a structural-only helper also used by the inventory. It records waived optional checks separately as `notApplicable`, not as tested passes. Missing checks remain PARTIAL. Bound local observations only establish review readiness, not correctness, human approval, physical input, real clients, OS isolation, or absence of all GPU-internal caches. These additions do not execute a new matrix or change original real-host NOT_RUN gates.
