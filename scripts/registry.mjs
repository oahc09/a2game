import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {CapabilityRegistry,addReferenceRuleOps,trustedModules,trustedServiceIds} from '../dist/index.js';
export const root = resolve(import.meta.dirname, '..');
export const spec = resolve(root, 'specs/v0.1');
export function readJson(filename) { return JSON.parse(readFileSync(filename, 'utf8')); }
export function makeRegistry({disabledIds=[]} = {}) {
    const registry = new CapabilityRegistry();
    const directory = resolve(spec, 'samples/capabilities');
    for (const filename of readdirSync(directory).filter(f => f.endsWith('.capability.json')).sort()) {
        const manifest = readJson(resolve(directory,filename));
        // Trust binding occurs here in the application, NEVER in the loaded Manifest JSON.
        const implementation=trustedModules[manifest.id]??(manifest.kind==='core'||trustedServiceIds.includes(manifest.id)?{role:'builtin'}:manifest.kind==='rule-op'?{role:'rule-op'}:manifest.kind==='recognizer'||manifest.kind==='input-source'?{role:'recognizer'}:manifest.kind==='presentation'?{role:'headless-presentation'}:undefined);
        if(!implementation)throw Error('No trusted implementation for '+manifest.id);
        registry.register(manifest,implementation,!disabledIds.includes(manifest.id));
    }
    addReferenceRuleOps(registry);
    return registry;
}
