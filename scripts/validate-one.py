#!/usr/bin/env python3
"""Validate a single AI-produced JSON file before admitting it to the GameSpec pipeline.
Usage: python scripts/validate-one.py game /path/to/game.json
"""
import sys,json,pathlib
from jsonschema import Draft202012Validator, FormatChecker
ROOT=pathlib.Path(__file__).resolve().parents[1]
ALLOW={'game','capability','adapter','test-suite','input-trace','coverage','coverage-result'}
def main():
    if len(sys.argv)!=3 or sys.argv[1] not in ALLOW:
        print('Usage: python scripts/validate-one.py <game|capability|adapter|test-suite|input-trace|coverage|coverage-result> <file.json>',file=sys.stderr);return 2
    kind,path=sys.argv[1],pathlib.Path(sys.argv[2]);source=json.loads(path.read_text(encoding='utf-8'))
    schema=json.loads((ROOT/'specs/v0.1'/'schemas'/f'{kind}.schema.json').read_text(encoding='utf-8'))
    Draft202012Validator.check_schema(schema)
    errors=sorted(Draft202012Validator(schema,format_checker=FormatChecker()).iter_errors(source),key=lambda e:list(map(str,e.path)))
    result={'file':str(path),'schema':kind,'status':'FAIL' if errors else 'PASS','errors':[{'pointer':'/'+ '/'.join(map(str,e.absolute_path)),'message':e.message} for e in errors]}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return 1 if errors else 0
if __name__=='__main__':sys.exit(main())
