# Runtime SDK placement (not bundled)

Run `npm ci`, prepare the pinned CocosAirJS checkout described in the root README, then `npm run sdk:prepare`.
`project/sdk-lock.json` pins Three.js and the CocosAirJS commit. The preparation script checks versions/source,
copies actual upstream JS, and writes a local `sdk-provenance.json` containing file SHA256 and AIR build metadata.
Set `A2GAME_AIR_ROOT` to use a different local checkout of that same revision.

For **Three.js** (pinned recommended version `0.186.1`), copy BOTH ESM modules from the same version:

- `node_modules/three/build/three.module.js` → `player/vendor/three.module.js`
- `node_modules/three/build/three.core.js` → `player/vendor/three.core.js`

The upstream Three.js module imports `./three.core.js`, so copying only `three.module.js` will fail.

For **CocosAirJS**, build or obtain the real SDK. Follow the [CocosAirJS README](https://github.com/oahc09/cocosairjs). Copy the ESM main file `build/cocosair.module.js` to `player/vendor/cocosair.js`. This demo does not invoke optional WebGPU, Box2D3, or Spark add-ons. Use a single CocosAirJS entry and `createAirApp` per browser document.

If you do not have either SDK, select **Canvas2D 预览**. This has independent drawing and is **not** evidence of the real Three.js/CocosAirJS adapters passing G2.

Run `npx playwright install chromium` and `npm run g2:real` after SDK/source changes.
Current four-game scene2d evidence is indexed by `reports/g2-threejs-real.json` and `reports/g2-cocosairjs-real.json`.
Each run retains its SDK provenance, source fingerprints, HTTP URL, Chromium version/renderer, DOM input operations,
Node/Host hashes, compositor screenshots, pixel probes, Playwright traces and lifecycle/physical-close results.
These receipts cover Windows Chromium WebGL2/SwiftShader and simulated viewport/DPR profiles; they do not establish
physical GPU, hardware Touch/IMU, full gameplay coverage or total GPU leak freedom.

CocosAirJS `close()` retains runtime/builtin/shared caches, pauses the SDK and requires document reload before
another app is initialized. A restored context also requires controlled reload. Three.js releases owned
geometries/materials/textures, and reconstructs frame visuals after context restoration. Never add a second gameplay clock.
