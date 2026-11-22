// Compatibility entry point for existing commands and configurations.
export * from '../generator/adapters/model-generator.mjs';
import {pathToFileURL} from 'node:url';
import {runModelGeneratorCli} from '../generator/adapters/model-generator.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runModelGeneratorCli();
}
