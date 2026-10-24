import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { CapabilityRegistry, addReferenceRuleOps, gridSlideMergeImplementation,gridPushImplementation,puzzleImplementations,puzzleServiceIds,realtimeWorldImplementation,realtimeServiceIds,strategyImplementations,strategyServiceIds } from '../dist/index.js';
export const root = resolve(import.meta.dirname, '..');
export const spec = resolve(root, 'specs/v0.1');
export function readJson(filename) { return JSON.parse(readFileSync(filename, 'utf8')); }
export function makeRegistry({disabledIds=[]} = {}) {
    const registry = new CapabilityRegistry();
    const directory = resolve(spec, 'samples/capabilities');
    for (const filename of readdirSync(directory).filter(f => f.endsWith('.capability.json')).sort()) {
        const manifest = readJson(resolve(directory,filename));
        // Trust binding occurs here in the application, NEVER in the loaded Manifest JSON.
        const trusted=puzzleImplementations[manifest.id]??strategyImplementations[manifest.id]??(manifest.id==='a2game.realtime.world'?realtimeWorldImplementation:undefined);
        const role = trusted?.role??(['a2game.puzzle.grid-slide-merge','a2game.puzzle.grid-push'].includes(manifest.id) ? 'module'
            : manifest.kind === 'core' ? 'builtin'
            : manifest.kind === 'rule-op' ? 'rule-op'
            : manifest.kind === 'recognizer' || manifest.kind === 'input-source' ? 'recognizer'
            : manifest.kind === 'presentation' ? 'headless-presentation'
            : [...puzzleServiceIds,...realtimeServiceIds,...strategyServiceIds].includes(manifest.id)?'builtin':undefined);
        if (!role) throw new Error(`No trusted implementation for ${manifest.id}`);
        registry.register(manifest,trusted??(role === 'module' ? (manifest.id === 'a2game.puzzle.grid-push' ? gridPushImplementation : gridSlideMergeImplementation) : {role}), !disabledIds.includes(manifest.id));
    }
    addReferenceRuleOps(registry);
    return registry;
}
