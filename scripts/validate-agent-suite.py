"""Read-only full Draft 2020-12 conformance validation for the agent workflow."""
import json,sys,pathlib
from jsonschema import Draft202012Validator
schema=json.loads((pathlib.Path(__file__).resolve().parents[1]/'specs/v0.1/schemas/test-suite.schema.json').read_text(encoding='utf-8'))
errors=[]
for e in Draft202012Validator(schema).iter_errors(json.load(sys.stdin)):
    parts=list(e.absolute_path)
    if e.validator == 'required' and isinstance(e.instance, dict):
        missing=[key for key in e.validator_value if key not in e.instance]
        if missing: parts.append(missing[0])
    location=''.join('/'+str(p).replace('~','~0').replace('/','~1') for p in parts)
    row={'pointer':location if len(location)<=256 else '', 'message':e.message[:400],'stage':'schema'}
    if e.validator in ('const','type','minimum','maximum','minLength','maxLength'):
        row['expected']=e.validator_value
        if e.instance is None or isinstance(e.instance,(int,float,bool)) or isinstance(e.instance,str) and len(e.instance)<=80: row['actual']=e.instance
    errors.append(row)
    if len(errors)>=20: break
print(json.dumps({'status':'FAIL' if errors else 'PASS','errors':errors}))
