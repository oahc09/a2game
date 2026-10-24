export interface DiagnosticInfo {
    jsonPointer?: string; tickIndex?: number; ruleId?: string;
    capabilityId?: string; entityId?: string; detail?: string;
}
/** Codes are part of the wire contract and must not leak platform-specific stack data. */
export class A2GameError extends Error {
    readonly code: string;
    readonly info: DiagnosticInfo;
    constructor(code: string, message: string, info: DiagnosticInfo = {}) {
        super(`${code}: ${message}`);
        this.name = 'A2GameError';
        this.code = code;
        this.info = info;
    }
}
export function fail(code: string, message: string, info?: DiagnosticInfo): never {
    throw new A2GameError(code, message, info);
}
export function requireCondition(ok: unknown, code: string, message: string, pointer?: string): asserts ok {
    if (!ok) fail(code, message, pointer ? { jsonPointer: pointer } : undefined);
}
