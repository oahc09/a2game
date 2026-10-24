import { fail, requireCondition } from './errors.js';
import { clone, isRecord, stableCompare, validateJsonTree } from './utils.js';
import type { CapabilityManifest, CapabilityRef, GameDefinition, TrustedCapabilityImplementation } from './types.js';

export interface EffectiveCapabilities {
    readonly capabilities: CapabilityRef[];
    readonly selectedFallbacks: CapabilityRef[];
}
interface Registered { manifest: CapabilityManifest; implementation?: TrustedCapabilityImplementation; enabled: boolean; }
const capabilityKey = (ref: CapabilityRef) => `${ref.id}@${ref.version}`;
const capName = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2,}$/;
const semanticVersion = /^\d+\.\d+\.\d+$/;
export class CapabilityRegistry {
    private readonly entries = new Map<string, Registered>();
    private sealed = false;
    register(manifest: CapabilityManifest, implementation?: TrustedCapabilityImplementation, enabled = true): this {
        requireCondition(!this.sealed, 'A2G_E_CAP_REGISTRY_SEALED', 'Cannot mutate a registry after compilation');
        validateJsonTree(manifest);
        requireCondition(isRecord(manifest) && manifest.format === 'a2game-capability' && manifest.manifestVersion === '0.1.0', 'A2G_E_CAP_CONFIG', 'Invalid capability manifest');
        requireCondition(capName.test(manifest.id) && semanticVersion.test(manifest.version), 'A2G_E_CAP_CONFIG', 'Invalid capability ID/version');
        requireCondition(Array.isArray(manifest.dependencies) && isRecord(manifest.contract) && Array.isArray(manifest.contract.commands) && Array.isArray(manifest.contract.events), 'A2G_E_CAP_CONFIG', 'Missing capability contract');
        requireCondition(Array.isArray(manifest.testSuites) && manifest.testSuites.length > 0, 'A2G_E_CAP_CONFIG', 'No capability test declaration');
        for (const arr of [manifest.contract.commands, manifest.contract.events]) {
            const names = arr.map(c => c.name);
            requireCondition(names.length === new Set(names).size, 'A2G_E_CAP_CONFIG', 'Duplicate command/event name');
        }
        const roles: Record<CapabilityManifest['kind'], TrustedCapabilityImplementation['role'][]> = {
            'core':['builtin'], 'behavior':['module'], 'rule-op':['rule-op'],
            'input-source':['recognizer'], 'recognizer':['recognizer'], 'service':['builtin'],
            'presentation':['headless-presentation'],
        };
        if (implementation && !roles[manifest.kind]?.includes(implementation.role)) fail('A2G_E_CAP_CONFIG','Mismatched manifest/implementation kind');
        if (implementation?.role==='module' && !implementation.simulate) fail('A2G_E_CAP_CONFIG','Module missing simulate() implementation');
        const key = capabilityKey(manifest);
        requireCondition(!this.entries.has(key), 'A2G_E_CAP_CONFIG', `Duplicate capability ${key}`);
        this.entries.set(key, { manifest: clone(manifest), implementation, enabled });
        return this;
    }
    seal(): this { this.sealed = true; return this; }
    get(ref: CapabilityRef): CapabilityManifest {
        const item = this.lookup(ref);
        return clone(item.manifest);
    }
    implementation(ref: CapabilityRef): TrustedCapabilityImplementation {
        return this.lookup(ref).implementation!;
    }
    private lookup(ref: CapabilityRef): Registered {
        const found = this.entries.get(capabilityKey(ref));
        if (!found) {
            const known = [...this.entries.values()].some(x => x.manifest.id === ref.id);
            fail(known ? 'A2G_E_CAP_VERSION' : 'A2G_E_CAP_UNKNOWN', `Capability unavailable: ${capabilityKey(ref)}`, { capabilityId: ref.id });
        }
        if (!found.enabled) fail('A2G_E_CAP_PERMISSION', `Capability disabled: ${capabilityKey(ref)}`, { capabilityId: ref.id });
        if (!found.implementation) fail('A2G_E_CAP_NOT_IMPLEMENTED', `No trusted implementation: ${capabilityKey(ref)}`, { capabilityId: ref.id });
        return found;
    }
    negotiate(requires: GameDefinition['requires']): EffectiveCapabilities {
        const chosen: CapabilityRef[] = [];
        const selecting = new Set<string>();
        const already = new Set<string>();
        const ids = new Map<string, string>();
        const visit = (ref: CapabilityRef): void => {
            const key = capabilityKey(ref);
            if (selecting.has(key)) fail('A2G_E_CAP_DEPENDENCY', `Dependency cycle: ${key}`);
            if (already.has(key)) return;
            const conflict = ids.get(ref.id);
            if (conflict && conflict !== ref.version) fail('A2G_E_CAP_DEPENDENCY', `Version conflict for ${ref.id}`);
            ids.set(ref.id, ref.version);
            selecting.add(key);
            let item: Registered;
            try { item = this.lookup(ref); }
            catch (e) {
                if (selecting.size > 1) fail('A2G_E_CAP_DEPENDENCY', `Unmet dependency: ${key}`);
                throw e;
            }
            for (const dep of item.manifest.dependencies) visit(dep);
            selecting.delete(key);
            already.add(key);
            chosen.push(clone(ref));
        };
        for (const req of requires.all) visit(req);
        const selectedFallbacks: CapabilityRef[] = [];
        for (const group of (requires.anyOf ?? [])) {
            if (!Array.isArray(group) || group.length === 0) fail('A2G_E_CAP_DEPENDENCY', 'Empty anyOf group');
            let ok = false;
            let lastError: unknown;
            for (const ref of group) {
                // Candidate negotiation must not pollute visited graph on failed attempts.
                const prevChosen = chosen.length, prevAlready = new Set(already), prevIds = new Map(ids);
                try {
                    visit(ref);
                    selectedFallbacks.push(clone(ref)); ok = true; break;
                } catch (e) {
                    lastError = e;
                    chosen.length = prevChosen;
                    already.clear(); for (const x of prevAlready) already.add(x);
                    ids.clear(); for (const [k, v] of prevIds) ids.set(k, v);
                    selecting.clear();
                }
            }
            if (!ok) fail('A2G_E_CAP_DEPENDENCY', `No available candidate in anyOf group: ${String(lastError)}`);
        }
        return {
            capabilities: chosen.sort((a,b) => stableCompare(capabilityKey(a), capabilityKey(b))),
            selectedFallbacks,
        };
    }
    findCommand(command: string, effective: EffectiveCapabilities): CapabilityManifest {
        const found = effective.capabilities.map(ref => this.get(ref)).filter(m => m.kind === 'rule-op' && m.contract.commands.some(c => c.name === command));
        if (found.length !== 1) fail('A2G_E_CAP_UNKNOWN', `Command not provided exactly once by active capabilities: ${command}`);
        return found[0]!;
    }
    has(ref: CapabilityRef, effective: EffectiveCapabilities): boolean { return effective.capabilities.some(c => c.id === ref.id && c.version === ref.version); }
    list(): CapabilityManifest[] { return [...this.entries.values()].map(x => clone(x.manifest)); }
}
/** Pure TS runtime ships trusted implementations for small, explicitly enumerated rule operators. */
export function addReferenceRuleOps(registry: CapabilityRegistry): void {
    const entries: { name: string; id: string; writes: string[] }[] = [
        { name: 'state.set', id: 'a2game.rules.state-set', writes: ['global'] },
        { name: 'state.clamp', id: 'a2game.rules.state-clamp', writes: ['global'] },
        { name: 'entity.state.set', id: 'a2game.rules.entity-state-set', writes: ['entity'] },
        { name: 'entity.spawn', id: 'a2game.rules.entity-spawn', writes: ['entity'] },
        { name: 'entity.despawn', id: 'a2game.rules.entity-despawn', writes: ['entity'] },
        { name: 'event.emit', id: 'a2game.rules.event-emit', writes: ['deferred'] },
        { name: 'feedback.emit', id: 'a2game.rules.feedback-emit', writes: ['presentation'] },
        { name: 'flow.pause', id: 'a2game.rules.flow-pause', writes: ['flow'] },
        { name: 'timer.schedule', id: 'a2game.rules.timer-schedule', writes: ['timer'] },
    ];
    for (const e of entries) {
        registry.register({
            format: 'a2game-capability', manifestVersion: '0.1.0', id: e.id, version: '0.1.0', kind: 'rule-op', portability: 'exact',
            description: `Trusted A2Game reference implementation for ${e.name}`,
            phase: 'commit', dependencies: [{ id: 'a2game.core.rules', version: '0.1.0' }],
            contract: {
                configSchema: { type: 'object', additionalProperties: false },
                stateSchema: { type: 'object', additionalProperties: false },
                commands: [{ name: e.name, payloadSchema: { type: 'object' } }], events: [], stateWrites: e.writes,
                lifecycle: ['initialize', 'tick', 'reset', 'dispose'],
            },
            testSuites: ['reference-core-op-tests'],
        }, { role: 'rule-op' });
    }
}
