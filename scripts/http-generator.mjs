// Compatibility entry point for existing commands and configurations.
export * from '../generator/adapters/http-generator.mjs';
import {pathToFileURL} from 'node:url';
import {runHttpGeneratorCli} from '../generator/adapters/http-generator.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runHttpGeneratorCli();
}
