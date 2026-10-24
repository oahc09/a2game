import { fail } from './errors.js';
import type { Json, JsonRecord } from './types.js';
const utf8 = new TextEncoder();
export function stableCompare(a: string, b: string): number {
    const x = utf8.encode(a), y = utf8.encode(b);
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
        if (x[i] !== y[i]) return x[i]! - y[i]!;
    }
    return x.length - y.length;
}
export function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function clone<T>(value: T): T { return structuredClone(value); }
export function safeInteger(v: unknown): v is number { return typeof v === 'number' && Number.isSafeInteger(v); }
export function safeFinite(v: unknown): v is number { return typeof v === 'number' && Number.isFinite(v); }
export function noUnknownKeys(obj: Record<string, unknown>, keys: readonly string[], base: string): void {
    for (const key of Object.keys(obj)) {
        if (!keys.includes(key)) fail('A2G_E_UNKNOWN_FIELD', `Unknown key: ${key}`, { jsonPointer: `${base}/${escapePointer(key)}` });
    }
}
export function escapePointer(s: string): string { return s.replace(/~/g, '~0').replace(/\//g, '~1'); }
export function tokens(pointer: string): string[] {
    if (!pointer.startsWith('/') || pointer.length < 2) fail('A2G_E_STATE_PATH', 'Expected non-empty JSON pointer', { jsonPointer: pointer });
    return pointer.slice(1).split('/').map(s => {
        if (/~(?![01])/.test(s)) fail('A2G_E_STATE_PATH', 'Bad JSON pointer escape', { jsonPointer: pointer });
        return s.replace(/~1/g, '/').replace(/~0/g, '~');
    });
}
export function readPointer(root: unknown, pointer: string): Json {
    let cur: unknown = root;
    for (const t of tokens(pointer)) {
        if (Array.isArray(cur) && /^(0|[1-9]\d*)$/.test(t)) cur = cur[Number(t)];
        else if (isRecord(cur) && Object.hasOwn(cur, t)) cur = cur[t];
        else fail('A2G_E_STATE_PATH', `Unknown path: ${pointer}`, { jsonPointer: pointer });
    }
    return clone(cur as Json);
}
export function writeExisting(root: Record<string, unknown>, pointer: string, value: Json): void {
    const path = tokens(pointer);
    let cur: unknown = root;
    for (const k of path.slice(0, -1)) {
        if (isRecord(cur) && Object.hasOwn(cur, k)) cur = cur[k];
        else fail('A2G_E_STATE_PATH', `Unknown path: ${pointer}`, { jsonPointer: pointer });
    }
    const last = path.at(-1)!;
    if (!isRecord(cur) || !Object.hasOwn(cur, last)) fail('A2G_E_STATE_PATH', `Unknown path: ${pointer}`, { jsonPointer: pointer });
    cur[last] = clone(value);
}
function validUnicode(s:string,ptr:string):void {
    for(let i=0;i<s.length;i++){
        const v=s.charCodeAt(i);
        if(v>=0xd800&&v<=0xdbff){const n=s.charCodeAt(i+1);if(!(n>=0xdc00&&n<=0xdfff))fail('A2G_E_STATE_TYPE','Invalid Unicode surrogate',{jsonPointer:ptr});i++;}
        else if(v>=0xdc00&&v<=0xdfff)fail('A2G_E_STATE_TYPE','Invalid Unicode surrogate',{jsonPointer:ptr});
    }
}
export function validateJsonTree(value: unknown, path = '', depth = 0): void {
    if (depth > 64) fail('A2G_E_BUDGET_EXCEEDED', 'JSON nesting exceeds 64', { jsonPointer: path });
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'string') {validUnicode(value,path);return;}
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) fail('A2G_E_STATE_TYPE', 'Non-finite JSON number', { jsonPointer: path });
        return;
    }
    if (Array.isArray(value)) { for(let i=0;i<value.length;i++){if(!Object.hasOwn(value,i))fail('A2G_E_STATE_TYPE','Sparse arrays are not JSON',{jsonPointer:`${path}/${i}`});validateJsonTree(value[i],`${path}/${i}`,depth+1);}return; }
    if (isRecord(value)) {
        for (const [k, v] of Object.entries(value)) {
            validUnicode(k,path + '/' + escapePointer(k));
            if (k === '__proto__') fail('A2G_E_UNKNOWN_FIELD', 'Dangerous key', { jsonPointer: path + '/' + escapePointer(k) });
            validateJsonTree(v, `${path}/${escapePointer(k)}`, depth + 1);
        }
        return;
    }
    fail('A2G_E_STATE_TYPE', 'Not a JSON value', { jsonPointer: path });
}
/** In-memory immutable representation is reconstructed on every observe(), not a leaky Proxy. */
export function observeCopy<T>(v: T): T { return clone(v); }
export function equals(a: Json, b: Json): boolean {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => equals(v, b[i]!));
    if (isRecord(a) && isRecord(b)) {
        const ak = Object.keys(a).sort(stableCompare), bk = Object.keys(b).sort(stableCompare);
        return ak.length === bk.length && ak.every((k, i) => k === bk[i] && equals(a[k] as Json, b[k] as Json));
    }
    return false;
}
export function stateValueIsType(type: string, value: unknown): boolean {
    switch (type) {
        case 'bool': return typeof value === 'boolean';
        case 'int': return safeInteger(value);
        case 'number': return safeFinite(value);
        case 'string': case 'enum': case 'entityRef': return typeof value === 'string';
        case 'vec2': case 'vec3': return Array.isArray(value) && value.length === (type === 'vec2' ? 2 : 3) && value.every(safeFinite);
        case 'array': return Array.isArray(value);
        case 'object': return isRecord(value);
        default: return false;
    }
}
export function checkStateValue(type: string, v: Json, constraints: JsonRecord | undefined, ptr: string): void {
    if (!stateValueIsType(type, v)) fail('A2G_E_STATE_TYPE', `Expected ${type}`, { jsonPointer: ptr });
    if (typeof v === 'number') {
        if (typeof constraints?.min === 'number' && v < constraints.min) fail('A2G_E_STATE_RANGE', 'Below minimum', { jsonPointer: ptr });
        if (typeof constraints?.max === 'number' && v > constraints.max) fail('A2G_E_STATE_RANGE', 'Above maximum', { jsonPointer: ptr });
    }
    if (constraints && Array.isArray(constraints.allowed) && !constraints.allowed.some((a) => equals(a, v))) fail('A2G_E_STATE_RANGE', 'Not in allowed set', { jsonPointer: ptr });
}
/** Minimal schema evaluator for built-in Capability config; full Draft 2020-12 remains a separate G0 gate. */
export function validateSchemaSubset(value: unknown, schema: JsonRecord, ptr: string): void {
    if (typeof schema.type === 'string') {
        const matches = schema.type === 'object' ? isRecord(value)
            : schema.type === 'array' ? Array.isArray(value)
            : schema.type === 'integer' ? safeInteger(value)
            : schema.type === 'number' ? safeFinite(value)
            : schema.type === 'string' ? typeof value === 'string'
            : schema.type === 'boolean' ? typeof value === 'boolean' : schema.type === 'null' ? value === null : false;
        if (!matches) fail('A2G_E_CAP_CONFIG', `Schema type ${schema.type} mismatch`, { jsonPointer: ptr });
    }
    if (Array.isArray(schema.enum) && !schema.enum.some(v => equals(v, value as Json))) fail('A2G_E_CAP_CONFIG', 'Not in schema enum', { jsonPointer: ptr });
    if (safeFinite(value)) {
        if (safeFinite(schema.minimum) && value < schema.minimum) fail('A2G_E_CAP_CONFIG', 'Below schema minimum', { jsonPointer: ptr });
        if (safeFinite(schema.maximum) && value > schema.maximum) fail('A2G_E_CAP_CONFIG', 'Above schema maximum', { jsonPointer: ptr });
    }
    if (typeof value === 'string' && typeof schema.pattern === 'string') {
        if (!new RegExp(schema.pattern).test(value)) fail('A2G_E_CAP_CONFIG', 'Pattern mismatch', { jsonPointer: ptr });
    }
    if (isRecord(value)) {
        const properties = isRecord(schema.properties) ? schema.properties : {};
        const required = Array.isArray(schema.required) ? schema.required : [];
        for (const key of required) if (typeof key === 'string' && !Object.hasOwn(value, key)) fail('A2G_E_CAP_CONFIG', `Missing property ${key}`, { jsonPointer: `${ptr}/${escapePointer(key)}` });
        for (const [key, item] of Object.entries(value)) {
            if (isRecord(properties[key])) validateSchemaSubset(item, properties[key] as JsonRecord, `${ptr}/${escapePointer(key)}`);
            else if (schema.additionalProperties === false) fail('A2G_E_CAP_CONFIG', 'Extra config property', { jsonPointer: `${ptr}/${escapePointer(key)}` });
        }
    }
}
