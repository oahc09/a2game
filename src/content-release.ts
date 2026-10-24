import { fail } from './errors.js';
import { sha256Canonical } from './exact-hash.js';
import type { GameDefinition, Json, CapabilityManifest } from './types.js';
import { stableCompare } from './utils.js';

/** Application admission profile; independent of the GameSpec protocol version. */
export const CONTENT_PROFILE = 'scene2d-local-release-v1';
export const CONTENT_MAX_BYTES = 256 * 1024;
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
    validator: string;
    createdAt: string;
}
/** Only consume a receipt fetched from the trusted same-origin admission service. */
export function verifyReleasedGame(raw: unknown, expectedDigest: string, manifestDigest: string): GameDefinition {
    const envelope = raw as { receipt?: ContentReceipt; definition?: GameDefinition } | null;
    const receipt = envelope?.receipt, game = envelope?.definition;
    if (!receipt || !game || receipt.format !== 'a2game-content-release' || receipt.receiptVersion !== 1 ||
        receipt.status !== 'PASS' || receipt.profile !== CONTENT_PROFILE || !/^[a-f0-9]{64}$/.test(expectedDigest) ||
        !/^[a-f0-9]{64}$/.test(receipt.contextDigest) || !receipt.validator?.includes('Draft202012Validator (full dialect)') ||
        receipt.sha256Jcs !== expectedDigest || sha256Canonical(game as unknown as Json) !== expectedDigest ||
        receipt.id !== game.id || receipt.revision !== game.revision || receipt.manifestDigest !== manifestDigest)
        fail('A2G_E_RELEASE_INTEGRITY', 'Content or capability context differs from the validated release');
    return structuredClone(game);
}
