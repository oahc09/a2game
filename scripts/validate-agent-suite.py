"""Read-only full Draft 2020-12 conformance validation for the agent workflow."""
import json,sys,pathlib
from jsonschema import Draft202012Validator
schema=json.loads((pathlib.Path(__file__).resolve().parents[1]/'specs/v0.1/schemas/test-suite.schema.json').read_text(encoding='utf-8'))
errors=[{'pointer':'/'+ '/'.join(map(str,e.absolute_path)),'message':e.message[:400]} for e in Draft202012Validator(schema).iter_errors(json.load(sys.stdin))][:20]
print(json.dumps({'status':'FAIL' if errors else 'PASS','errors':errors}))
