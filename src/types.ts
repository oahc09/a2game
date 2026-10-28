/** A2Game V0.1 draft public contracts. No engine-specific imports. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonRecord = Record<string, Json>;
export type CapabilityRef = { id: string; version: string };
export type GameStatus = 'ready' | 'playing' | 'paused' | 'won' | 'lost' | 'stopped' | 'error';
export type ActionPhase = 'press' | 'hold' | 'release' | 'cancel';
export type StateType = 'bool' | 'int' | 'number' | 'string' | 'vec2' | 'vec3' | 'enum' | 'entityRef' | 'array' | 'object';
export type Expression =
    | { const: Json }
    | { state: string }
    | { event: string }
    | { entityState: { entity: string; path: string } }
    | { op: string; args: Expression[] };
export interface StateField { type: StateType; initial: Json; constraints?: JsonRecord; }
export interface GameEntity {
    id: string;
    prototype?: string;
    tags?: string[];
    state?: JsonRecord;
    transform?: JsonRecord;
    components?: { capability: CapabilityRef; config: JsonRecord }[];
}
export interface GameScene { id: string; entities: GameEntity[]; }
export interface GameRule {
    id: string;
    priority?: number;
    on: { type: string; action?: string; edge?: ActionPhase; sourceTag?: string };
    if?: Expression;
    do: Effect[];
}
export interface Effect { op: string; [key: string]: unknown; }
export interface GameOutcome { id: string; status: 'won' | 'lost' | 'stopped'; priority?: number; when: Expression; }
export interface GameDefinition {
    format: 'a2game'; specVersion: '0.1.0'; id: string; revision: number;
    meta: { title: string; [key: string]: Json };
    requires: { all: CapabilityRef[]; anyOf?: CapabilityRef[][] };
    world: { dimension: '2d' | '3d'; coordinateSystem: 'rh-y-up'; units: 'meter'; clock: { tickHz: 30 | 60 | 120; seed: number; maxCatchUpTicks?: number } };
    assets?: Record<string, { uri: string; type: string; integrity?: string }>;
    prototypes?: Record<string, GameEntity>;
    scenes: GameScene[]; entryScene: string;
    state: Record<string, StateField>;
    inputs: { actions: { id: string; valueType: string; policy?: string; bindings: { source: string; config?: JsonRecord }[] }[]; traceRecording?: string };
    rules: GameRule[]; outcomes: GameOutcome[];
    presentation: JsonRecord;
    tests?: string[]; extensions?: JsonRecord;
}
export interface CapabilityManifest {
    format: 'a2game-capability'; manifestVersion: '0.1.0'; id: string; version: string;
    kind: 'core' | 'behavior' | 'rule-op' | 'input-source' | 'recognizer' | 'service' | 'presentation';
    portability: 'exact' | 'tolerant' | 'host-defined';
    description: string;
    phase: 'collect' | 'normalize' | 'recognize' | 'simulate' | 'physics' | 'rule' | 'commit' | 'observe' | 'present';
    dependencies: CapabilityRef[];
    contract: {
        configSchema: JsonRecord; stateSchema: JsonRecord;
        commands: { name: string; payloadSchema: JsonRecord }[];
        events: { name: string; payloadSchema: JsonRecord }[];
        stateWrites: string[]; lifecycle: string[];
    };
    testSuites: string[];
    permissions?: string[];
    limits?: JsonRecord;
    extensions?: JsonRecord;
}
export interface RuntimeEntity { id: string; tags: string[]; state: JsonRecord; transform: JsonRecord; components: { capability: CapabilityRef; config: JsonRecord }[]; }
export interface RuntimeEvent {
    type: string; tickIndex: number; eventIndex: number;
    channel: 'input' | 'timer' | 'module' | 'contact' | 'deferred' | 'outcome';
    eventId: string;
    payload: JsonRecord;
    action?: string; edge?: ActionPhase;
    sourceId?: string; sourceTag?: string;
}
export interface IncomingEvent {
    type: string; payload?: JsonRecord; sourceId?: string; sourceTag?: string;
}
export interface SimulationProposal {
    /** Module updates are written to a *staged*, unpublished state. */
    kind: 'state.set' | 'state.add' | 'entity.state.set';
    path: string; value: Json; entity?: string;
}
export interface ModuleContext {
    tickIndex: number; tickHz: number;
    entity: Readonly<RuntimeEntity>; config: Readonly<JsonRecord>; instanceIndex: number;
    inputs: ReadonlyArray<RuntimeEvent>;
    normalizedInputs?:Readonly<Record<string,JsonRecord>>;
    rng: Readonly<{ nextU32(): number; randf(): number; randomInt(min: number, maxInclusive: number): number; state():number[]; restore(state:readonly number[]):void }>;
    world: Readonly<{ state: JsonRecord; entities: Record<string, RuntimeEntity> }>;
}
export interface ModuleResult { proposals?: SimulationProposal[]; events?: IncomingEvent[]; }
export interface TrustedCapabilityImplementation {
    /** Registered exclusively by the trusted application, never read from JSON. */
    role: 'builtin' | 'rule-op' | 'module' | 'headless-presentation' | 'recognizer';
    simulate?(ctx: ModuleContext): ModuleResult;
}
export interface NormalizedAction {
    action: string; phase: ActionPhase; value?: Json; sourceId?: string;
    viewportAspect?:number;
    tickIndex?: number; timeUs?: number; seq?: number;
}
export interface NormalizedRawInput {
    source: string; kind: string; tickIndex?: number; seq?: number; timeUs?: number; payload: JsonRecord;
}
export interface DeferredEvent {
    type: string; payload: JsonRecord; sourceTick: number; localIndex: number;
}
export interface TimerRecord { id: string; dueTick: number; periodTicks?: number; eventType: string; payload: JsonRecord; }
export interface SessionObservation {
    tickIndex: number;
    flow: { status: GameStatus };
    state: JsonRecord;
    entities: Record<string, RuntimeEntity>;
    events: RuntimeEvent[];
    diagnostics: { code: string; message: string; tickIndex?: number; jsonPointer?: string; ruleId?: string }[];
    exactHash: string;
    exactHashVersion: 1;
}
export interface SessionSnapshot {
    generation: number; tickIndex: number; status: GameStatus; state: JsonRecord;
    entities: Record<string, RuntimeEntity>; rng: number[]; inputQueue: NormalizedAction[];
    rawQueue: NormalizedRawInput[]; activePointers: Record<string, JsonRecord>;
    deferred: DeferredEvent[]; timers: TimerRecord[]; spawnCounter: number;
    pressedSources: Record<string, string[]>;
    events: RuntimeEvent[]; sequence: number; eventSerial: number;
    totalDeferred: number; feedback: JsonRecord[];
}
export interface ConformanceSuite {
    format: 'a2game-conformance'; specVersion: '0.1.0'; suiteId: string;
    subject: { type: 'game'; id: string; file: string };
    cases: { id: string; seed?: number; steps: Array<Record<string, unknown>> }[];
}
