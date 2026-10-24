import { fail } from './errors.js';
import { sha256Canonical } from './exact-hash.js';
import type { GameDefinition, Json, CapabilityManifest } from './types.js';
import { stableCompare } from './utils.js';

/** Application admission profile; independent of the GameSpec protocol version. */
export const CONTENT_PROFILE = 'trusted-reference-host-v1';
export const CONTENT_MAX_BYTES = 256 * 1024;
export const CONTENT_BUNDLE_MAX_BYTES = 1024 * 1024;
export interface ReleasedResource {
    id: string; uri: string; type: string; integrity: string; sha256: string; bytes: number; href: string;
}
export function capabilityManifestDigest(manifests: CapabilityManifest[]): string {
    const sorted = [...manifests].sort((a,b) => stableCompare(`${a.id}@${a.version}`, `${b.id}@${b.version}`));
    return sha256Canonical(sorted as unknown as Json);
}
export interface ContentReceipt {
    format: 'a2game-content-release';
    receiptVersion: 1;
    status: 'PASS';
    profile: typeof CONTENT_PROFILE;
    id: string;
    revision: number;
    sha256Jcs: string;
    manifestDigest: string;
    contextDigest: string;
    resourcesDigest: string;
    validator: string;
    createdAt: string;
}
/** Only consume a receipt fetched from the trusted same-origin admission service. */
export function verifyReleasedGame(raw: unknown, expectedDigest: string, manifestDigest: string): GameDefinition {
    const envelope = raw as { receipt?: ContentReceipt; definition?: GameDefinition; resources?: ReleasedResource[] } | null;
    const receipt = envelope?.receipt, game = envelope?.definition;
    if (!receipt || !game || receipt.format !== 'a2game-content-release' || receipt.receiptVersion !== 1 ||
        receipt.status !== 'PASS' || receipt.profile !== CONTENT_PROFILE || !/^[a-f0-9]{64}$/.test(expectedDigest) ||
        !/^[a-f0-9]{64}$/.test(receipt.contextDigest) || typeof receipt.validator !== 'string' || !receipt.validator.includes('Draft202012Validator (full dialect)') ||
        receipt.sha256Jcs !== expectedDigest || sha256Canonical(game as unknown as Json) !== expectedDigest ||
        receipt.id !== game.id || receipt.revision !== game.revision || receipt.manifestDigest !== manifestDigest)
        fail('A2G_E_RELEASE_INTEGRITY', 'Content or capability context differs from the validated release');
    verifyResourceRecords(game, envelope!.resources, receipt.resourcesDigest);
    return structuredClone(game);
}
export function verifyResourceRecords(game: GameDefinition, resources: unknown, expectedDigest: string): asserts resources is ReleasedResource[] {
    if (!Array.isArray(resources) || sha256Canonical(resources) !== expectedDigest || resources.length !== Object.keys(game.assets ?? {}).length || new Set(resources.map(item => item.id)).size !== resources.length)
        fail('A2G_E_RESOURCE_INTEGRITY', 'Resource receipt differs from the released assets');
    for (const item of resources) {
        const asset = game.assets?.[item.id];
        if (!asset || item.uri !== asset.uri || item.type !== asset.type || item.integrity !== asset.integrity ||
            !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isInteger(item.bytes) || item.bytes < 1 || item.bytes > 8388608 || item.href !== `/api/assets/${item.sha256}`)
            fail('A2G_E_RESOURCE_INTEGRITY', 'Invalid approved resource receipt');
    }
}
