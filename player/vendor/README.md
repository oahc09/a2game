# Runtime SDK placement (not bundled)

For **Three.js** (pinned recommended version `0.186.1`), copy BOTH ESM modules from the same version:

- `node_modules/three/build/three.module.js` → `player/vendor/three.module.js`
- `node_modules/three/build/three.core.js` → `player/vendor/three.core.js`

The upstream Three.js module imports `./three.core.js`, so copying only `three.module.js` will fail.

For **CocosAirJS**, build or obtain the real SDK. Follow the [CocosAirJS README](https://github.com/oahc09/cocosairjs). Copy the ESM main file `build/cocosair.module.js` to `player/vendor/cocosair.js`. This demo does not invoke optional WebGPU, Box2D3, or Spark add-ons. Use a single CocosAirJS entry and `createAirApp` per browser document.

If you do not have either SDK, select **Canvas2D 预览**. This has independent drawing and is **not** evidence of the real Three.js/CocosAirJS adapters passing G2.

These paths are NOT a claim that package builds or browser interoperability were verified in the execution environment.
