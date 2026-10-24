#!/usr/bin/env python3
"""A2Game release preflight: full JSON Schema draft 2020-12, no custom subset evaluator.
The bundled samples are the only approved dynamic JSON source for the standalone demo.
Production AI-generated content must traverse this full gate before release/allowlisting.
"""
from __future__ import annotations
import json
import pathlib
import sys
from jsonschema import Draft202012Validator, FormatChecker

ROOT=pathlib.Path(__file__).resolve().parents[1]
SPEC=ROOT/'A2Game-V0.1-Spec'
SCHEMAS=SPEC/'schemas'
MAPPING={
    'game':'samples/games/*.game.json',
    'capability':'samples/capabilities/*.capability.json',
    'adapter':'samples/adapters/*.adapter.json',
    'test-suite':'samples/tests/*.conformance.json',
    'input-trace':'samples/tests/*.input-trace.json',
    'coverage':'samples/coverage/games.json',
    'coverage-result':'samples/coverage/*.receipt.json',
}

def errline(error):
    path='/'+'/'.join(map(str,error.absolute_path))
    return f'{path}: {error.message}'

def main():
    failures=[]
    count=0
    for kind,pattern in MAPPING.items():
        schema=json.loads((SCHEMAS/f'{kind}.schema.json').read_text(encoding='utf-8'))
        Draft202012Validator.check_schema(schema)
        validator=Draft202012Validator(schema,format_checker=FormatChecker())
        sources=sorted(SPEC.glob(pattern))
        if not sources: failures.append(f'{kind}: no documents matched {pattern}')
        for source in sources:
            count+=1
            data=json.loads(source.read_text(encoding='utf-8'))
            for error in sorted(validator.iter_errors(data),key=lambda e:list(map(str,e.absolute_path))):
                failures.append(f'{source.relative_to(SPEC)} {errline(error)}')
    result={'schemas':len(MAPPING),'documents':count,'errors':failures,'status':'FAIL' if failures else 'PASS', 'validationEngine':'python-jsonschema Draft202012Validator (full dialect)'}
    (ROOT/'reports').mkdir(exist_ok=True)
    (ROOT/'reports'/'schema-preflight.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return 1 if failures else 0
if __name__=='__main__':sys.exit(main())
