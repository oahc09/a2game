import { validatePresentation } from './presentation.js';
import { validatePuzzleDefinition } from './modules/puzzle.js';
import { validateRealtimeDefinition } from './modules/realtime.js';
import { validateStrategyDefinition } from './modules/strategy.js';
import {validateMobileBindings} from './mobile-input.js';
import {validateGamepadBindings} from './gamepad-input.js';
import {validateInputControlDefinition} from './modules/input-control.js';
import {validateBubbleDefinition} from './modules/bubble-grid.js';
import {validateBootstrapDefinition} from './modules/bootstrap.js';
import { fail, requireCondition } from './errors.js';
import { validateExpression, looksLikeExpression } from './expression.js';
import { CapabilityRegistry, type EffectiveCapabilities } from './registry.js';
import { checkStateValue, clone, escapePointer, isRecord, noUnknownKeys, safeInteger, stableCompare, validateJsonTree, validateSchemaSubset } from './utils.js';
import type { CapabilityRef, Effect, GameDefinition, GameEntity, GameRule, JsonRecord } from './types.js';

export interface CompiledGame {
    readonly definition: GameDefinition;
    readonly effective: EffectiveCapabilities;
    readonly entrySceneEntities: GameEntity[];
    readonly rules: GameRule[];
}
const rootFields = ['format','specVersion','id','revision','meta','requires','world','assets','prototypes','scenes','entryScene','state','inputs','rules','outcomes','presentation','tests','extensions'];
const rootRequired = ['format','specVersion','id','revision','meta','requires','world','scenes','entryScene','state','inputs','rules','outcomes','presentation'];
function assertId(id: unknown, path: string): asserts id is string {
    if (typeof id !== 'string' || !id || id.startsWith('_a2game')) fail('A2G_E_ID', 'Invalid/reserved ID', { jsonPointer: path });
}
function noDuplicates(values: string[], path: string): void {
    const seen = new Set<string>();
    for (let i=0;i<values.length;i++) {
        if (seen.has(values[i]!)) fail('A2G_E_DUPLICATE_ID', `Duplicate: ${values[i]}`, { jsonPointer: `${path}/${i}` });
        seen.add(values[i]!);
    }
}
function refValid(ref: unknown, path: string): asserts ref is CapabilityRef {
    if (!isRecord(ref) || typeof ref.id !== 'string' || typeof ref.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(ref.version)) fail('A2G_E_CAP_VERSION', 'Bad CapabilityRef', { jsonPointer: path });
    noUnknownKeys(ref, ['id','version'], path);
}
function effectArg(e: Effect, name: string, type: string, ptr: string, fields: Set<string>): void {
    if (!Object.hasOwn(e, name)) fail('A2G_E_RULE_EFFECT', `Missing ${name}`, { jsonPointer: ptr });
    const v = e[name];
    if (looksLikeExpression(v)) validateExpression(v, `${ptr}/${name}`, fields);
    else if (type === 'number' && !(typeof v === 'number' && Number.isFinite(v))) fail('A2G_E_RULE_EFFECT', `Expected numeric ${name}`, { jsonPointer: ptr });
    else if (type === 'string' && typeof v !== 'string') fail('A2G_E_RULE_EFFECT', `Expected string ${name}`, { jsonPointer: ptr });
    else if (type === 'json') validateJsonTree(v, `${ptr}/${name}`);
}
function validateEffects(effects: Effect[], ruleIndex: number, registry: CapabilityRegistry, effective: EffectiveCapabilities, fields: Set<string>, knownEntities: Set<string>, prototypes: Record<string, GameEntity>): void {
    effects.forEach((e, j) => {
        const ptr = `/rules/${ruleIndex}/do/${j}`;
        if (!isRecord(e) || typeof e.op !== 'string') fail('A2G_E_RULE_EFFECT', 'Missing op', { jsonPointer: ptr });
        registry.findCommand(e.op, effective); // MUST be in a trusted registered & selected capability.
        const byOp: Record<string,string[]> = {
            'state.set': ['op','path','value'], 'state.add':['op','path','value'], 'state.clamp':['op','path','min','max'],
            'entity.state.set':['op','entity','path','value'], 'entity.spawn':['op','prototype','id','state'], 'entity.despawn':['op','entity'],
            'event.emit':['op','eventType','payload'], 'feedback.emit':['op','cueType','payload'],
            'flow.pause':['op'], 'timer.schedule':['op','id','delayTicks','periodTicks','eventType','payload'],
        };
        const allowed = byOp[e.op];
        if (!allowed) fail('A2G_E_CAP_NOT_IMPLEMENTED', `Registered operation lacks reference interpreter implementation: ${e.op}`, { jsonPointer: ptr });
        noUnknownKeys(e, allowed, ptr);
        if (e.op.startsWith('state.')) {
            if (typeof e.path !== 'string' || !e.path.startsWith('/')) fail('A2G_E_STATE_PATH', 'Bad target path', { jsonPointer: ptr+'/path' });
            const field = e.path.slice(1).split('/')[0]!.replace(/~1/g,'/').replace(/~0/g,'~');
            if (!fields.has(field)) fail('A2G_E_STATE_PATH', `Unknown state target ${field}`, { jsonPointer: ptr+'/path' });
        }
        switch (e.op) {
            case 'state.set': effectArg(e,'value','json',ptr,fields); break;
            case 'entity.state.set': effectArg(e,'value','json',ptr,fields); if (typeof e.entity !== 'string' || typeof e.path !== 'string') fail('A2G_E_ENTITY_REF','Missing entity ID/path',{jsonPointer:ptr}); break;
            case 'state.add': effectArg(e,'value','number',ptr,fields); break;
            case 'state.clamp': effectArg(e,'min','number',ptr,fields); effectArg(e,'max','number',ptr,fields); break;
            case 'entity.spawn':
                if (typeof e.prototype !== 'string' || !Object.hasOwn(prototypes,e.prototype)) fail('A2G_E_PROTOTYPE_REF','Unknown prototype',{jsonPointer:ptr+'/prototype'});
                if (e.id !== undefined && typeof e.id !== 'string') fail('A2G_E_ENTITY_REF','Bad spawned ID',{jsonPointer:ptr+'/id'});
                if (e.state !== undefined && !isRecord(e.state)) fail('A2G_E_STATE_TYPE','Invalid spawned state',{jsonPointer:ptr+'/state'});
                break;
            case 'entity.despawn':
                if (typeof e.entity !== 'string') fail('A2G_E_ENTITY_REF','Bad entity ID',{jsonPointer:ptr+'/entity'});
                break;
            case 'event.emit': case 'timer.schedule':
                if (typeof e.eventType !== 'string' || !e.eventType) fail('A2G_E_RULE_EFFECT','Missing eventType',{jsonPointer:ptr+'/eventType'});
                break;
            case 'feedback.emit': if (typeof e.cueType !== 'string' || !e.cueType) fail('A2G_E_RULE_EFFECT','Missing cueType',{jsonPointer:ptr+'/cueType'}); break;
        }
        if (e.op === 'timer.schedule') {
            if (typeof e.id !== 'string' || !safeInteger(e.delayTicks) || e.delayTicks < 0 || (e.periodTicks !== undefined && (!safeInteger(e.periodTicks) || e.periodTicks < 1))) fail('A2G_E_TIMER','Invalid timer schedule',{jsonPointer:ptr});
        }
    });
}
export function compileGame(raw: unknown, registry: CapabilityRegistry): CompiledGame {
    validateJsonTree(raw);
    if (!isRecord(raw)) fail('A2G_E_UNKNOWN_FIELD','GameSpec must be an object');
    noUnknownKeys(raw, rootFields, '');
    for (const key of rootRequired) if (!Object.hasOwn(raw,key)) fail('A2G_E_UNKNOWN_FIELD',`Missing required ${key}`, {jsonPointer:`/${key}`});
    if (raw.format !== 'a2game') fail('A2G_E_UNKNOWN_FIELD','Invalid format',{jsonPointer:'/format'});
    if (raw.specVersion !== '0.1.0') fail('A2G_E_SPEC_VERSION','Protocol version not supported',{jsonPointer:'/specVersion'});
    assertId(raw.id,'/id');
    requireCondition(safeInteger(raw.revision) && raw.revision > 0, 'A2G_E_GAME_REVISION','Revision must be positive integer','/revision');
    if (!isRecord(raw.meta) || typeof raw.meta.title !== 'string') fail('A2G_E_UNKNOWN_FIELD','Invalid meta',{jsonPointer:'/meta'});
    if (!isRecord(raw.requires) || !Array.isArray(raw.requires.all) || (raw.requires.anyOf !== undefined && !Array.isArray(raw.requires.anyOf))) fail('A2G_E_CAP_CONFIG','Invalid requires',{jsonPointer:'/requires'});
    noUnknownKeys(raw.requires, ['all','anyOf'], '/requires');
    raw.requires.all.forEach((r,i) => refValid(r, `/requires/all/${i}`));
    if (raw.requires.anyOf) raw.requires.anyOf.forEach((group,i) => {
        if (!Array.isArray(group) || group.length===0) fail('A2G_E_CAP_DEPENDENCY','Empty anyOf group',{jsonPointer:`/requires/anyOf/${i}`});
        group.forEach((ref,j)=>refValid(ref,`/requires/anyOf/${i}/${j}`));
    });
    if (!isRecord(raw.world) || !isRecord(raw.world.clock) || ![30,60,120].includes(raw.world.clock.tickHz as number) || !safeInteger(raw.world.clock.seed) || (raw.world.clock.seed as number) < 0 || (raw.world.clock.seed as number) > 0xffffffff || raw.world.coordinateSystem !== 'rh-y-up' || raw.world.units !== 'meter' || !['2d','3d'].includes(String(raw.world.dimension))) fail('A2G_E_WORLD','Invalid world/clock',{jsonPointer:'/world'});
    noUnknownKeys(raw.world,['dimension','coordinateSystem','units','clock'],'/world');
    noUnknownKeys(raw.world.clock,['tickHz','seed','maxCatchUpTicks'],'/world/clock');
    if (!Array.isArray(raw.scenes) || raw.scenes.length===0) fail('A2G_E_SCENE_REF','Missing scenes',{jsonPointer:'/scenes'});
    if (typeof raw.entryScene !== 'string' || !raw.scenes.some((s:unknown)=>isRecord(s)&&s.id===raw.entryScene)) fail('A2G_E_SCENE_REF','Unknown entryScene',{jsonPointer:'/entryScene'});
    noDuplicates(raw.scenes.map((s:unknown) => String(isRecord(s) ? s.id : '')), '/scenes');
    if (!isRecord(raw.state)) fail('A2G_E_STATE_TYPE','Invalid state declaration',{jsonPointer:'/state'});
    const fields = new Set(Object.keys(raw.state));
    for (const [name,field] of Object.entries(raw.state)) {
        assertId(name,`/state/${escapePointer(name)}`);
        if (!isRecord(field) || typeof field.type !== 'string' || !Object.hasOwn(field,'initial')) fail('A2G_E_STATE_TYPE','Missing type/initial',{jsonPointer:`/state/${escapePointer(name)}`});
        noUnknownKeys(field, ['type','initial','constraints'],`/state/${escapePointer(name)}`);
        checkStateValue(field.type, field.initial as never, field.constraints as JsonRecord | undefined, `/state/${escapePointer(name)}/initial`);
    }
    if (raw.assets !== undefined) {
        if (!isRecord(raw.assets)) fail('A2G_E_ASSET_URI','Invalid assets dictionary',{jsonPointer:'/assets'});
        for (const [key,asset] of Object.entries(raw.assets)) {
            const ptr = `/assets/${escapePointer(key)}`;
            if (!isRecord(asset) || typeof asset.uri !== 'string' || !asset.uri || /^([a-z][\w+.-]*:|\/|\\|\.\.)/i.test(asset.uri) || asset.uri.split('/').includes('..')) fail('A2G_E_ASSET_URI','Unapproved absolute/script/path-traversal asset URI',{jsonPointer:ptr+'/uri'});
        }
    }
    const prototypes = isRecord(raw.prototypes) ? raw.prototypes as Record<string, GameEntity> : {};
    if (raw.prototypes !== undefined && !isRecord(raw.prototypes)) fail('A2G_E_PROTOTYPE_REF','Invalid prototypes',{jsonPointer:'/prototypes'});
    const effective = registry.negotiate(raw.requires as GameDefinition['requires']);
    const entityIds = new Set<string>();
    for (const [si,scene] of raw.scenes.entries()) {
        if (!isRecord(scene) || !Array.isArray(scene.entities)) fail('A2G_E_SCENE_REF','Invalid scene',{jsonPointer:`/scenes/${si}`});
        noUnknownKeys(scene,['id','entities'],`/scenes/${si}`);
        for (const [ei,ent] of scene.entities.entries()) {
            const ptr = `/scenes/${si}/entities/${ei}`;
            if (!isRecord(ent)) fail('A2G_E_ENTITY_REF','Invalid entity',{jsonPointer:ptr});
            assertId(ent.id,ptr+'/id');
            if (entityIds.has(ent.id)) fail('A2G_E_DUPLICATE_ID',`Duplicate entity ${ent.id}`,{jsonPointer:ptr+'/id'});
            entityIds.add(ent.id);
            if (typeof ent.prototype === 'string' && !Object.hasOwn(prototypes,ent.prototype)) fail('A2G_E_PROTOTYPE_REF',`Missing prototype ${ent.prototype}`,{jsonPointer:ptr+'/prototype'});
            if (ent.components !== undefined && !Array.isArray(ent.components)) fail('A2G_E_CAP_CONFIG','Invalid components',{jsonPointer:ptr+'/components'});
        }
    }
    for (const [name,proto] of Object.entries(prototypes)) {
        assertId(name,`/prototypes/${escapePointer(name)}`);
        if (!isRecord(proto)) fail('A2G_E_PROTOTYPE_REF','Invalid prototype',{jsonPointer:`/prototypes/${escapePointer(name)}`});
    }
    // Validate all declared components, even in a non-entry scene.
    for (const [ent,ptr] of [
        ...raw.scenes.flatMap((s: GameDefinition['scenes'][number],si:number)=>s.entities.map((ent,ei)=>[ent,`/scenes/${si}/entities/${ei}`] as const)),
        ...Object.entries(prototypes).map(([id,ent])=>[ent,`/prototypes/${escapePointer(id)}`] as const)
    ]) {
        for (const [ci,comp] of (ent.components ?? []).entries()) {
            const cp = `${ptr}/components/${ci}`;
            refValid(comp.capability,cp+'/capability');
            if (!registry.has(comp.capability, effective)) fail('A2G_E_CAP_DEPENDENCY','Component capability missing from requires',{jsonPointer:cp+'/capability'});
            const manifest = registry.get(comp.capability);
            if (!['behavior','core','presentation'].includes(manifest.kind)) fail('A2G_E_CAP_CONFIG','Invalid component kind',{jsonPointer:cp});
            validateSchemaSubset(comp.config,manifest.contract.configSchema,cp+'/config');
        }
    }
    if (!isRecord(raw.inputs) || !Array.isArray(raw.inputs.actions)) fail('A2G_E_INPUT_ACTION','Invalid input actions',{jsonPointer:'/inputs'});
    noUnknownKeys(raw.inputs,['actions','traceRecording'],'/inputs');
    noDuplicates(raw.inputs.actions.map((a:unknown)=>String(isRecord(a)?a.id:'')),'/inputs/actions');
    const inputIds = new Set<string>();
    for (const [i,action] of raw.inputs.actions.entries()) {
        if (!isRecord(action) || typeof action.id !== 'string' || !['button','axis1','vec2','vec3','pose'].includes(String(action.valueType)) || !Array.isArray(action.bindings) || action.bindings.length===0) fail('A2G_E_INPUT_ACTION','Malformed action',{jsonPointer:`/inputs/actions/${i}`});
        noUnknownKeys(action,['id','valueType','policy','bindings'],`/inputs/actions/${i}`);
        inputIds.add(action.id);
    }
    if (!Array.isArray(raw.rules) || !Array.isArray(raw.outcomes)) fail('A2G_E_RULE_EXPR','Invalid rules/outcomes',{jsonPointer:'/rules'});
    noDuplicates(raw.rules.map((r:unknown)=>String(isRecord(r)?r.id:'')),'/rules');
    const rules: GameRule[] = raw.rules as GameRule[];
    rules.forEach((rule,i)=>{
        if (!isRecord(rule) || !isRecord(rule.on) || typeof rule.on.type !== 'string' || !Array.isArray(rule.do) || rule.do.length === 0) fail('A2G_E_RULE_EXPR','Invalid rule',{jsonPointer:`/rules/${i}`});
        noUnknownKeys(rule,['id','priority','on','if','do'],`/rules/${i}`);
        noUnknownKeys(rule.on,['type','action','edge','sourceTag'],`/rules/${i}/on`);
        if (rule.on.type === 'input.action' && (!rule.on.action || !inputIds.has(rule.on.action))) fail('A2G_E_INPUT_ACTION','Rule references unknown action',{jsonPointer:`/rules/${i}/on/action`});
        if (rule.if) validateExpression(rule.if,`/rules/${i}/if`,fields);
        validateEffects(rule.do,i,registry,effective,fields,entityIds,prototypes);
    });
    noDuplicates(raw.outcomes.map((r:unknown)=>String(isRecord(r)?r.id:'')),'/outcomes');
    for (const [i,outcome] of raw.outcomes.entries()) {
        if (!isRecord(outcome) || !['won','lost'].includes(String(outcome.status))) fail('A2G_E_RULE_EXPR','Invalid outcome',{jsonPointer:`/outcomes/${i}`});
        validateExpression(outcome.when,`/outcomes/${i}/when`,fields);
    }
    if (!isRecord(raw.presentation)) fail('A2G_E_UNKNOWN_FIELD','Invalid presentation',{jsonPointer:'/presentation'});
    const d = clone(raw as unknown as GameDefinition);
    validatePresentation(d);
    validatePuzzleDefinition(d,registry);
    validateRealtimeDefinition(d);
    validateStrategyDefinition(d);
    validateMobileBindings(d);
    validateGamepadBindings(d);
    validateInputControlDefinition(d);
    validateBubbleDefinition(d);
    validateBootstrapDefinition(d);
    const scene = d.scenes.find(s => s.id === d.entryScene)!;
    return { definition:d, effective, entrySceneEntities:scene.entities, rules:[...d.rules].sort((a,b)=>(a.priority??0)-(b.priority??0)||stableCompare(a.id,b.id)) };
}
