# A2Game clean-checkout source readiness

Run `node scripts/check-source-readiness.mjs` with the supported Node version
before installing dependencies or restoring reports. This command is read-only
and can be used on a clean source checkout. It checks release-version agreement,
the frozen G01–G32 and H01–H05 acceptance scope, and the consistency of source
demo/capability counts. These are source inventory checks, not a measure of
implemented or independently accepted goals.

The report locates the historical G3 plan and prepared player SDK files, and
lists the locked archive digest and SDK pins. `MISSING` means not found in this
checkout; `PRESENT_NOT_VALIDATED` proves neither file authenticity nor the
validity of its contents. The report does not run browser, device, model,
distribution, or release acceptance. It does not install software, build packages,
write evidence, or grant a waiver.

- For historical evidence, see [evidence restoration](evidence-restoration.md).
  Obtain the actual trusted archive matching the recorded lock, then use
  `npm run evidence:restore -- <trusted-archive>`. Do not run a new planning
  command to populate a historical plan path. Keep the recovered receipt
  separate from evidence for the changed current source.
- For native SDK workflows, install the repository dependencies and point
  `A2GAME_AIR_ROOT` to the pinned CocosAirJS checkout/build. Then run
  `npm run sdk:prepare`, which independently checks versions and records
  byte digests. Presence in `player/vendor/` is only a prerequisite.
- For distribution, compare license declarations and validate the actual rebuilt
  package, its license files, and its current per-game receipts. The diagnostic
  reports differences between source documents; it does not decide reuse rights
  or approve an artifact for release.

Do not substitute this command for `npm run project:check`, `npm run verify`,
`node scripts/g3-codex-report.mjs --check`, or `npm run acceptance:ready`.
A clean checkout may pass the source diagnostic and still fail those stricter
checks. Preserve the failure and supply the corresponding verified evidence.

## Smoke test rebuilt standalone players

Build the actual locked SDKs first. Package
`games/phase2/sokoban/01-first-light/game.json` and
`games/phase2/shooter/game.json` with `scripts/package-player-sdk.mjs`.
Use the two output directories printed by the build:

```sh
node scripts/r0-player-browser.mjs SOKOBAN_PACKAGE SHOOTER_PACKAGE NEW_REPORT_DIR
```

The script checks inventory bytes, starts a local HTTP server, and exercises
each package on both Three.js and CocosAirJS with one browser. Use a supported
Playwright browser already installed locally. The default is Chromium;
`A2GAME_SMOKE_BROWSER=webkit` selects WebKit. If a compatible local launcher
is necessary, set `A2GAME_BROWSER_EXECUTABLE`. The report records screenshots
and cases. The hidden-document event is synthetic; it is not evidence of
actual OS suspension, Android hardware, formal G3, or release approval.
