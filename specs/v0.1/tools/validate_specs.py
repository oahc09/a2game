#!/usr/bin/env python3
"""Static structure + reference checks for the A2Game *design samples*.

PASS != gameplay PASS: this script is static only; see implementation reports for headless runtime tests.
"""
from __future__ import annotations
import json
import sys
from copy import deepcopy
from pathlib import Path
from collections import Counter
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []


def load(relative: str):
    return json.loads((ROOT / relative).read_text(encoding='utf-8'))


def issue(msg):
    ERRORS.append(msg)


def validate_json(name: str, doc: dict, schema: dict):
    for err in sorted(Draft202012Validator(schema).iter_errors(doc), key=lambda e: list(map(str, e.path))):
        path = '/'+'/'.join(map(str,err.path)) if err.path else '/'
        issue(f'{name} {path}: {err.message}')


def duplicates(values, category):
    for item,count in Counter(values).items():
        if count > 1:
            issue(f'{category}: duplicate {item}')


def walk_expr(node, game, label):
    if not isinstance(node,dict):
        issue(f'{label}: not expression object')
        return
    if 'state' in node:
        state_path = node['state']
        root = state_path[1:].split('/')[0]
        if root not in game['state']:
            issue(f'{label}: unknown global state {state_path}')
    if 'op' in node:
        if node['op'] not in {'eq','ne','lt','lte','gt','gte','and','or','not','add','sub','mul','div','min','max','clamp'}:
            issue(f'{label}: unknown AST operation {node["op"]}')
        for j,child in enumerate(node['args']):
            walk_expr(child, game, f'{label}/args/{j}')


def fmix32(x: int) -> int:
    mask=0xffffffff
    x ^= x>>16; x = (x*0x85ebca6b)&mask
    x ^= x>>13; x = (x*0xc2b2ae35)&mask
    x ^= x>>16; return x&mask


def rotl(x: int,k: int) -> int:
    return ((x<<k)|(x>>(32-k)))&0xffffffff


def xoshiro_vectors(seed: int, count: int):
    mask=0xffffffff
    x=seed&mask
    s=[]
    for _ in range(4):
        x=(x+0x9e3779b9)&mask
        s.append(fmix32(x))
    if not any(s): s=[1,0,0,0]
    first=s[:]
    result=[]
    for _ in range(count):
        n=(rotl(s[1]*5&mask,7)*9)&mask
        t=(s[1]<<9)&mask
        s[2]^=s[0];s[3]^=s[1];s[1]^=s[2];s[0]^=s[3];s[2]^=t;s[3]=rotl(s[3],11)
        result.append(n)
    return first,result


def main():
    schemas={n:load('schemas/'+n+'.schema.json') for n in ['game','capability','test-suite','coverage','adapter','input-trace','coverage-result']}
    for name,schema in schemas.items():
        try:
            Draft202012Validator.check_schema(schema)
        except Exception as exc:
            issue(f'schema {name} invalid: {exc}')

    caps={}
    for path in sorted((ROOT/'samples/capabilities').glob('*.capability.json')):
        c=json.loads(path.read_text(encoding='utf-8'))
        validate_json(path.name, c, schemas['capability'])
        for kind in ['configSchema','stateSchema']:
            try:
                Draft202012Validator.check_schema(c['contract'][kind])
            except Exception as exc:
                issue(f'{c["id"]}: {kind} invalid: {exc}')
        for op in c['contract']['commands']+c['contract']['events']:
            try:
                Draft202012Validator.check_schema(op['payloadSchema'])
            except Exception as exc:
                issue(f'{c["id"]}: {op["name"]} payload invalid: {exc}')
        if c['id'] in caps:
            issue(f'duplicate capability {c["id"]}')
        caps[c['id']]=c
    for id,manifest in caps.items():
        for dep in manifest['dependencies']:
            if dep['id'] not in caps:
                issue(f'{id} missing dependency {dep["id"]}')
            elif dep['version'] != caps[dep['id']]['version']:
                issue(f'{id} dependency version mismatch {dep}')
    # Cycle detection for the sample capability subset.
    gray,black=set(),set()
    def visit(v):
        if v in gray:
            issue(f'capability dependency cycle at {v}');return
        if v in black:return
        gray.add(v)
        for dep in caps[v]['dependencies']:
            if dep['id'] in caps: visit(dep['id'])
        gray.remove(v);black.add(v)
    for id in caps: visit(id)

    # V0.1 implementation extension: validate every registered game + its suites,
    # rather than hard-coding tap-target as the sole reference game.
    games={}
    cap_aliases={cap_id[len('a2game.input.'):]: cap_id for cap_id in caps if cap_id.startswith('a2game.input.')}
    all_ops={op['name'] for c in caps.values() for op in c['contract']['commands']}
    for game_path in sorted((ROOT/'samples/games').glob('*.game.json')):
        game=json.loads(game_path.read_text(encoding='utf-8'))
        validate_json(game_path.name, game, schemas['game'])
        if game['id'] in (x['id'] for x in games.values()):
            issue(f'duplicate game ID {game["id"]}')
        games[game_path.resolve()]=game
        duplicates([sc['id'] for sc in game['scenes']], f'{game_path.name}:scenes')
        if game['entryScene'] not in {sc['id'] for sc in game['scenes']}:
            issue(f'{game_path.name}: entryScene missing')
        duplicates([e['id'] for sc in game['scenes'] for e in sc['entities']], f'{game_path.name}:entities')
        duplicates([r['id'] for r in game['rules']], f'{game_path.name}:rules')
        duplicates([o['id'] for o in game['outcomes']], f'{game_path.name}:outcomes')
        duplicates([a['id'] for a in game['inputs']['actions']], f'{game_path.name}:actions')
        for key,field in game['state'].items():
            if field['type']=='int' and (type(field['initial']) is not int or abs(field['initial']) > 2**53-1):
                issue(f'{game_path.name}: bad int initial {key}')
            elif field['type']=='bool' and type(field['initial']) is not bool:
                issue(f'{game_path.name}: bad bool initial {key}')
        for ref in game['requires']['all']:
            if ref['id'] not in caps or caps[ref['id']]['version'] != ref['version']:
                issue(f'{game_path.name}: requires.all missing in sample registry: {ref}')
        for choices in game['requires'].get('anyOf',[]):
            if not any(ref['id'] in caps and caps[ref['id']]['version']==ref['version'] for ref in choices):
                issue(f'{game_path.name}: requires.anyOf missing all alternatives: {choices}')
        for action in game['inputs']['actions']:
            for binding in action['bindings']:
                if cap_aliases.get(binding['source']) not in caps:
                    issue(f'{game_path.name}: input alias unresolved {binding["source"]}')
        for sc in game['scenes']:
            for entity in sc['entities']:
                for component in entity.get('components',[]):
                    ref=component['capability']
                    if ref['id'] not in caps or caps[ref['id']]['version']!=ref['version']:
                        issue(f'{game_path.name}: entity {entity["id"]} unknown capability {ref}')
                    elif ref not in game['requires']['all']:
                        issue(f'{game_path.name}: entity {entity["id"]} missing requires.all capability {ref}')
                    else:
                        for error in Draft202012Validator(caps[ref['id']]['contract']['configSchema']).iter_errors(component['config']):
                            issue(f'{game_path.name}: invalid component config: {error.message}')
        for rule in game['rules']:
            if rule['on']['type']=='input.action' and rule['on'].get('action') not in {a['id'] for a in game['inputs']['actions']}:
                issue(f'{game_path.name}: rule {rule["id"]} unknown action')
            if 'if' in rule: walk_expr(rule['if'],game,f'{game_path.name}: rule {rule["id"]}')
            for effect in rule['do']:
                if effect['op'] not in all_ops:
                    issue(f'{game_path.name}: rule {rule["id"]} unregistered operation {effect["op"]}')
                if 'path' in effect and effect['path'][1:].split('/')[0] not in game['state']:
                    issue(f'{game_path.name}: rule {rule["id"]} invalid state path {effect["path"]}')
        for outcome in game['outcomes']:
            walk_expr(outcome['when'],game,f'{game_path.name}: outcome {outcome["id"]}')
        for ref in game.get('tests',[]):
            target=(game_path.parent/ref).resolve()
            if not target.is_file():
                issue(f'{game_path.name}: test missing: {ref}')

    suite_ids=set()
    for path in sorted((ROOT/'samples/tests').glob('*.conformance.json')):
        suite=json.loads(path.read_text(encoding='utf-8'))
        validate_json(path.name,suite,schemas['test-suite'])
        if suite['suiteId'] in suite_ids: issue(f'duplicate suiteId {suite["suiteId"]}')
        suite_ids.add(suite['suiteId'])
        subj=(path.parent/suite['subject']['file']).resolve()
        game=games.get(subj)
        if game is None:
            issue(f'{path.name}: unknown subject file {suite["subject"]["file"]}')
            continue
        if suite['subject']['id']!=game['id']:
            issue(f'{path.name}: subject ID mismatch')
        duplicates([c['id'] for c in suite['cases']], f'{path.name}:cases')
        known_actions={a['id'] for a in game['inputs']['actions']}
        for case in suite['cases']:
            for i,st in enumerate(case['steps']):
                if st['op']=='injectAction' and ('action' not in st or 'phase' not in st):
                    issue(f'{path.name}/{case["id"]}/{i}: incomplete injectAction')
                if st['op']=='injectAction' and st.get('action') not in known_actions:
                    issue(f'{path.name}/{case["id"]}/{i}: unknown action')
                if st['op']=='step' and 'ticks' not in st:
                    issue(f'{path.name}/{case["id"]}/{i}: no ticks')
                if st['op']=='assert' and ('path' not in st or 'equals' not in st and 'approximately' not in st):
                    issue(f'{path.name}/{case["id"]}/{i}: incomplete assert')

    game=load('samples/games/tap-target.game.json')  # original seven negative fixture definitions
    vecs=load('samples/tests/rng-vectors.json')
    for v in vecs['vectors']:
        state, nums=xoshiro_vectors(v['seed'],len(v['firstU32']))
        if v['initialState']!=state or v['firstU32']!=nums:
            issue(f'RNG golden vector mismatch seed={v["seed"]}')

    trace=load('samples/tests/touch-imu.input-trace.json')
    validate_json('touch-imu.input-trace.json',trace,schemas['input-trace'])
    previous=(-1,-1)
    duration_us=1000000/trace['session']['tickHz']
    for ev in trace['events']:
        key=(ev['tickIndex'],ev['seq'])
        if key<=previous:
            issue('InputTrace tick/seq order not strictly ascending')
        if not (ev['tickIndex']*duration_us <= ev['timeUs'] < (ev['tickIndex']+1)*duration_us):
            issue(f'InputTrace timeUs outside tick interval: {ev}')
        previous=key
    receipt=load('samples/coverage/not-run.receipt.json')
    validate_json('not-run.receipt.json',receipt,schemas['coverage-result'])
    if receipt['status']!='NOT_RUN':
        issue('example receipt must be NOT_RUN')

    cov=load('samples/coverage/games.json')
    validate_json('games.json',cov,schemas['coverage'])
    duplicates([entry['id'] for entry in cov['games']],'coverage')
    if len(cov['games'])!=32:
        issue(f'expected 32 candidates, found {len(cov["games"])}')
    if any(entry['status']!='planned' for entry in cov['games']):
        issue('coverage fixture must not claim verified')
    for path in sorted((ROOT/'samples/adapters').glob('*.adapter.json')):
        a=json.loads(path.read_text(encoding='utf-8'))
        validate_json(path.name,a,schemas['adapter'])
        if a['status']!='planned' or a['supportedCapabilities']:
            issue(f'{path.name}: must remain unverified empty adapter declaration')

    negatives=load('samples/tests/negative-fixtures.json')
    for neg in negatives['cases']:
        test=deepcopy(game)
        case=neg['case']
        if case=='unsupported-protocol':
            test['specVersion']='0.9.9'
            actual='A2G_E_SPEC_VERSION' if list(Draft202012Validator(schemas['game']).iter_errors(test)) else 'NO_ERROR'
        elif case=='unknown-root':
            test['developerScript']='alert(1)'
            actual='A2G_E_UNKNOWN_FIELD' if list(Draft202012Validator(schemas['game']).iter_errors(test)) else 'NO_ERROR'
        elif case=='missing-scene':
            test['entryScene']='missing'
            actual='A2G_E_SCENE_REF' if test['entryScene'] not in {s['id'] for s in test['scenes']} else 'NO_ERROR'
        elif case=='unknown-capability':
            test['requires']['all'].append({'id':'a2game.unknown.does-not-exist','version':'0.1.0'})
            actual='A2G_E_CAP_UNKNOWN' if any(r['id'] not in caps for r in test['requires']['all']) else 'NO_ERROR'
        elif case=='illegal-rule-op':
            test['rules'][0]['do'][0]['op']='eval'
            actual='A2G_E_CAP_UNKNOWN' if test['rules'][0]['do'][0]['op'] not in all_ops else 'NO_ERROR'
        elif case=='script-url':
            test['assets']['bad']={'uri':'javascript:alert(1)','type':'image'}
            actual='A2G_E_ASSET_URI' if test['assets']['bad']['uri'].lower().startswith(('javascript:','data:text/html','file:')) else 'NO_ERROR'
        elif case=='bad-state-initial':
            test['state']['score']['initial']='zero'
            actual='A2G_E_STATE_TYPE' if type(test['state']['score']['initial']) is not int else 'NO_ERROR'
        else:
            actual='UNRECOGNIZED_NEGATIVE_TEST'
        if actual!=neg['expectedCode']:
            issue(f'negative case {case}: expected {neg["expectedCode"]}, got {actual}')

    print(f'Static check: {len(schemas)} schemas, {len(caps)} capability declarations, {len(games)} games, '
          f'{len(cov["games"])} coverage candidates, {len(suite_ids)} game test suites.')
    if ERRORS:
        for e in ERRORS: print('FAIL:',e,file=sys.stderr)
        print(f'FAIL ({len(ERRORS)} issues); no runtime tests were run.')
        sys.exit(1)
    print('PASS (static structure/references/golden vectors only; see separate runtime report).')

if __name__ == '__main__':
    main()
