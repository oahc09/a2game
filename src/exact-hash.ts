/** Engine-neutral RFC 8785 (JCS) canonical JSON and synchronous SHA-256. */
import { fail } from './errors.js';
import type { Json, SessionSnapshot } from './types.js';

function assertValidUnicode(s: string): void {
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (c >= 0xd800 && c <= 0xdbff) {
            const next = s.charCodeAt(i + 1);
            if (!(next >= 0xdc00 && next <= 0xdfff)) fail('A2G_E_HASH_CANONICAL', 'Lone high surrogate is not valid I-JSON');
            i++;
        } else if (c >= 0xdc00 && c <= 0xdfff) {
            fail('A2G_E_HASH_CANONICAL', 'Lone low surrogate is not valid I-JSON');
        }
    }
}
/** RFC 8785 sorts object keys by UTF-16 code units (not UTF-8 byte order). */
export function canonicalJson(value: Json): string {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'string') { assertValidUnicode(value); return JSON.stringify(value); }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) fail('A2G_E_HASH_CANONICAL', 'Cannot hash non-finite values');
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        for(let i=0;i<value.length;i++) if(!Object.hasOwn(value,i)) fail('A2G_E_HASH_CANONICAL','Sparse array is not valid JSON');
        return `[${value.map(canonicalJson).join(',')}]`;
    }
    if (typeof value === 'object') {
        const keys = Object.keys(value).sort();
        return `{${keys.map(k => {
            assertValidUnicode(k);
            const v = (value as Record<string, Json>)[k];
            if (v === undefined) fail('A2G_E_HASH_CANONICAL', 'Non-JSON object field');
            return `${JSON.stringify(k)}:${canonicalJson(v)}`;
        }).join(',')}}`;
    }
    fail('A2G_E_HASH_CANONICAL', 'Cannot hash a non-JSON value');
}

const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);
const rotate = (n: number, shift: number): number => (n >>> shift) | (n << (32 - shift));
/** No Node/browser crypto dependency; output is lowercase hex. */
export function sha256Hex(bytes: Uint8Array): string {
    const len = bytes.length;
    if (!Number.isSafeInteger(len)) fail('A2G_E_BUDGET_EXCEEDED', 'SHA-256 input too large');
    const size = Math.ceil((len + 9) / 64) * 64;
    const data = new Uint8Array(size);
    data.set(bytes); data[len] = 0x80;
    const bitLength = BigInt(len) * 8n;
    for (let j = 0; j < 8; j++) data[size - 1 - j] = Number((bitLength >> BigInt(8 * j)) & 255n);
    const h = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    const w = new Uint32Array(64);
    for (let off = 0; off < size; off += 64) {
        for (let i = 0; i < 16; i++) {
            const p = off + i * 4;
            w[i] = ((data[p]! << 24) | (data[p+1]! << 16) | (data[p+2]! << 8) | data[p+3]!) >>> 0;
        }
        for (let i = 16; i < 64; i++) {
            const a = w[i-15]!, b = w[i-2]!;
            const s0 = rotate(a,7) ^ rotate(a,18) ^ (a>>>3);
            const s1 = rotate(b,17) ^ rotate(b,19) ^ (b>>>10);
            w[i] = (w[i-16]! + s0 + w[i-7]! + s1)>>>0;
        }
        let [a,b,c,d,e,f,g,q] = [...h];
        for (let i = 0; i < 64; i++) {
            const s1 = rotate(e!,6) ^ rotate(e!,11) ^ rotate(e!,25);
            const t1 = (q! + s1 + ((e! & f!) ^ (~e! & g!)) + K[i]! + w[i]!) >>> 0;
            const s0 = rotate(a!,2) ^ rotate(a!,13) ^ rotate(a!,22);
            const t2 = (s0 + ((a! & b!) ^ (a! & c!) ^ (b! & c!))) >>> 0;
            q=g;g=f;f=e;e=(d!+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
        }
        for (const [i,v] of [a,b,c,d,e,f,g,q].entries()) h[i] = (h[i]!+v!)>>>0;
    }
    return [...h].map(v=>v.toString(16).padStart(8,'0')).join('');
}

export function sha256Canonical(value: Json): string { return sha256Hex(new TextEncoder().encode(canonicalJson(value))); }

/** Exact logical projection v1. Presentation, GPU, physics float transforms and wall clock excluded.
 * Fields contributing to future gameplay (e.g. held source/gesture state) are included; external
 * not-yet-consumed InputTrace items remain separate external input and are not hashed here.
 */
export function exactStateProjection(s: Readonly<SessionSnapshot>): Json {
    const entities = Object.values(s.entities).map(e=>({id:e.id,tags:[...e.tags].sort(),state:e.state})).sort((a,b)=>a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const timers = [...s.timers].sort((a,b)=>a.dueTick-b.dueTick||(a.id<b.id?-1:a.id>b.id?1:0))
        .map(t=>({id:t.id,dueTick:t.dueTick,eventType:t.eventType,payload:t.payload,...(t.periodTicks === undefined ? {} : {periodTicks:t.periodTicks})}));
    const deferred = [...s.deferred].sort((a,b)=>a.sourceTick-b.sourceTick||a.localIndex-b.localIndex||(a.type<b.type?-1:a.type>b.type?1:0));
    return {
        projectionVersion:1,
        tickIndex:s.tickIndex,
        flow:s.status,
        state:s.state,
        entities,
        rng:s.rng,
        timers,
        spawnCounter:s.spawnCounter,
        deferred,
        pressedSources:s.pressedSources,
        activePointers:s.activePointers,
    } as unknown as Json;
}
export function exactStateHash(s: Readonly<SessionSnapshot>): string { return sha256Canonical(exactStateProjection(s)); }
