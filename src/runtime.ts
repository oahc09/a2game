import { A2GameError, fail, type DiagnosticInfo } from './errors.js';
import { canonicalJson, exactStateHash } from './exact-hash.js';
import {mobileInputIds,recognizeMobileInput} from './mobile-input.js';
import {recognizeGamepadInput,gamepadInputSources} from './gamepad-input.js';
import { evaluate, looksLikeExpression } from './expression.js';
import { GameRng } from './rng.js';
import { CapabilityRegistry } from './registry.js';
import { checkStateValue, clone, isRecord, readPointer, safeFinite, safeInteger, stableCompare, writeExisting } from './utils.js';
import { compileGame, type CompiledGame } from './validator.js';
import type {
    ActionPhase, DeferredEvent, Effect, GameEntity, GameRule, GameStatus, IncomingEvent, Json, JsonRecord,
    ModuleContext, NormalizedAction, NormalizedRawInput, RuntimeEntity, RuntimeEvent,
    SessionObservation, SessionSnapshot, SimulationProposal, TimerRecord,
} from './types.js';

export interface HeadlessOptions {
    seed?: number;
    maxEventsPerTick?: number;
    maxEffectsPerTick?: number;
    maxDeferredPerSession?: number;
    maxEntities?: number;
    maxRecordedEvents?: number;
}
const channelRank = { input:0, timer:1, module:2, contact:3, deferred:4, outcome:5 } as const;
interface Stage extends SessionSnapshot {}
interface QueuedEvent extends RuntimeEvent { producer: (string | number)[]; }
interface ResolvedEffect { effect: Effect; value?: Json; min?: Json; max?: Json; eventIndex: number; ruleId: string; effectIndex: number; }
function eventSort(a: QueuedEvent, b: QueuedEvent): number {
    const channel = channelRank[a.channel] - channelRank[b.channel];
    if (channel !== 0) return channel;
    const n = Math.max(a.producer.length, b.producer.length);
    for (let i=0;i<n;i++) {
        const av = a.producer[i], bv = b.producer[i];
        if (av === undefined || bv === undefined) return av === undefined ? -1 : 1;
        const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : stableCompare(String(av), String(bv));
        if (cmp !== 0) return cmp;
    }
    return stableCompare(a.eventId, b.eventId);
}
function eventView(event: QueuedEvent): RuntimeEvent {
    const { producer: _unused, ...out } = event;
    return out;
}
/** A2Game G1 reference slice: exact core rules / timers / input-action edges, no rendering or physics. */
export class HeadlessRuntime {
    readonly plan: CompiledGame;
    readonly rng: GameRng;
    private readonly registry: CapabilityRegistry;
    private readonly opts: Required<Pick<HeadlessOptions,'maxEventsPerTick'|'maxEffectsPerTick'|'maxDeferredPerSession'|'maxEntities'|'maxRecordedEvents'>>;
    // Declaration identity, not instance/host identity. Immutable, per Runtime and outside snapshots/hash.
    readonly #realtimeConstraintBindings: readonly Readonly<{capabilityId:string;capabilityVersion:string;statePath:string;configKey:string;targetIds:readonly string[]}>[];
    readonly #compactSurvivalEvents: boolean;
    private session: Stage;
    private lastError: A2GameError | null = null;
    private disposed = false;
    // Advisory host diagnostics are deliberately outside deterministic gameplay state.
    private inputDiagnostics: DiagnosticInfo[] = [];
    getInputDiagnostics(): DiagnosticInfo[] { return clone(this.inputDiagnostics); }

    constructor(definition: unknown, registry: CapabilityRegistry, options: HeadlessOptions = {}) {
        this.registry = registry;
        this.plan = compileGame(definition, registry);
        // compileGame has strictly checked every scene/prototype world against initial state.
        // Capture now: the public plan is not a deeply immutable source of later authority.
        const declaredEntities=[...this.plan.definition.scenes.flatMap(scene=>scene.entities),...Object.values(this.plan.definition.prototypes??{})];
        this.#realtimeConstraintBindings=Object.freeze(declaredEntities.flatMap(entity=>entity.components??[])
            .filter(component=>component.capability.id==='a2game.realtime.world')
            .map(component=>Object.freeze({capabilityId:component.capability.id,capabilityVersion:component.capability.version,
                statePath:String(component.config.statePath),configKey:canonicalJson(component.config),
                targetIds:Object.freeze(((component.config.constraints??[]) as JsonRecord[]).map(constraint=>String(constraint.body)))})));

        // Survival has no fixed round length. Retain only recent telemetry by
        // default; callers that explicitly set a hard budget retain that contract.
        this.#compactSurvivalEvents=options.maxRecordedEvents===undefined&&this.plan.entrySceneEntities.some(entity=>
            entity.components?.some(component=>component.capability.id==='a2game.realtime.world'&&component.config.survival!==undefined));
        registry.seal();
        this.opts = {
            maxEventsPerTick: options.maxEventsPerTick ?? 4096,
            maxEffectsPerTick: options.maxEffectsPerTick ?? 4096,
            maxDeferredPerSession: options.maxDeferredPerSession ?? 4096,
            maxEntities: options.maxEntities ?? 1000,
            maxRecordedEvents:options.maxRecordedEvents ?? 100000,
        };
        this.rng = new GameRng(options.seed ?? this.plan.definition.world.clock.seed);
        this.session = this.initialSession(0);
    }
    private initialSession(generation: number): Stage {
        const fields: JsonRecord = {};
        for (const [name, field] of Object.entries(this.plan.definition.state)) fields[name] = clone(field.initial);
        const entities: Record<string, RuntimeEntity> = Object.create(null);
        for (const ent of this.plan.entrySceneEntities) {
            const instantiated = this.instantiate(ent);
            entities[instantiated.id] = instantiated;
        }
        if (Object.keys(entities).length > this.opts.maxEntities) fail('A2G_E_BUDGET_EXCEEDED','Initial entity budget exceeded');
        return {
            generation, tickIndex:0, status:'ready', state:fields, entities,
            rng:this.rng.state(), inputQueue:[], rawQueue:[], activePointers:{},
            deferred:[], timers:[], spawnCounter:0, pressedSources:{}, events:[], sequence:0, eventSerial:0, totalDeferred:0, feedback:[],
        };
    }
    private instantiate(entity: GameEntity): RuntimeEntity {
        const proto = entity.prototype ? this.plan.definition.prototypes?.[entity.prototype] : undefined;
        return {
            id:entity.id,
            tags:[...new Set([...(proto?.tags ?? []), ...(entity.tags ?? [])])].sort(stableCompare),
            state:clone({ ...(proto?.state ?? {}), ...(entity.state ?? {}) }),
            transform:clone({ ...(proto?.transform ?? {}), ...(entity.transform ?? {}) }),
            components:clone([...(proto?.components ?? []), ...(entity.components ?? [])]),
        };
    }
    private assertAlive(): void { if (this.disposed) fail('A2G_E_DISPOSED','Session disposed'); }
    get status(): GameStatus { return this.session.status; }
    /** Read the shared clock without allocating a full observation/event-history copy. */
    get tickIndex(): number { return this.session.tickIndex; }
    get effectiveCapabilities() { return clone(this.plan.effective); }
    start(): void {
        this.assertAlive();
        if (this.session.status === 'ready') { this.session.status = 'playing'; return; }
        if (this.session.status === 'playing') return;
        fail('A2G_E_FLOW','start() only allowed from ready');
    }
    pause(): void {
        this.assertAlive();
        if (this.session.status !== 'playing') return;
        this.session.status = 'paused';
        this.session.inputQueue = [];
        this.session.rawQueue = [];
        this.session.activePointers = {};
        this.session.pressedSources = {};
    }
    resume(): void {
        this.assertAlive();
        if (this.session.status === 'paused') this.session.status = 'playing';
        else if (this.session.status !== 'playing') fail('A2G_E_FLOW','resume() requires paused state');
    }
    stop(): void { this.assertAlive(); this.session.status = 'stopped'; this.session.inputQueue=[]; this.session.rawQueue=[]; }
    restart(seed?: number): void {
        this.assertAlive();
        this.rng.restore(new GameRng(seed ?? this.plan.definition.world.clock.seed).state());
        this.session = this.initialSession(this.session.generation+1);
        this.session.status = 'playing';
        this.lastError = null;
        this.inputDiagnostics = [];
    }
    injectAction(action: NormalizedAction): void {
        this.assertAlive();
        if (this.session.status !== 'playing' && this.session.status !== 'ready') fail('A2G_E_FLOW', 'Gameplay input rejected while inactive');
        const declared = this.plan.definition.inputs.actions.find(x=>x.id===action.action);
        if (!declared) fail('A2G_E_INPUT_ACTION', `Unknown action ${action.action}`);
        if (!['press','hold','release','cancel'].includes(action.phase)) fail('A2G_E_INPUT_ACTION', `Invalid phase ${action.phase}`);
        if (declared.valueType !== 'button' && (action.phase === 'hold' || action.phase === 'press') && action.value === undefined) fail('A2G_E_INPUT_ACTION','Missing analog value');
        const tickIndex = action.tickIndex ?? (action.timeUs === undefined ? this.session.tickIndex : Math.floor(action.timeUs*this.plan.definition.world.clock.tickHz/1000000));
        if (!safeInteger(tickIndex) || tickIndex < this.session.tickIndex) fail('A2G_E_INPUT_ACTION','Input tick in the past');
        const seq = action.seq ?? this.session.sequence++;
        if (!safeInteger(seq) || seq < 0) fail('A2G_E_INPUT_ACTION','Invalid sequence number');
        this.session.inputQueue.push(clone({ ...action, tickIndex, seq, sourceId:action.sourceId ?? `direct:${action.action}`,timeUs:action.timeUs ?? 0 }));
    }
    injectRaw(sample: NormalizedRawInput): void {
        this.assertAlive();
        if (this.session.status !== 'playing' && this.session.status !== 'ready') fail('A2G_E_FLOW','Raw gameplay input rejected while inactive');
        if (!isRecord(sample) || !isRecord(sample.payload) || !['pointer','keyboard','imu','gamepad'].includes(sample.source)) fail('A2G_E_INPUT_RAW','Invalid raw input');
        const tickIndex = sample.tickIndex ?? (sample.timeUs === undefined ? this.session.tickIndex : Math.floor(sample.timeUs*this.plan.definition.world.clock.tickHz/1000000));
        if (!safeInteger(tickIndex) || tickIndex < this.session.tickIndex) fail('A2G_E_INPUT_RAW','Raw input tick in the past');
        const seq = sample.seq ?? this.session.sequence++;
        if (!safeInteger(seq) || seq < 0 || (sample.timeUs !== undefined && !safeInteger(sample.timeUs))) fail('A2G_E_INPUT_RAW','Invalid raw seq/timeUs');
        this.session.rawQueue.push(clone({...sample, tickIndex, seq, timeUs:sample.timeUs ?? 0}));
    }
    /** V0.1 bounded recognizers: touch.tap, touch.swipe and keyboard.button. IMU samples are validated but not yet interpreted. */
    private recognizeRaw(stage: Stage, batch: NormalizedRawInput[], actions: NormalizedAction[]=[]): NormalizedAction[] {
        const emitted: NormalizedAction[] = [];
        const pads=batch.filter(sample=>sample.source==='gamepad');
        if(Object.values(gamepadInputSources).some(id=>this.chosen(id)))emitted.push(...recognizeGamepadInput(stage,pads,this.plan.definition,id=>this.chosen(id)));
        else if(pads.length)fail('A2G_E_CAP_DEPENDENCY','Gamepad input requires a declared recognizer');
        batch=batch.filter(sample=>sample.source!=='gamepad');
        if(mobileInputIds.some(id=>this.chosen(id))){
            emitted.push(...recognizeMobileInput(stage,batch.filter(sample=>sample.source!=='keyboard'),this.plan.definition,id=>this.chosen(id)));
            batch=batch.filter(sample=>sample.source==='keyboard');
        }
        batch.sort((a,b)=>(a.timeUs??0)-(b.timeUs??0) || (a.seq??0)-(b.seq??0) || stableCompare(a.source,b.source));
        // Both edges from one gesture keep its raw sequence. Stable insertion orders
        // press before release without moving the gesture behind later raw samples.
        for (const sample of batch) {
            if (sample.source === 'imu') {
                const p = sample.payload;
                if (sample.kind !== 'sample' || typeof p.reference !== 'string' || !Array.isArray(p.angularVelocityRadps) || p.angularVelocityRadps.length!==3 || !p.angularVelocityRadps.every(safeFinite) || !Array.isArray(p.linearAccelerationMps2) || p.linearAccelerationMps2.length!==3 || !p.linearAccelerationMps2.every(safeFinite)) fail('A2G_E_INPUT_RAW','Malformed normalized IMU sample');
                // Do NOT claim tilt recognizer support: it requires a calibrated capability contract.
                continue;
            }
            if (sample.source === 'pointer') {
                const p = sample.payload, id = String(p.pointerId);
                if (!safeInteger(p.pointerId) || !safeFinite(p.u) || !safeFinite(p.v) || !['down','move','up','cancel'].includes(sample.kind)) fail('A2G_E_INPUT_RAW','Malformed pointer sample');
                if (sample.kind === 'down') {
                    if (stage.activePointers[id]) fail('A2G_E_INPUT_RAW','Duplicate pointer down');
                    stage.activePointers[id] = { timeUs:sample.timeUs!, u:p.u, v:p.v, pointerType:String(p.pointerType ?? 'touch') }; continue;
                }
                const down = stage.activePointers[id];
                if (!down) continue;
                if (sample.kind === 'cancel') { delete stage.activePointers[id]; continue; }
                if (sample.kind === 'move') continue;
                delete stage.activePointers[id];
                const duration = sample.timeUs! - Number(down.timeUs);
                const delta = Math.hypot(Number(p.u)-Number(down.u), Number(p.v)-Number(down.v));
                if (duration < 0) fail('A2G_E_INPUT_RAW','Non-monotonic pointer time');
                const dx = Number(p.u) - Number(down.u), dy = Number(p.v) - Number(down.v);
                const direction = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
                for (const action of this.plan.definition.inputs.actions) {
                    if (!this.chosen('a2game.input.touch.swipe') || action.valueType !== 'button') continue;
                    for (const binding of action.bindings.filter(x => x.source === 'touch.swipe')) {
                        const cfg = binding.config ?? {};
                        const minDistance = safeFinite(cfg.minDistanceNorm) ? cfg.minDistanceNorm : 0.12;
                        const maxDuration = safeFinite(cfg.maxDurationUs) ? cfg.maxDurationUs : 1500000;
                        if (cfg.direction !== direction || delta < minDistance || duration > maxDuration) continue;
                        const sourceId = `touchswipe:${id}:${down.timeUs}`;
                        emitted.push({action:action.id,phase:'press',tickIndex:stage.tickIndex,timeUs:sample.timeUs,seq:sample.seq,sourceId});
                        emitted.push({action:action.id,phase:'release',tickIndex:stage.tickIndex,timeUs:sample.timeUs,seq:sample.seq,sourceId});
                    }
                }
                for (const action of this.plan.definition.inputs.actions) {
                    const binding = action.bindings.find(x=>x.source === 'touch.tap');
                    if (!binding || action.valueType !== 'button' || !this.chosen('a2game.input.touch.tap')) continue;
                    const cfg = binding.config ?? {};
                    const maxDuration = safeFinite(cfg.maxDurationUs) ? cfg.maxDurationUs : 350000;
                    const maxDistance = safeFinite(cfg.maxDistanceNorm) ? cfg.maxDistanceNorm : 0.04;
                    if (duration > maxDuration || delta > maxDistance) continue;
                    const sourceId = `touch:${id}:${down.timeUs}`;
                    emitted.push({action:action.id, phase:'press', tickIndex:stage.tickIndex, timeUs:sample.timeUs, seq:sample.seq, sourceId});
                    emitted.push({action:action.id, phase:'release', tickIndex:stage.tickIndex, timeUs:sample.timeUs, seq:sample.seq, sourceId});
                }
            }
            if (sample.source === 'keyboard') {
                const code = sample.payload.code;
                if (typeof code !== 'string' || !['down','up','cancel'].includes(sample.kind)) fail('A2G_E_INPUT_RAW','Malformed keyboard input');
                for (const action of this.plan.definition.inputs.actions) {
                    if (!this.chosen('a2game.input.keyboard.button')) continue;
                    if (!action.bindings.some(b=>b.source==='keyboard.button' && b.config?.code===code)) continue;
                    emitted.push({ action:action.id, phase:sample.kind==='down'?'press':sample.kind==='up'?'release':'cancel', tickIndex:stage.tickIndex, timeUs:sample.timeUs, seq:sample.seq,sourceId:`keyboard:${code}` });
                }
            }
        }
        // Opt-in held keyboard bindings use the existing pressed-source snapshot ledger.
        // Release/cancel in this Tick suppresses its hold; legacy tap bindings are unchanged.
        if(this.chosen('a2game.input.keyboard.button'))for(const action of this.plan.definition.inputs.actions){
            const bindings=action.bindings.filter(binding=>binding.source==='keyboard.button'&&binding.config?.hold===true);if(!bindings.length)continue;
            for(const sourceId of stage.pressedSources[action.id]??[]){
                const code=sourceId.startsWith('keyboard:')?sourceId.slice(9):undefined;
                if(code===undefined&&!sourceId.startsWith('ui-hold:')||code!==undefined&&!bindings.some(b=>b.config?.code===code))continue;
                if(code!==undefined&&batch.some(sample=>sample.source==='keyboard'&&sample.payload.code===code&&(sample.kind==='up'||sample.kind==='cancel')))continue;
                if(actions.some(a=>a.action===action.id&&a.sourceId===sourceId&&(a.phase==='release'||a.phase==='cancel'))||emitted.some(a=>a.action===action.id&&a.phase==='hold'))continue;
                emitted.push({action:action.id,phase:'hold',sourceId,tickIndex:stage.tickIndex,timeUs:Math.ceil(stage.tickIndex*1000000/this.plan.definition.world.clock.tickHz),seq:0});
            }
        }
        return emitted;
    }
    private chosen(id: string): boolean { return this.plan.effective.capabilities.some(c => c.id === id); }
    private acceptedActions(stage: Stage, actions: NormalizedAction[]): QueuedEvent[] {
        const events: QueuedEvent[] = [];
        actions.sort((a,b)=>(a.timeUs??0)-(b.timeUs??0)||(a.seq??0)-(b.seq??0)||stableCompare(a.sourceId??'',b.sourceId??''));
        for (const a of actions) {
            const id = a.sourceId ?? `direct:${a.action}`;
            const active = stage.pressedSources[a.action] ?? [];
            const previouslyHeld = active.length > 0;
            if (a.phase==='press') {
                if (active.includes(id)) continue; // duplicate physical press / key repeat
                stage.pressedSources[a.action] = [...active,id];
                if (previouslyHeld) continue; // OR semantics: second source doesn't retrigger
            } else if (a.phase==='release' || a.phase==='cancel') {
                if (!active.includes(id)) continue;
                stage.pressedSources[a.action] = active.filter(s=>s!==id);
                if (stage.pressedSources[a.action]!.length > 0) continue;
            } else if (a.phase==='hold' && !active.includes(id)) {
                if (this.inputDiagnostics.length < 20) this.inputDiagnostics.push({ruleId:'input.hold-without-press',tickIndex:stage.tickIndex});
                continue; // Advisory only: preserve the existing ignored-edge semantics.
            }
            const payload: JsonRecord = {action:a.action, edge:a.phase, sourceId:id};
            if (a.value !== undefined) payload.value=clone(a.value);
            if(a.viewportAspect!==undefined){if(!safeFinite(a.viewportAspect)||a.viewportAspect<0.1||a.viewportAspect>10)fail('A2G_E_INPUT_RAW','Invalid action viewport aspect');payload.viewportAspect=a.viewportAspect;}
            events.push(this.makeEvent(stage,'input','input.action',payload,[a.timeUs??0,a.seq??0,id,events.length],{action:a.action,edge:a.phase,sourceId:id}));
        }
        return events;
    }
    private makeEvent(stage: Stage, channel: QueuedEvent['channel'], type: string, payload: JsonRecord, producer: (string|number)[], extra: Partial<RuntimeEvent>={}): QueuedEvent {
        const eventId = `event:${stage.tickIndex}:${stage.eventSerial++}`;
        return {type,payload:clone(payload),channel,producer,eventId,eventIndex:-1,tickIndex:stage.tickIndex,...extra};
    }
    private evaluateEffects(rule: GameRule, event: RuntimeEvent, snapshot: Stage, eventIndex: number): ResolvedEffect[] {
        const exprContext = {state:snapshot.state,entities:snapshot.entities,event:event.payload};
        if (rule.if !== undefined) {
            const result = evaluate(rule.if,exprContext);
            if (typeof result !== 'boolean') fail('A2G_E_RULE_EXPR','Rule condition must be bool',{ruleId:rule.id});
            if (!result) return [];
        }
        return rule.do.map((effect,effectIndex)=>{
            const evaluated: ResolvedEffect = {effect, eventIndex, ruleId:rule.id,effectIndex};
            for (const prop of ['value','min','max'] as const) {
                if (Object.hasOwn(effect, prop)) evaluated[prop] = looksLikeExpression(effect[prop]) ? evaluate(effect[prop] as never,exprContext) : clone(effect[prop] as Json);
            }
            return evaluated;
        });
    }
    private match(rule: GameRule, event: RuntimeEvent): boolean {
        const on = rule.on;
        return on.type===event.type && (on.action===undefined || on.action===event.action) &&
            (on.edge===undefined || on.edge===event.edge) && (on.sourceTag===undefined || on.sourceTag===event.sourceTag);
    }
    private updateState(stage: Stage, path:string, newValue:Json): void {
        const rootName = path.split('/')[1]!.replace(/~1/g,'/').replace(/~0/g,'~');
        const field = this.plan.definition.state[rootName];
        if (!field) fail('A2G_E_STATE_PATH',`Undeclared state ${rootName}`,{jsonPointer:path});
        const temp = clone(stage.state);
        writeExisting(temp,path,newValue);
        checkStateValue(field.type,temp[rootName]!,field.constraints,path);
        stage.state = temp;
    }
    private applyEffect(stage: Stage, resolved: ResolvedEffect): void {
        const {effect:e, value, min, max} = resolved;
        switch (e.op) {
            case 'state.set': this.updateState(stage,e.path as string,value!); return;
            case 'state.add': {
                const old = readPointer(stage.state,e.path as string);
                if (!safeFinite(old) || !safeFinite(value)) fail('A2G_E_STATE_TYPE','state.add requires numeric source and value');
                this.updateState(stage,e.path as string, old+value); return;
            }
            case 'state.clamp': {
                const old=readPointer(stage.state,e.path as string);
                if (!safeFinite(old)||!safeFinite(min)||!safeFinite(max)||min>max) fail('A2G_E_STATE_TYPE','Bad clamp bounds');
                this.updateState(stage,e.path as string, Math.max(min,Math.min(max,old))); return;
            }
            case 'entity.state.set': {
                const entity=stage.entities[e.entity as string];
                if (!entity) fail('A2G_E_ENTITY_REF','Missing entity for write');
                writeExisting(entity.state,e.path as string,value!); return;
            }
            case 'entity.spawn': {
                const proto=this.plan.definition.prototypes?.[e.prototype as string];
                if (!proto) fail('A2G_E_PROTOTYPE_REF','Missing spawn prototype');
                const id=typeof e.id === 'string' ? e.id : `spawn:${e.prototype as string}:${stage.tickIndex}:${stage.spawnCounter++}`;
                if (stage.entities[id]) fail('A2G_E_DUPLICATE_ID',`Spawn ID already exists: ${id}`);
                if (Object.keys(stage.entities).length >= this.opts.maxEntities) fail('A2G_E_BUDGET_EXCEEDED','Active entity limit');
                stage.entities[id] = this.instantiate({id,prototype:e.prototype as string,state:isRecord(e.state) ? e.state as JsonRecord : {}});
                stage.deferred.push({type:'entity.spawned',payload:{entityId:id},sourceTick:stage.tickIndex,localIndex:stage.eventSerial++});
                return;
            }
            case 'entity.despawn': {
                const id=e.entity as string;
                if (stage.entities[id]) {
                    delete stage.entities[id];
                    stage.deferred.push({type:'entity.despawned',payload:{entityId:id},sourceTick:stage.tickIndex,localIndex:stage.eventSerial++});
                }
                return;
            }
            case 'event.emit':
                stage.deferred.push({type:e.eventType as string,payload:clone(isRecord(e.payload)?e.payload as JsonRecord:{}),sourceTick:stage.tickIndex,localIndex:stage.eventSerial++});
                stage.totalDeferred++;
                if (stage.totalDeferred > this.opts.maxDeferredPerSession) fail('A2G_E_BUDGET_EXCEEDED','Session deferred-event limit');
                return;
            case 'timer.schedule': {
                const id=e.id as string, delay=e.delayTicks as number, repeat=e.periodTicks as number|undefined;
                const next = stage.tickIndex + Math.max(1,delay);
                if (stage.timers.some(t=>t.id===id)) fail('A2G_E_TIMER',`Duplicate timer: ${id}`);
                stage.timers.push({id,dueTick:next,periodTicks:repeat,eventType:e.eventType as string,payload:clone(isRecord(e.payload)?e.payload as JsonRecord:{})});
                return;
            }
            case 'feedback.emit':
                stage.feedback.push({type:String(e.cueType),payload:clone(isRecord(e.payload)?e.payload as JsonRecord:{})});
                return;
            case 'flow.pause': stage.status='paused'; stage.inputQueue=[]; stage.rawQueue=[]; stage.pressedSources={}; stage.activePointers={}; return;
            default: fail('A2G_E_CAP_UNKNOWN',`Unsupported effect ${e.op}`);
        }
    }
    private applyModuleProposal(stage:Stage, p: SimulationProposal):void {
        if (p.kind==='state.set') {this.updateState(stage,p.path,p.value);return;}
        if (p.kind==='state.add') {
            const old=readPointer(stage.state,p.path);
            if (!safeFinite(old)||!safeFinite(p.value)) fail('A2G_E_STATE_TYPE','Invalid module numeric write');
            this.updateState(stage,p.path,old+p.value);return;
        }
        if (p.kind==='entity.state.set') {
            const ent=stage.entities[p.entity??'']; if (!ent) fail('A2G_E_ENTITY_REF','Module entity not found');
            writeExisting(ent.state,p.path,p.value);return;
        }
        fail('A2G_E_CAP_NOT_IMPLEMENTED','Unrecognized module proposal');
    }
    private simulateModules(stage:Stage, inputs: readonly RuntimeEvent[], tickRng:GameRng,phase:'simulate'|'physics'='simulate'): {events:QueuedEvent[];proposals:number} {
        const result:QueuedEvent[]=[];
        const components = Object.values(stage.entities).flatMap(e =>
            e.components.map((component,index)=>({entityId:e.id,component,index}))
        ).sort((a,b)=>stableCompare(a.component.capability.id,b.component.capability.id)||stableCompare(a.entityId,b.entityId)||a.index-b.index);
        let moduleProposals = 0;
        for (const [index,entry] of components.entries()) {
            if((this.registry.get(entry.component.capability).phase==='physics')!==(phase==='physics'))continue;
            const impl=this.registry.implementation(entry.component.capability);
            if (impl.role==='headless-presentation'||impl.role==='builtin') continue;
            if (impl.role!=='module'||!impl.simulate) fail('A2G_E_CAP_NOT_IMPLEMENTED','Component has no module simulation');
            const entity=stage.entities[entry.entityId]; if (!entity) continue;
            let resolveRealtimeConstraintTargets:ModuleContext['resolveRealtimeConstraintTargets'];
            if(entry.component.capability.id==='a2game.realtime.world'){
                const configKey=canonicalJson(entry.component.config),ref=entry.component.capability;
                const binding=this.#realtimeConstraintBindings.find(row=>row.capabilityId===ref.id&&row.capabilityVersion===ref.version&&row.statePath===entry.component.config.statePath&&row.configKey===configKey);
                if(!binding)fail('A2G_E_CAP_CONFIG','Realtime component differs from its admitted declaration');
                // JSON cannot supply this function. Trusted application JS is not a cryptographic identity boundary.
                resolveRealtimeConstraintTargets=Object.freeze((config:Readonly<JsonRecord>):readonly string[]=>{
                    if(config.statePath!==binding.statePath||canonicalJson(config)!==binding.configKey)fail('A2G_E_CAP_CONFIG','Realtime constraint provenance does not match its admitted configuration');
                    return binding.targetIds;
                });
            }
            const ctx:ModuleContext = {
                tickIndex:stage.tickIndex,tickHz:this.plan.definition.world.clock.tickHz,entity:clone(entity),
                config:clone(entry.component.config),instanceIndex:entry.index,inputs:clone(inputs),normalizedInputs:clone(stage.activePointers),
                rng:{nextU32:()=>tickRng.nextU32(),randf:()=>tickRng.randf(),randomInt:(min,max)=>tickRng.randomInt(min,max),state:()=>tickRng.state(),restore:state=>tickRng.restore([...state])},
                world:clone({state:stage.state,entities:stage.entities}),
                ...(resolveRealtimeConstraintTargets?{resolveRealtimeConstraintTargets}:{}),
            };
            const output=impl.simulate(ctx);
            moduleProposals += (output.proposals??[]).length;
            if (moduleProposals>this.opts.maxEffectsPerTick) fail('A2G_E_BUDGET_EXCEEDED','Module proposal budget exceeded');
            for (const p of output.proposals??[]) this.applyModuleProposal(stage,p);
            (output.events??[]).forEach((event,i)=> result.push(this.makeEvent(stage,event.type.startsWith('contact.')?'contact':'module',event.type,event.payload??{},event.type.startsWith('contact.')?[String(event.payload?.pair??''),event.type]:[entry.component.capability.id,entry.entityId,index,i],{sourceId:event.sourceId,sourceTag:event.sourceTag})));
        }
        return {events:result,proposals:moduleProposals};
    }
    step(ticks=1): {requested:number;advanced:number;status:GameStatus} {
        this.assertAlive();
        if (!safeInteger(ticks)||ticks<1||ticks>100000) fail('A2G_E_BUDGET_EXCEEDED','step ticks must be 1..100000');
        let advanced=0;
        while (advanced<ticks && this.session.status==='playing') {
            this.tick();
            advanced++;
        }
        return {requested:ticks,advanced,status:this.session.status};
    }
    private tick():void {
        const t=this.session.tickIndex;
        const history=this.session.events;
        // The append-only history is outside staged effects and rule reads.
        const working:Stage = clone({...this.session,events:[]});
        const tickRng=new GameRng(0);tickRng.restore(working.rng);
        try {
            // T1/T2: semantic actions + bounded normalized raw recognizers.
            const raw=working.rawQueue.filter(x=>x.tickIndex===t);
            working.rawQueue=working.rawQueue.filter(x=>x.tickIndex!==t);
            const actions=working.inputQueue.filter(x=>x.tickIndex===t);
            working.inputQueue=working.inputQueue.filter(x=>x.tickIndex!==t);
            actions.push(...this.recognizeRaw(working,raw,actions));
            const events:QueuedEvent[]=this.acceptedActions(working,actions);
            // T3: repeat timers advance from old dueTick (never from wall time).
            const due=working.timers.filter(x=>x.dueTick<=t).sort((a,b)=>a.dueTick-b.dueTick||stableCompare(a.id,b.id));
            working.timers=working.timers.filter(x=>x.dueTick>t);
            for (const timer of due) {
                events.push(this.makeEvent(working,'timer',timer.eventType,timer.payload,[timer.dueTick,timer.id],{sourceId:timer.id}));
                if (timer.periodTicks!==undefined) working.timers.push({...timer,dueTick:timer.dueTick+timer.periodTicks});
            }
            // T4: trusted discrete modules. T5: checkpointable fixed-tick physics profile.
            const modules=this.simulateModules(working,events.map(eventView),tickRng);
            events.push(...modules.events);
            const physics=this.simulateModules(working,events.map(eventView),tickRng,'physics');
            modules.proposals+=physics.proposals;events.push(...physics.events);
            if(modules.proposals>this.opts.maxEffectsPerTick)fail('A2G_E_BUDGET_EXCEEDED','Combined simulation proposal budget exceeded');
            // T6: deferred events created before this tick; generated ones wait for next tick.
            const ready=working.deferred.filter(x=>x.sourceTick<t).sort((a,b)=>a.sourceTick-b.sourceTick||a.localIndex-b.localIndex);
            working.deferred=working.deferred.filter(x=>x.sourceTick>=t);
            for (const d of ready) events.push(this.makeEvent(working,'deferred',d.type,d.payload,[d.sourceTick,d.localIndex]));
            if (events.length>this.opts.maxEventsPerTick) fail('A2G_E_BUDGET_EXCEEDED','Event budget exceeded');
            events.sort(eventSort);
            events.forEach((event,i)=>event.eventIndex=i);
            // Immutable S_sim for all rule conditions and RHS expressions.
            const sim=clone(working);
            const effects:ResolvedEffect[]=[];
            for (const event of events) for (const rule of this.plan.rules) {
                if (!this.match(rule,event)) continue;
                effects.push(...this.evaluateEffects(rule,event,sim,event.eventIndex));
                if (effects.length+modules.proposals>this.opts.maxEffectsPerTick) fail('A2G_E_BUDGET_EXCEEDED','Effect budget exceeded');
            }
            // T8: sequential effects on unobservable staged copy.
            for (const e of effects) {
                try { this.applyEffect(working,e); }
                catch (error) {
                    if (error instanceof A2GameError) fail('A2G_E_TICK_COMMIT',`Effect failed: ${error.message}`,{tickIndex:t,ruleId:e.ruleId,jsonPointer:error.info.jsonPointer,detail:error.code});
                    throw error;
                }
            }
            // T9: all outcome predicates read *one* committed S_post.
            if (working.status==='playing') {
                const outcomeCtx={state:working.state,entities:working.entities};
                const outcomes=[...this.plan.definition.outcomes].sort((a,b)=>(a.priority??0)-(b.priority??0)||stableCompare(a.id,b.id));
                for (const outcome of outcomes) {
                    const valid=evaluate(outcome.when,outcomeCtx);
                    if (typeof valid!=='boolean') fail('A2G_E_RULE_EXPR','Outcome predicate must be boolean');
                    if (valid) {
                        working.status=outcome.status;
                        const finalEvent=this.makeEvent(working,'outcome',`game.${outcome.status}`,{outcomeId:outcome.id},[0]);
                        finalEvent.eventIndex=events.length;
                        events.push(finalEvent);
                        break;
                    }
                }
            }
            // Retain recent survival telemetry only after this Tick completes successfully.
            const retainedHistory=this.#compactSurvivalEvents?history.slice(Math.max(0,history.length-Math.max(0,128-events.length))):history;
            if (retainedHistory.length + events.length > this.opts.maxRecordedEvents) fail('A2G_E_BUDGET_EXCEEDED','Recorded event limit exceeded');
            const recorded=events.map(eventView);
            working.tickIndex=t+1;
            working.rng=tickRng.state();
            this.rng.restore(working.rng);
            // T10: only now publish the complete staged state.
            retainedHistory.push(...recorded);
            working.events=retainedHistory;
            this.session=working;
        } catch (error) {
            this.session.status='error'; // preserve all other state from tick boundary
            const diag=error instanceof A2GameError ? error : new A2GameError('A2G_E_RUNTIME',String(error));
            this.lastError=diag;
            throw diag;
        }
    }
    observe({recentEvents}: {recentEvents?:number}={}): SessionObservation {
        this.assertAlive();
        const s=this.session;
        if(recentEvents!==undefined&&(!safeInteger(recentEvents)||recentEvents<0))
            fail('A2G_E_BUDGET_EXCEEDED','Recent event limit must be a nonnegative integer');
        const events=recentEvents===undefined?s.events:recentEvents?s.events.slice(-recentEvents):[];
        return {
            tickIndex:s.tickIndex,flow:{status:s.status},state:clone(s.state),entities:clone(s.entities),events:clone(events),
            diagnostics:this.lastError ? [{code:this.lastError.code,message:this.lastError.message,tickIndex:this.lastError.info.tickIndex,jsonPointer:this.lastError.info.jsonPointer,ruleId:this.lastError.info.ruleId}]:[],
            exactHash:exactStateHash(s),exactHashVersion:1,
        };
    }
    snapshot(): SessionSnapshot {
        this.assertAlive();
        return clone({...this.session,rng:this.rng.state()});
    }
    restore(snapshot: SessionSnapshot): void {
        this.assertAlive();
        if (snapshot.generation!==this.session.generation) fail('A2G_E_SNAPSHOT','Snapshot belongs to a different SessionGeneration');
        this.rng.restore(snapshot.rng);
        this.session=clone(snapshot);
        this.lastError=null;
        this.inputDiagnostics=[];
    }
    debugRng():number { this.assertAlive(); const value = this.rng.nextU32(); this.session.rng = this.rng.state(); return value; }
    getFeedback():JsonRecord[] { return clone(this.session.feedback); }
    dispose():void { if (this.disposed) return; this.disposed=true; this.inputDiagnostics=[]; this.session.inputQueue=[];this.session.rawQueue=[];this.session.activePointers={};this.session.pressedSources={};this.session.events=[];this.session.timers=[];this.session.deferred=[];this.session.feedback=[]; }
}
