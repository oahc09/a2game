import { fail } from './errors.js';
import { safeInteger } from './utils.js';
/** xoshiro128** / fmix32 seed expansion. Wire-level algorithm: A2Game Runtime V0.1 section 8. */
export class GameRng {
    private words: number[];
    constructor(seed: number) {
        if (!safeInteger(seed) || seed < 0 || seed > 0xffffffff) fail('A2G_E_RNG_SEED', 'Expected uint32 seed');
        let x = seed >>> 0;
        this.words = [];
        for (let i = 0; i < 4; i++) {
            x = (x + 0x9e3779b9) >>> 0;
            let n = x;
            n ^= n >>> 16; n = Math.imul(n, 0x85ebca6b) >>> 0;
            n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35) >>> 0;
            n ^= n >>> 16;
            this.words.push(n >>> 0);
        }
        if (this.words.every(n => n === 0)) this.words = [1, 0, 0, 0];
    }
    state(): number[] { return [...this.words]; }
    restore(words: number[]): void {
        if (words.length !== 4 || words.some(n => !safeInteger(n) || n < 0 || n > 0xffffffff) || words.every(n => n === 0)) fail('A2G_E_RNG_STATE', 'Invalid xoshiro state');
        this.words = [...words];
    }
    nextU32(): number {
        const s = this.words;
        const rot = (x: number, k: number): number => ((x << k) | (x >>> (32 - k))) >>> 0;
        const result = Math.imul(rot(Math.imul(s[1]!, 5) >>> 0, 7), 9) >>> 0;
        const t = s[1]! << 9;
        s[2] = (s[2]! ^ s[0]!) >>> 0;
        s[3] = (s[3]! ^ s[1]!) >>> 0;
        s[1] = (s[1]! ^ s[2]!) >>> 0;
        s[0] = (s[0]! ^ s[3]!) >>> 0;
        s[2] = (s[2]! ^ t) >>> 0;
        s[3] = rot(s[3]!, 11);
        return result;
    }
    randf(): number { return (this.nextU32() >>> 8) / 0x1000000; }
    randomInt(min: number, max: number): number {
        if (!safeInteger(min) || !safeInteger(max) || max < min || max - min + 1 > 0x100000000) fail('A2G_E_RNG_RANGE', 'Invalid randomInt range');
        const span = max - min + 1;
        const limit = Math.floor(0x100000000 / span) * span;
        let u: number;
        do { u = this.nextU32(); } while (u >= limit);
        return min + (u % span);
    }
}
