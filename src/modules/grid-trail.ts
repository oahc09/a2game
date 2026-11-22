import { fail } from '../errors.js';
import { isRecord, readPointer, safeInteger } from '../utils.js';
import type { GameDefinition, JsonRecord, ModuleContext, ModuleResult, TrustedCapabilityImplementation } from '../types.js';

export const gridTrailId = 'a2game.realtime.grid-trail';
const directions = [[-1,0],[1,0],[0,-1],[0,1]] as const;
const integer = (v: unknown, lo: number, hi: number): v is number => safeInteger(v) && v >= lo && v <= hi;
const invalid = (message: string): never => fail('A2G_E_CAP_CONFIG', message, { capabilityId: gridTrailId });

function neighbor(cell: number, direction: number, columns: number, rows: number): number {
    const [dx,dy] = directions[direction]!;
    const x = cell % columns + dx;
    const y = Math.floor(cell / columns) + dy;
    return x < 0 || x >= columns || y < 0 || y >= rows ? -1 : y * columns + x;
}

function validateState(raw: unknown, config: Readonly<JsonRecord>): number[] {
    if (!isRecord(raw)) return invalid('Grid trail needs an object state');
    const {columns,rows} = config;
    if (!integer(columns,3,12) || !integer(rows,3,12)) return invalid('Invalid grid-trail dimensions');
    const {body,heading,pending,food,eaten,won,lost} = raw;
    const last = columns * rows - 1;
    if (!Array.isArray(body) || body.length < 2 || body.length > last + 1 ||
        body.some((cell,i) => !integer(cell,0,last) || (i > 0 &&
            !directions.some((_,d) => neighbor(cell,d,columns,rows) === body[i-1]))) ||
        new Set(body).size !== body.length || !integer(heading,0,3) || !integer(pending,-1,3) ||
        !integer(food,0,last) || (won !== true && body.includes(food)) || !integer(eaten,0,last) ||
        typeof won !== 'boolean' || typeof lost !== 'boolean' || (won && lost)) {
        return invalid('Invalid grid-trail state');
    }
    return body as number[];
}

function simulate(ctx: ModuleContext): ModuleResult {
    const config = ctx.config;
    const path = String(config.statePath);
    const raw = readPointer(ctx.world.state,path) as JsonRecord;
    if (raw.won || raw.lost) return {};
    const body = [...validateState(raw,config)];
    const columns = Number(config.columns);
    const rows = Number(config.rows);
    let heading = Number(raw.heading);
    let pending = Number(raw.pending);
    let food = Number(raw.food);
    let eaten = Number(raw.eaten);
    let won = false;
    let lost = false;
    const actions = config.actions as string[];
    const events: NonNullable<ModuleResult['events']> = [];
    for (const input of ctx.inputs) {
        if (input.type !== 'input.action' || input.edge !== 'press' || pending >= 0) continue;
        const direction = actions.indexOf(input.action ?? '');
        if (direction >= 0 && direction !== heading && direction !== (heading ^ 1)) pending = direction;
    }
    if ((ctx.tickIndex+1) % Number(config.intervalTicks) === 0) {
        if (pending >= 0) heading = pending;
        pending = -1;
        const next = neighbor(body[0]!,heading,columns,rows);
        const growing = next === food;
        const blocked = growing ? body : body.slice(0,-1);
        if (next < 0 || blocked.includes(next)) {
            lost = true;
            events.push({type:'grid-trail.crashed',payload:{reason:next < 0 ? 'wall' : 'body'}});
        } else {
            body.unshift(next);
            if (!growing) body.pop();
            else {
                eaten++;
                won = eaten >= Number(config.goalFood) || body.length === columns * rows;
                if (!won) {
                    const occupied = new Set(body);
                    const empty = Array.from({length:columns*rows},(_,i)=>i).filter(cell=>!occupied.has(cell));
                    food = empty[ctx.rng.randomInt(0,empty.length-1)]!;
                }
                events.push({type:'grid-trail.ate',payload:{eaten,cell:next}});
            }
        }
    }
    const value = {...raw,body,heading,pending,food,eaten,won,lost};
    return {proposals:[{kind:'state.set',path,value}],events};
}

export const gridTrailImplementation: TrustedCapabilityImplementation = { role:'module',simulate };

export function validateGridTrailDefinition(definition: GameDefinition): void {
    const initial = Object.fromEntries(Object.entries(definition.state).map(([key,field])=>[key,field.initial]));
    const entities = [...definition.scenes.flatMap(scene=>scene.entities),...Object.values(definition.prototypes??{})];
    for (const entity of entities) for (const component of entity.components??[]) {
        if (component.capability.id !== gridTrailId) continue;
        const {config} = component;
        const body = validateState(readPointer(initial,String(config.statePath)),config);
        const actions = config.actions;
        if (!integer(config.intervalTicks,1,120) || !integer(config.goalFood,1,Number(config.columns)*Number(config.rows)-body.length) ||
            !Array.isArray(actions) || actions.length !== 4 || new Set(actions).size !== 4 ||
            actions.some(name=>!definition.inputs.actions.some(action=>action.id===name&&action.valueType==='button'))) {
            invalid('Grid trail requires four distinct button actions and a reachable food count');
        }
    }
}
