"""Read-only full Draft 2020-12 validation of formal CoverageResult receipts."""
import json
from pathlib import Path
import sys
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
directory = Path(sys.argv[1]).resolve()
if not directory.is_relative_to(ROOT / 'reports'):
    raise ValueError('Acceptance archive must stay under reports/')
schema = json.loads((ROOT / 'specs/v0.1/schemas/coverage-result.schema.json').read_text(encoding='utf-8'))
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema)
files = sorted(directory.glob('*-full.receipt.json'))
errors = [{'file': p.name, 'message': e.message} for p in files for e in validator.iter_errors(json.loads(p.read_text(encoding='utf-8')))]
if len(files) != 74:
    errors.append({'message': 'Expected 37 games x 2 SDKs = 74 formal receipts'})
print(json.dumps({'format': 'a2game-formal-receipt-schema-check', 'status': 'FAIL' if errors else 'PASS', 'documents': len(files), 'schema': 'specs/v0.1/schemas/coverage-result.schema.json', 'errors': errors}))
raise SystemExit(1 if errors else 0)
