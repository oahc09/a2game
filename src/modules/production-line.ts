import {fail} from '../errors.js';
import {clone, isRecord, readPointer, safeInteger} from '../utils.js';
import type {GameDefinition, JsonRecord, ModuleContext, ModuleResult, TrustedCapabilityImplementation} from '../types.js';

export const productionLineId = 'a2game.strategy.production-line';
const invalid = (message: string): never => fail('A2G_E_CAP_CONFIG', message);
const bounded = (value: unknown, min: number, max: number): value is number =>
 safeInteger(value) && value >= min && value <= max;

interface Machine {
 input?: string;
 output?: string;
 capacity: number;
}
interface Link {from: number; to: number; action: string;}
interface LineConfig {
 statePath: string;
 machines: Machine[];
 links: Link[];
 intervalTicks: number;
 goalMachine: number;
 goalUnits: number;
}
interface LineState {inputs: number[]; outputs: number[]; connected: boolean[]; won: boolean;}

function config(raw: Readonly<JsonRecord>): LineConfig {
 const c = raw as unknown as LineConfig;
 const material = (value: unknown) => typeof value === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(value);
 if (typeof c.statePath !== 'string' || !c.statePath.startsWith('/') || !Array.isArray(c.machines) ||
     !bounded(c.machines.length, 2, 12) || !Array.isArray(c.links) || !bounded(c.links.length, 1, 24) ||
     !bounded(c.intervalTicks, 1, 600)) {
  invalid('Invalid production line size or state path');
 }
 for (const machine of c.machines) {
  if (!isRecord(machine) || !bounded(machine.capacity, 1, 1000) ||
      (machine.input === undefined && machine.output === undefined) ||
      (machine.input !== undefined && !material(machine.input)) || (machine.output !== undefined && !material(machine.output))) {
   invalid('Invalid production machine or material');
  }
 }
 const actions = new Set<string>(), edges = new Set<string>();
 for (const link of c.links) {
  if (!isRecord(link) || !bounded(link.from, 0, c.machines.length - 1) ||
      !bounded(link.to, link.from + 1, c.machines.length - 1) || typeof link.action !== 'string' ||
      actions.has(link.action) || edges.has(link.from + ':' + link.to) ||
      c.machines[link.from]!.output === undefined || c.machines[link.from]!.output !== c.machines[link.to]!.input) {
   invalid('Invalid, duplicate or incompatible production link');
  }
  actions.add(link.action);
  edges.add(link.from + ':' + link.to);
 }
 if (!bounded(c.goalMachine, 0, c.machines.length - 1)) invalid('Unknown production goal machine');
 const goal = c.machines[c.goalMachine]!;
 if (goal.input === undefined || goal.output !== undefined || !bounded(c.goalUnits, 1, goal.capacity)) {
  invalid('Production goal requires a warehouse and a count within its capacity');
 }
 return c;
}

function checked(raw: unknown, c: LineConfig): LineState {
 const s = raw as LineState;
 if (!isRecord(raw) || !Array.isArray(s.inputs) || s.inputs.length !== c.machines.length ||
     !Array.isArray(s.outputs) || s.outputs.length !== c.machines.length ||
     !Array.isArray(s.connected) || s.connected.length !== c.links.length ||
     !s.connected.every(value => typeof value === 'boolean') || typeof s.won !== 'boolean' ||
     !c.machines.every((machine, index) => bounded(s.inputs[index], 0, machine.input ? machine.capacity : 0) &&
       bounded(s.outputs[index], 0, machine.output ? machine.capacity : 0))) invalid('Invalid production buffers');
 return s;
}

function simulate(ctx: ModuleContext): ModuleResult {
 const c = config(ctx.config);
 const s = clone(checked(readPointer(ctx.world.state, c.statePath), c));
 if (s.won) return {proposals: []};
 for (const input of ctx.inputs) {
  if (input.type !== 'input.action' || input.edge !== 'press') continue;
  const index = c.links.findIndex(link => link.action === input.action);
  if (index >= 0) s.connected[index] = !s.connected[index];
 }
 if (ctx.tickIndex % c.intervalTicks === 0) {
  // Only existing stock moves. Each allocation immediately reserves both ends.
  for (const [index, link] of c.links.entries()) {
   if (!s.connected[index] || s.outputs[link.from]! === 0 || s.inputs[link.to]! === c.machines[link.to]!.capacity) continue;
   s.outputs[link.from]!--;
   s.inputs[link.to]!++;
  }
  for (const [index, machine] of c.machines.entries()) {
   if (!machine.input || !machine.output || s.inputs[index]! === 0 || s.outputs[index]! === machine.capacity) continue;
   s.inputs[index]!--;
   s.outputs[index]!++;
  }
 }
 s.won = s.inputs[c.goalMachine]! >= c.goalUnits;
 return {proposals: [{kind: 'state.set', path: c.statePath, value: s as unknown as JsonRecord}]};
}

export const productionLineImplementation: TrustedCapabilityImplementation = {role: 'module', simulate};

export function validateProductionLineDefinition(def: GameDefinition): void {
 const initial = Object.fromEntries(Object.entries(def.state).map(([name, field]) => [name, field.initial]));
 for (const entity of [...def.scenes.flatMap(scene => scene.entities), ...Object.values(def.prototypes ?? {})]) {
  for (const component of entity.components ?? []) {
   if (component.capability.id !== productionLineId) continue;
   const c = config(component.config);
   checked(readPointer(initial, c.statePath), c);
   if (c.links.some(link => !def.inputs.actions.some(action => action.id === link.action && action.valueType === 'button'))) {
    invalid('Production link requires a button action');
   }
  }
 }
}
