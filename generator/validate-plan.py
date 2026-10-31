"""Strict bytes + full internal Draft 2020-12 schema. Fixed local schema only."""
import json
import sys
from pathlib import Path
from itertools import islice
from jsonschema import Draft202012Validator

def unique(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError('Duplicate JSON key')
        value[key] = item
    return value

try:
    text = json.load(sys.stdin)['text']
    if len(text.encode('utf-8')) > 64 * 1024:
        raise ValueError('GamePlan exceeds 64 KiB')
    plan = json.loads(text, object_pairs_hook=unique, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Non-finite number')))
    schema = json.loads((Path(__file__).parent / 'game-plan.schema.json').read_text(encoding='utf-8'))
    Draft202012Validator.check_schema(schema)
    errors = [{'pointer': ''.join('/' + str(p).replace('~', '~0').replace('/', '~1') for p in e.absolute_path), 'message': e.message[:300]} for e in islice(Draft202012Validator(schema).iter_errors(plan), 20)]
    print(json.dumps({'status': 'FAIL' if errors else 'PASS', 'diagnostics': errors, 'plan': plan if not errors else None}, ensure_ascii=False, allow_nan=False))
except (ValueError, KeyError, RecursionError):
    print(json.dumps({'status': 'FAIL', 'diagnostics': [{'pointer': '', 'message': 'GamePlan must be bounded strict JSON without duplicate keys.'}]}))
