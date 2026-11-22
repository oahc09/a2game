// Compatibility entry point for existing commands and configurations.
export * from '../generator/adapters/codex-generator.mjs';
import {pathToFileURL} from 'node:url';
import {runRecordedOutputCli} from '../generator/adapters/codex-generator.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecordedOutputCli();
}
