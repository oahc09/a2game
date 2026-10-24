import { fail } from './errors.js';
import { equals, isRecord, readPointer, safeFinite, validateJsonTree } from './utils.js';
import type { Expression, Json, JsonRecord, RuntimeEntity } from './types.js';
export interface ExpressionContext { state: JsonRecord; entities: Record<string, RuntimeEntity>; event?: JsonRecord; }
const arities: Record<string, [number, number]> = {
    eq:[2,2], ne:[2,2], lt:[2,2], lte:[2,2], gt:[2,2], gte:[2,2],
    and:[2,64], or:[2,64], not:[1,1], add:[2,64], sub:[2,2], mul:[2,64], div:[2,2],
    min:[2,64], max:[2,64], clamp:[3,3],
};
export function validateExpression(value: unknown, path: string, stateFields: Set<string>, depth = 0): asserts value is Expression {
    if (depth > 64) fail('A2G_E_BUDGET_EXCEEDED', 'Expression too deep', { jsonPointer: path });
    if (!isRecord(value)) fail('A2G_E_RULE_EXPR', 'Expression is not an AST object', { jsonPointer: path });
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === 'const') { validateJsonTree(value.const, `${path}/const`); return; }
    if (keys.length === 1 && keys[0] === 'state') {
        if (typeof value.state !== 'string' || !value.state.startsWith('/')) fail('A2G_E_STATE_PATH', 'Invalid global state path', { jsonPointer: path });
        const name = value.state.slice(1).split('/')[0]!.replace(/~1/g,'/').replace(/~0/g,'~');
        if (!stateFields.has(name)) fail('A2G_E_STATE_PATH', `Undeclared state path ${value.state}`, { jsonPointer: path });
        return;
    }
    if (keys.length === 1 && keys[0] === 'event') {
        if (typeof value.event !== 'string' || !value.event.startsWith('/')) fail('A2G_E_RULE_EXPR', 'Invalid event path', { jsonPointer: path });
        return;
    }
    if (keys.length === 1 && keys[0] === 'entityState' && isRecord(value.entityState)
        && typeof value.entityState.entity === 'string' && typeof value.entityState.path === 'string' && value.entityState.path.startsWith('/')) return;
    if (keys.length === 2 && keys.includes('op') && keys.includes('args') && typeof value.op === 'string' && Array.isArray(value.args)) {
        const bounds = arities[value.op];
        if (!bounds) fail('A2G_E_RULE_EXPR', `Unsupported expression op ${value.op}`, { jsonPointer: path });
        if (value.args.length < bounds[0] || value.args.length > bounds[1]) fail('A2G_E_RULE_EXPR', `Bad arity for ${value.op}`, { jsonPointer: path });
        value.args.forEach((arg, i) => validateExpression(arg, `${path}/args/${i}`, stateFields, depth + 1)); return;
    }
    fail('A2G_E_RULE_EXPR', 'Invalid AST node', { jsonPointer: path });
}
export function looksLikeExpression(v: unknown): v is Expression { return isRecord(v) && ('op' in v || 'state' in v || 'event' in v || 'const' in v || 'entityState' in v); }
const number = (v: Json): number => {
    if (!safeFinite(v)) fail('A2G_E_RULE_EXPR', 'Expected finite number');
    return v;
};
const boolean = (v: Json): boolean => {
    if (typeof v !== 'boolean') fail('A2G_E_RULE_EXPR', 'Expected boolean');
    return v;
};
export function evaluate(expr: Expression, ctx: ExpressionContext, depth = 0): Json {
    if (depth > 64) fail('A2G_E_BUDGET_EXCEEDED', 'Expression too deep');
    if ('const' in expr) return structuredClone(expr.const);
    if ('state' in expr) return readPointer(ctx.state, expr.state);
    if ('event' in expr) return readPointer(ctx.event ?? {}, expr.event);
    if ('entityState' in expr) {
        const ent = ctx.entities[expr.entityState.entity];
        if (!ent) fail('A2G_E_ENTITY_REF', `Unknown entity ${expr.entityState.entity}`);
        return readPointer(ent.state, expr.entityState.path);
    }
    if (!('op' in expr)) fail('A2G_E_RULE_EXPR', 'Invalid expression');
    if (expr.op === 'and') {
        for (const arg of expr.args) if (!boolean(evaluate(arg, ctx, depth+1))) return false;
        return true;
    }
    if (expr.op === 'or') {
        for (const arg of expr.args) if (boolean(evaluate(arg, ctx, depth+1))) return true;
        return false;
    }
    const values = expr.args.map(arg => evaluate(arg, ctx, depth+1));
    let result: Json;
    switch (expr.op) {
        case 'not': result = !boolean(values[0]!); break;
        case 'eq': result = equals(values[0]!, values[1]!); break;
        case 'ne': result = !equals(values[0]!, values[1]!); break;
        case 'lt': case 'lte': case 'gt': case 'gte': {
            const a = number(values[0]!), b = number(values[1]!);
            result = expr.op === 'lt' ? a < b : expr.op === 'lte' ? a <= b : expr.op === 'gt' ? a > b : a >= b; break;
        }
        case 'add': result = values.reduce<number>((a,b) => a + number(b), 0); break;
        case 'sub': result = number(values[0]!) - number(values[1]!); break;
        case 'mul': result = values.reduce<number>((a,b) => a * number(b), 1); break;
        case 'div': {
            const den = number(values[1]!);
            if (den === 0) fail('A2G_E_RULE_EXPR', 'Division by zero');
            result = number(values[0]!) / den; break;
        }
        case 'min': result = Math.min(...values.map(number)); break;
        case 'max': result = Math.max(...values.map(number)); break;
        case 'clamp': result = Math.max(number(values[1]!), Math.min(number(values[2]!), number(values[0]!))); break;
        default: fail('A2G_E_RULE_EXPR', `Unknown operator ${expr.op}`);
    }
    if (typeof result === 'number' && !Number.isFinite(result)) fail('A2G_E_RULE_EXPR', 'Non-finite expression result');
    return result;
}
