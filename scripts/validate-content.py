#!/usr/bin/env python3
"""Full Draft 2020-12 admission over stdin; no user paths, remote schemas or writes."""
import json
import sys
from itertools import islice
from pathlib import Path
from importlib.metadata import version
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]


def unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'重复 JSON 键：{key}')
        result[key] = value
    return result


def reject_constant(value):
    raise ValueError(f'不允许的 JSON 常量：{value}')


def pointer(parts):
    return ''.join('/' + str(part).replace('~', '~0').replace('/', '~1') for part in parts)


def main():
    payload = json.load(sys.stdin)
    try:
        json.loads(payload['text'], object_pairs_hook=unique_pairs, parse_constant=reject_constant)
    except (ValueError, RecursionError) as error:
        print(json.dumps({'status': 'FAIL', 'stage': 'parse', 'errors': [{'pointer': '', 'message': str(error)[:400]}]}))
        return 1
    # Validate the JS-parsed numeric representation that the actual Runtime consumes.
    game, manifests = payload['game'], payload['manifests']
    errors = []
    checked_schemas = {}

    def validate(value, schema, prefix=''):
        # The trusted capability meta-schema is shared by all manifests in this
        # admission. Check each schema object once; still validate every value.
        schema_identity = id(schema)
        if schema_identity not in checked_schemas:
            Draft202012Validator.check_schema(schema)
            checked_schemas[schema_identity] = schema
        for error in islice(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(value), 20 - len(errors)):
            parts = list(error.absolute_path)
            if error.validator == 'required' and isinstance(error.instance, dict):
                missing = [key for key in error.validator_value if key not in error.instance]
                if missing:
                    parts.append(missing[0])
            location = prefix + pointer(parts)
            row = {'pointer': location if len(location) <= 256 else '', 'message': error.message[:400]}
            if error.validator in ('const', 'type', 'minimum', 'maximum', 'minLength', 'maxLength'):
                row['expected'] = error.validator_value
                if error.instance is None or isinstance(error.instance, (int, float, bool)) or isinstance(error.instance, str) and len(error.instance) <= 80:
                    row['actual'] = error.instance
            errors.append(row)

    schemas = ROOT / 'specs' / 'v0.1' / 'schemas'
    validate(game, json.loads((schemas / 'game.schema.json').read_text(encoding='utf-8')))
    capability_schema = json.loads((schemas / 'capability.schema.json').read_text(encoding='utf-8'))
    for index, manifest in enumerate(manifests):
        validate(manifest, capability_schema, f'/trustedCapabilities/{index}')
    if not errors:
        catalog = {(item['id'], item['version']): item for item in manifests}
        entities = [(entity, f'/scenes/{si}/entities/{ei}') for si, scene in enumerate(game['scenes']) for ei, entity in enumerate(scene['entities'])]
        entities += [(entity, '/prototypes/' + key.replace('~', '~0').replace('/', '~1')) for key, entity in game.get('prototypes', {}).items()]
        for entity, base in entities:
            for ci, component in enumerate(entity.get('components', [])):
                ref = component['capability']
                manifest = catalog.get((ref['id'], ref['version']))
                if manifest:
                    validate(component['config'], manifest['contract']['configSchema'], f'{base}/components/{ci}/config')
        aliases = {cap_id[len('a2game.input.'):]: cap_id for cap_id, cap_version in catalog if cap_id.startswith('a2game.input.') and cap_version == '0.1.0'}
        for ai, action in enumerate(game['inputs']['actions']):
            for bi, binding in enumerate(action['bindings']):
                manifest = catalog.get((aliases.get(binding['source']), '0.1.0'))
                if manifest:
                    validate(binding.get('config', {}), manifest['contract']['configSchema'], f'/inputs/actions/{ai}/bindings/{bi}/config')
    print(json.dumps({'status': 'FAIL' if errors else 'PASS', 'stage': 'schema', 'errors': errors,
                     'validator': f'python-jsonschema/{version("jsonschema")} Draft202012Validator (full dialect)'}, ensure_ascii=True))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
