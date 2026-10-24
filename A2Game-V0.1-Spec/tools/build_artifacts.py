#!/usr/bin/env python3
"""Build draft schemas and self-contained fixture data for the A2Game V0.1 *design*.

This is not a game engine or conformance runner.
"""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DRAFT = 'https://json-schema.org/draft/2020-12/schema'
V = '0.1.0'

def emit(relative, data):
    p = ROOT / relative
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

S = lambda ref: {'$ref': '#/$defs/' + ref}
string = {'type': 'string', 'minLength': 1}
capref = {'type': 'object', 'required': ['id', 'version'], 'properties': {'id': {'type':'string','pattern':r'^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2,}$'}, 'version': {'type':'string','pattern':r'^\d+\.\d+\.\d+$'}}, 'additionalProperties': False}
requires = {'type': 'object', 'required':['all'], 'properties':{
    'all':{'type':'array','items':S('capRef'),'uniqueItems':True},
    'anyOf':{'type':'array','items':{'type':'array','minItems':1,'items':S('capRef')}},
}, 'additionalProperties':False}
expr = {'oneOf': [
    {'type':'object','properties':{'const':{}},'required':['const'],'additionalProperties':False},
    {'type':'object','properties':{'state':{'type':'string','pattern':'^/'}},'required':['state'],'additionalProperties':False},
    {'type':'object','properties':{'event':{'type':'string','pattern':'^/'}},'required':['event'],'additionalProperties':False},
    {'type':'object','properties':{'entityState':{'type':'object','required':['entity','path'],'properties':{'entity':string,'path':{'type':'string','pattern':'^/'}},'additionalProperties':False}},'required':['entityState'],'additionalProperties':False},
    {'type':'object','properties':{'op':string,'args':{'type':'array','items':S('expr')}},'required':['op','args'],'additionalProperties':False},
]}
component = {'type':'object','required':['capability','config'],'properties':{'capability':S('capRef'),'config':{'type':'object'}},'additionalProperties':False}
entity = {'type':'object','required':['id'],'properties':{
    'id':string,'prototype':string,'tags':{'type':'array','items':string},
    'state':{'type':'object'},
    'transform':{'type':'object','properties':{'position':{'oneOf':[{'type':'array','items':{'type':'number'},'minItems':2,'maxItems':2},{'type':'array','items':{'type':'number'},'minItems':3,'maxItems':3}]},'rotationRad':{'type':'number'},'scale':{'type':'array','items':{'type':'number'},'minItems':2,'maxItems':3}},'additionalProperties':False},
    'components':{'type':'array','items':S('component')}
},'additionalProperties':False}
state_field = {'type':'object','required':['type','initial'],'properties':{
    'type':{'enum':['bool','int','number','string','vec2','vec3','enum','entityRef','array','object']},'initial':{},
    'constraints':{'type':'object'}
},'additionalProperties':False}
input_binding = {'type':'object','required':['source'],'properties':{
    'source':string, 'config':{'type':'object'},'region':string,'priority':{'type':'integer'}
},'additionalProperties':False}
input_action = {'type':'object','required':['id','valueType','bindings'],'properties':{
    'id':string,'valueType':{'enum':['button','axis1','vec2','vec3','pose']},
    'policy':{'enum':['first-ready','simultaneous','explicit-switch']},
    'bindings':{'type':'array','minItems':1,'items':S('inputBinding')}
},'additionalProperties':False}
effect = {'type':'object','required':['op'],'properties':{'op':string},'additionalProperties':True}
rule = {'type':'object','required':['id','on','do'],'properties':{
    'id':string,'priority':{'type':'integer','minimum':-100000,'maximum':100000},
    'on':{'type':'object','required':['type'],'properties':{'type':string,'action':string,'edge':{'enum':['press','hold','release','cancel']},'sourceTag':string},'additionalProperties':False},
    'if':S('expr'),'do':{'type':'array','minItems':1,'items':S('effect')}
},'additionalProperties':False}
outcome = {'type':'object','required':['id','status','when'],'properties':{
    'id':string,'status':{'enum':['won','lost']},'priority':{'type':'integer'},'when':S('expr')
},'additionalProperties':False}
asset = {'type':'object','required':['uri','type'],'properties':{
    'uri':string,'type':{'enum':['image','audio','font','model','atlas','binary','json']},
    'integrity':{'type':'string','pattern':r'^sha256-[A-Za-z0-9+/=]+$'}
},'additionalProperties':False}
hud = {'type':'object','required':['id','kind'],'properties':{'id':string,'kind':{'enum':['text','button','bar','icon','panel']},'text':{'type':'string'},'bind':{'type':'object'}},'additionalProperties':False}

game_schema = {
    '$schema':DRAFT,'$id':'urn:a2game:schemas:game:0.1.0','title':'A2Game GameSpec 0.1.0 (structural draft)',
    'type':'object','additionalProperties':False,
    'required':['format','specVersion','id','revision','meta','requires','world','scenes','entryScene','state','inputs','rules','outcomes','presentation'],
    'properties':{
        'format':{'const':'a2game'},'specVersion':{'const':V},'id':string,'revision':{'type':'integer','minimum':1},
        'meta':{'type':'object','required':['title','genres'],'properties':{'title':string,'description':{'type':'string'},'author':{'type':'string'},'genres':{'type':'array','items':string}},'additionalProperties':False},
        'requires':S('requires'),
        'world':{'type':'object','required':['dimension','coordinateSystem','units','clock'],'properties':{
            'dimension':{'enum':['2d','3d']},'coordinateSystem':{'const':'rh-y-up'},'units':{'const':'meter'},
            'clock':{'type':'object','required':['tickHz','seed'],'properties':{'tickHz':{'enum':[30,60,120]},'seed':{'type':'integer','minimum':0,'maximum':4294967295},'maxCatchUpTicks':{'type':'integer','minimum':1,'maximum':100}},'additionalProperties':False}
        },'additionalProperties':False},
        'assets':{'type':'object','additionalProperties':S('asset')},
        'prototypes':{'type':'object','additionalProperties':{'type':'object','properties':{'tags':{'type':'array','items':string},'state':{'type':'object'},'components':{'type':'array','items':S('component')}},'additionalProperties':False}},
        'scenes':{'type':'array','minItems':1,'items':{'type':'object','required':['id','entities'],'properties':{'id':string,'entities':{'type':'array','items':S('entity')}},'additionalProperties':False}},
        'entryScene':string,
        'state':{'type':'object','additionalProperties':S('stateField')},
        'inputs':{'type':'object','required':['actions'],'properties':{'actions':{'type':'array','items':S('inputAction')},'traceRecording':{'enum':['disabled','user-opt-in']}},'additionalProperties':False},
        'rules':{'type':'array','items':S('rule')},'outcomes':{'type':'array','items':S('outcome')},
        'presentation':{'type':'object','required':['hud','cues'],'properties':{'hud':{'type':'array','items':S('hud')},'cues':{'type':'array','items':{'type':'object'}}},'additionalProperties':False},
        'tests':{'type':'array','items':string},'extensions':{'type':'object'}
    },
    '$defs':{'capRef':capref,'requires':requires,'expr':expr,'component':component,'entity':entity,'stateField':state_field,'inputBinding':input_binding,'inputAction':input_action,'rule':rule,'effect':effect,'outcome':outcome,'asset':asset,'hud':hud}
}
emit('schemas/game.schema.json',game_schema)

cap_schema={
    '$schema':DRAFT,'$id':'urn:a2game:schemas:capability:0.1.0','title':'A2Game Capability Manifest 0.1.0',
    'type':'object','additionalProperties':False,
    'required':['format','manifestVersion','id','version','kind','portability','description','phase','dependencies','contract','testSuites'],
    'properties':{
        'format':{'const':'a2game-capability'},'manifestVersion':{'const':V},'id':capref['properties']['id'],
        'version':capref['properties']['version'],
        'kind':{'enum':['core','behavior','rule-op','input-source','recognizer','service','presentation']},
        'portability':{'enum':['exact','tolerant','host-defined']},'description':string,
        'phase':{'enum':['collect','normalize','recognize','simulate','physics','rule','commit','observe','present']},
        'dependencies':{'type':'array','items':S('capRef')},
        'contract':{'type':'object','required':['configSchema','stateSchema','commands','events','stateWrites','lifecycle'],'properties':{
            'configSchema':{'type':'object'},'stateSchema':{'type':'object'},
            'commands':{'type':'array','items':S('command')},'events':{'type':'array','items':S('command')},
            'stateWrites':{'type':'array','items':string},
            'lifecycle':{'type':'array','items':{'enum':['initialize','tick','pause','resume','reset','dispose']}}
        },'additionalProperties':False},
        'testSuites':{'type':'array','minItems':1,'items':string},
        'permissions':{'type':'array','items':string},'limits':{'type':'object'},'extensions':{'type':'object'}
    },
    '$defs':{'capRef':capref,'command':{'type':'object','required':['name','payloadSchema'],'properties':{'name':string,'payloadSchema':{'type':'object'},'idempotent':{'type':'boolean'}},'additionalProperties':False}}
}
emit('schemas/capability.schema.json',cap_schema)

step={'type':'object','required':['op'],'properties':{
    'op':{'enum':['start','injectAction','injectRaw','step','assert','assertEvent','pause','resume','restart','snapshot','restore','expectError']},
    'action':string,'phase':{'enum':['press','hold','release','cancel']},'value':{},'sourceId':string,'ticks':{'type':'integer','minimum':1},
    'path':string,'equals':{},'approximately':{'type':'number'},'absTol':{'type':'number','minimum':0},'relTol':{'type':'number','minimum':0},'units':string,
    'eventType':string,'count':{'type':'integer','minimum':0},'sinceTick':{'type':'integer','minimum':0},
    'id':string,'seed':{'type':'integer','minimum':0,'maximum':4294967295},'code':string,
    'raw':{'type':'object'}
},'additionalProperties':False}
suite_schema={
    '$schema':DRAFT,'$id':'urn:a2game:schemas:conformance:0.1.0','title':'A2Game Conformance Suite 0.1.0',
    'type':'object','additionalProperties':False,'required':['format','specVersion','suiteId','subject','cases'],
    'properties':{
        'format':{'const':'a2game-conformance'},'specVersion':{'const':V},'suiteId':string,
        'subject':{'type':'object','required':['type','id','file'],'properties':{'type':{'enum':['game','capability','runtime','adapter']},'id':string,'file':string},'additionalProperties':False},
        'cases':{'type':'array','minItems':1,'items':{'type':'object','required':['id','seed','steps'],'properties':{'id':string,'seed':{'type':'integer','minimum':0,'maximum':4294967295},'steps':{'type':'array','minItems':1,'items':S('step')}},'additionalProperties':False}}
    },'$defs':{'step':step}
}
emit('schemas/test-suite.schema.json',suite_schema)

cov_item={
    'type':'object','additionalProperties':False,
    'required':['id','version','name','taxonomy','executionModels','dimensions','inputs','requiredCapabilities','optionalCapabilities','testSuites','profiles','status'],
    'properties':{
        'id':string,'version':string,'name':string,
        'taxonomy':{'type':'object','required':['genres','mechanics'],'properties':{'genres':{'type':'array','items':string},'mechanics':{'type':'array','items':string}},'additionalProperties':False},
        'executionModels':{'type':'array','items':{'enum':['discrete','realtime','mixed','timed','turnbased']}},
        'dimensions':{'type':'array','items':{'enum':['2d','2.5d','3d']}},
        'inputs':{'type':'array','items':string},'requiredCapabilities':S('requires'),
        'optionalCapabilities':{'type':'array','items':S('capRef')},'testSuites':{'type':'array','items':string},
        'profiles':{'type':'array','items':string},'status':{'enum':['planned','documented-only','implemented-unverified','verified']},
        'sourceLinks':{'type':'array','items':{'type':'string','format':'uri'}},'extensions':{'type':'object'}
    }
}
cov_schema={
    '$schema':DRAFT,'$id':'urn:a2game:schemas:coverage:0.1.0','title':'A2Game Coverage Registry 0.1.0',
    'type':'object','additionalProperties':False,'required':['format','registryVersion','games'],
    'properties':{'format':{'const':'a2game-coverage'},'registryVersion':{'const':V},'games':{'type':'array','items':S('coverageEntry')}},
    '$defs':{'capRef':capref,'requires':requires,'coverageEntry':cov_item}
}
emit('schemas/coverage.schema.json',cov_schema)

adapter_schema={
    '$schema':DRAFT,'$id':'urn:a2game:schemas:adapter:0.1.0','title':'A2Game Adapter Capability Manifest 0.1.0',
    'type':'object','additionalProperties':False,'required':['format','manifestVersion','adapterId','adapterVersion','runtimeVersion','status','supportedCapabilities','physicsProfiles','targetPlatforms','limitations'],
    'properties':{'format':{'const':'a2game-adapter-capabilities'},'manifestVersion':{'const':V},'adapterId':string,'adapterVersion':string,'runtimeVersion':string,'status':{'enum':['planned','implemented-unverified','verified']},'supportedCapabilities':{'type':'array','items':S('capRef')},'physicsProfiles':{'type':'array','items':string},'targetPlatforms':{'type':'array','items':string},'limitations':{'type':'array','items':string}},
    '$defs':{'capRef':capref}
}
emit('schemas/adapter.schema.json',adapter_schema)

c = lambda id: {'id': id, 'version': V}

game={
    'format':'a2game','specVersion':V,'id':'org.a2game.samples.tap-target','revision':1,
    'meta':{'title':'点击两次获胜','description':'每次有效点击得 1 分，达到 2 分获胜。','genres':['casual','puzzle']},
    'requires':{'all':[c('a2game.core.state'),c('a2game.core.rules'),c('a2game.core.flow'),c('a2game.rules.state-add'),c('a2game.visual.text')],
                'anyOf':[[c('a2game.input.touch.tap'),c('a2game.input.keyboard.button')]]},
    'world':{'dimension':'2d','coordinateSystem':'rh-y-up','units':'meter','clock':{'tickHz':60,'seed':42,'maxCatchUpTicks':5}},
    'assets':{},'prototypes':{},'scenes':[{'id':'main','entities':[]}], 'entryScene':'main',
    'state':{'score':{'type':'int','initial':0},'goal':{'type':'int','initial':2}},
    'inputs':{'actions':[{'id':'collect','valueType':'button','policy':'first-ready','bindings':[{'source':'touch.tap','config':{'region':'playfield'}},{'source':'keyboard.button','config':{'code':'Space'}}]}],'traceRecording':'disabled'},
    'rules':[{'id':'reward-on-press','priority':0,'on':{'type':'input.action','action':'collect','edge':'press'},
              'if':{'op':'lt','args':[{'state':'/score'},{'state':'/goal'}]},
              'do':[{'op':'state.add','path':'/score','value':1}]}],
    'outcomes':[{'id':'all-collected','status':'won','priority':0,'when':{'op':'gte','args':[{'state':'/score'},{'state':'/goal'}]}}],
    'presentation':{'hud':[{'id':'scoreLabel','kind':'text','text':'点击屏幕得分','bind':{'text':{'template':'Score: {0} / {1}', 'args':[{'state':'/score'},{'state':'/goal'}]}}}],'cues':[]},
    'tests':['../tests/tap-target.conformance.json'], 'extensions':{}
}
emit('samples/games/tap-target.game.json',game)

# Capability contract examples, not executable implementations.
def capability(id,kind,phase,portability,description, tests, events=None,commands=None,config=None,state=None,deps=None, writes=None, permissions=None):
    doc={'format':'a2game-capability','manifestVersion':V,'id':id,'version':V,'kind':kind,'portability':portability,
         'description':description,'phase':phase,'dependencies':[c(x) for x in (deps or [])],
         'contract':{'configSchema':config or {'type':'object','additionalProperties':False},
                     'stateSchema':state or {'type':'object','additionalProperties':False},
                     'commands':commands or [],'events':events or [],
                     'stateWrites':writes or [],'lifecycle':['initialize','tick','reset','dispose']},
         'testSuites':tests}
    if permissions: doc['permissions']=permissions
    return doc
noop={'type':'object','additionalProperties':False}
items=[
    capability('a2game.core.state','core','commit','exact','全局及实体状态的类型化存储；仅 Commit 发布。',['CORE-002'],writes=['global','entity']),
    capability('a2game.core.rules','core','rule','exact','事件匹配、表达式 AST、Rule EffectBuffer。',['CORE-003','CORE-005','CORE-006'],deps=['a2game.core.state']),
    capability('a2game.core.flow','core','observe','exact','会话 ready/playing/paused/won/lost/stopped/error 生命周期。',['CORE-008'],deps=['a2game.core.state']),
    capability('a2game.rules.state-add','rule-op','commit','exact','state.add：对 int/number 的安全有序累加；操作名为 state.add。',['CORE-003'],
               commands=[{'name':'state.add','payloadSchema':{'type':'object','required':['path','value'],'properties':{'path':{'type':'string','pattern':'^/'},'value':{'type':'number'}},'additionalProperties':False}}],writes=['global'],deps=['a2game.core.state']),
    capability('a2game.visual.text','presentation','present','host-defined','HUD 文本显示，允许绑定逻辑状态，只读。',['ADAPTER-003'],deps=['a2game.core.state']),
    capability('a2game.input.touch.tap','recognizer','recognize','exact','由标准化 pointer down/up 识别 Tap，受参数/触点归属约束。',['INPUT-001','INPUT-002'],
               events=[{'name':'input.action','payloadSchema':{'type':'object'}}]),
    capability('a2game.input.keyboard.button','recognizer','recognize','exact','标准化键盘键到 button action，保留有序边沿。',['INPUT-009'],
               events=[{'name':'input.action','payloadSchema':{'type':'object'}}]),
]
for cap in items:
    emit('samples/capabilities/'+cap['id']+'.capability.json',cap)

suite={
  'format':'a2game-conformance','specVersion':V,'suiteId':'tap-target-core',
  'subject':{'type':'game','id':game['id'],'file':'../games/tap-target.game.json'},
  'cases':[
    {'id':'two-taps-win','seed':42,'steps':[
      {'op':'start'},
      {'op':'injectAction','action':'collect','phase':'press'},
      {'op':'injectAction','action':'collect','phase':'release'},
      {'op':'step','ticks':1},
      {'op':'assert','path':'/state/score','equals':1},
      {'op':'assert','path':'/flow/status','equals':'playing'},
      {'op':'injectAction','action':'collect','phase':'press'},
      {'op':'injectAction','action':'collect','phase':'release'},
      {'op':'step','ticks':1},
      {'op':'assert','path':'/state/score','equals':2},
      {'op':'assert','path':'/flow/status','equals':'won'}
    ]},
    {'id':'two-taps-in-one-tick','seed':42,'steps':[
      {'op':'start'},
      {'op':'injectAction','action':'collect','phase':'press'},
      {'op':'injectAction','action':'collect','phase':'release'},
      {'op':'injectAction','action':'collect','phase':'press'},
      {'op':'injectAction','action':'collect','phase':'release'},
      {'op':'step','ticks':1},
      {'op':'assert','path':'/state/score','equals':2},
      {'op':'assert','path':'/flow/status','equals':'won'}
    ]},
    {'id':'pause-no-catch-up','seed':42,'steps':[
      {'op':'start'},
      {'op':'pause'},
      {'op':'step','ticks':100},
      {'op':'assert','path':'/tickIndex','equals':0},
      {'op':'assert','path':'/flow/status','equals':'paused'},
      {'op':'resume'},
      {'op':'injectAction','action':'collect','phase':'press'},
      {'op':'injectAction','action':'collect','phase':'release'},
      {'op':'step','ticks':1},
      {'op':'assert','path':'/tickIndex','equals':1},
      {'op':'assert','path':'/state/score','equals':1}
    ]}
  ]
}
emit('samples/tests/tap-target.conformance.json',suite)

runtime_order={
    'format':'a2game-conformance','specVersion':V,'suiteId':'runtime-core-order',
    'subject':{'type':'game','id':game['id'],'file':'../games/tap-target.game.json'},
    'cases':[
        {'id':'restarted-game-does-not-leak-old-score','seed':42,'steps':[
            {'op':'start'},
            {'op':'injectAction','action':'collect','phase':'press'},
            {'op':'injectAction','action':'collect','phase':'release'},
            {'op':'step','ticks':1},
            {'op':'assert','path':'/state/score','equals':1},
            {'op':'restart'},
            {'op':'assert','path':'/state/score','equals':0},
            {'op':'assert','path':'/tickIndex','equals':0}
        ]}
    ]
}
emit('samples/tests/runtime-order.conformance.json',runtime_order)

# Reference vectors calculated per the documented xoshiro128** seed/step contract.
rng={'algorithm':'xoshiro128**-fmix32-seed-v1','specVersion':V,'vectors':[
    {'seed':0,'initialState':[2462723854,1020716019,454327756,1275600319],'firstU32':[3809008728,1133695204,53579671,2891528803,139681546,2203266335]},
    {'seed':42,'initialState':[939911724,3948730756,321366731,3317318717],'firstU32':[2837322924,544945897,479756282,3500138142,339756180,113173290]}
]}
emit('samples/tests/rng-vectors.json',rng)

GAMES=[
('G01','推箱子','puzzle','discrete','touch.swipe,keyboard.button','grid,push,goal'),
('G02','2048','puzzle','discrete','touch.swipe,keyboard.button','slide,merge,rng'),
('G03','三消','puzzle','discrete','touch.drag','swap,match-n,cascade'),
('G04','堆叠三消','puzzle','discrete','touch.tap','layered-stack,tray,match-n'),
('G05','麻将叠牌配对','puzzle','discrete','touch.tap','occlusion,pair-match'),
('G06','箭头迷宫消除','puzzle','discrete','touch.tap','direction,occupancy,goal'),
('G07','翻牌配对','puzzle','timed','touch.tap','reveal,pair-match,timer'),
('G08','Block Puzzle','puzzle','discrete','touch.drag','polyomino,placement,line-clear'),
('G09','俄罗斯方块','puzzle','mixed','touch.tap,keyboard.button','polyomino,rotate-piece,line-clear'),
('G10','找物整理','casual','discrete','touch.drag','select,placement,goal'),
('G11','跳一跳','casual','realtime','touch.long-press','charge,jump,landing'),
('G12','Flappy','casual','realtime','touch.tap','velocity,trigger-zone,score'),
('G13','换道跑酷','casual','realtime','touch.swipe','lane-move,auto-scroll,spawner'),
('G14','打砖块','casual','realtime','touch.drag','collider,bounce,health'),
('G15','弹球','casual','realtime','touch.tap','rigid-body,constraint,trigger-zone'),
('G16','物理合成','puzzle','mixed','touch.drag','rigid-body,contact,merge'),
('G17','纵版飞机','shooter','realtime','touch.drag,keyboard.button','weapon,projectile,wave'),
('G18','俯视射击','shooter','realtime','touch.drag,keyboard.button','aim,health,damage'),
('G19','僵尸生存','shooter','realtime','touch.drag','auto-target,horde,upgrade'),
('G20','泡泡龙弹射','puzzle','mixed','touch.drag','aim,bounce,connected-match'),
('G21','塔防','strategy','realtime','touch.tap','placement,path-follow,weapon,wave'),
('G22','农场','simulation','timed','touch.tap','production,timer,collect'),
('G23','合成经营','simulation','mixed','touch.drag','merge,production,economy-loop'),
('G24','五子棋','board-game','turnbased','touch.tap','turn,legal-move,goal'),
('G25','水果切割','casual','realtime','touch.path','touch-path,intersection,score'),
('G26','双指旋转拼图','puzzle','mixed','touch.pinch,touch.rotate','multi-touch,rotate,placement'),
('G27','重力迷宫','puzzle','realtime','imu.tilt,touch.drag','imu-tilt,collision,goal'),
('G28','平衡堆叠','casual','mixed','imu.tilt,touch.drag,touch.tap','imu-tilt,balance,placement'),
('G29','摇一摇机关','puzzle','discrete','imu.shake,touch.tap','imu-shake,timer,unlock'),
('G30','弹弓打靶','casual','realtime','touch.drag','drag,charge,projectile'),
('G31','姿态打靶','shooter','realtime','imu.orientation,touch.drag,touch.tap','imu-orientation,aim,hitscan'),
('G32','多指机关','puzzle','timed','touch.multi-hold','multi-hold,timer,goal')
]
# Explicit mechanism-to-capability mapping: taxonomy tags alone MUST NOT imply gameplay support.
MECHANIC_GROUPS = {
    'core': 'goal,rng,score,timer',
    'puzzle': 'grid,push,slide,merge,swap,match-n,cascade,layered-stack,tray,occlusion,pair-match,direction,occupancy,reveal,polyomino,placement,line-clear,rotate-piece,select,connected-match',
    'realtime': 'charge,jump,landing,velocity,trigger-zone,lane-move,auto-scroll,spawner,collider,bounce,rigid-body,constraint,contact,collision,intersection,rotate,balance',
    'combat': 'health,weapon,projectile,wave,aim,damage,auto-target,horde,hitscan',
    'strategy': 'upgrade,path-follow,production,collect,economy-loop,unlock',
    'turnbased': 'turn,legal-move',
}
MECHANIC_IDS = {}
for group, names in MECHANIC_GROUPS.items():
    for name in names.split(','):
        if name in MECHANIC_IDS:
            raise ValueError('duplicate mechanism mapping: '+name)
        MECHANIC_IDS[name] = f'a2game.{group}.{name}'
INPUT_ONLY = {'touch-path', 'imu-tilt', 'imu-shake', 'imu-orientation', 'multi-touch', 'multi-hold', 'drag'}

coverage=[]
for id,name,genre,model,inputs,mechs in GAMES:
    inp=inputs.split(',')
    mechanisms=mechs.split(',')
    for m in mechanisms:
        if m not in INPUT_ONLY and m not in MECHANIC_IDS:
            raise ValueError('no mapping for mechanism '+m)
    mandatory = [c('a2game.core.state'), c('a2game.core.rules')]
    mandatory += [c(MECHANIC_IDS[m]) for m in mechanisms if m not in INPUT_ONLY and MECHANIC_IDS[m] not in {'a2game.core.state','a2game.core.rules'}]
    options=[]
    if id == 'G26':
        mandatory += [c('a2game.input.touch.pinch'), c('a2game.input.touch.rotate')]
    elif id == 'G28':
        mandatory += [c('a2game.input.touch.tap')]
        options = [[c('a2game.input.imu.tilt'),c('a2game.input.touch.drag')]]
    elif id == 'G31':
        mandatory += [c('a2game.input.touch.tap')]
        options = [[c('a2game.input.imu.orientation'),c('a2game.input.touch.drag')]]
    else:
        options = [[c('a2game.input.'+q) for q in inp]]
    # G27/G29 are true input fallback cases, while G26/G28/G31 combine simultaneous actions.
    seen=set()
    required=[]
    for m in mandatory:
        if m['id'] not in seen:
            seen.add(m['id']); required.append(m)
    req={'all':required}
    if options: req['anyOf']=options
    coverage.append({'id':id,'version':V,'name':name,
                     'taxonomy':{'genres':[genre],'mechanics':mechanisms},
                     'executionModels':[model],'dimensions':['2d'],
                     'inputs':inp,'requiredCapabilities':req,
                     'optionalCapabilities':[],
                     'testSuites':['COVERAGE-'+id],
                     'profiles':['headless','desktop-web','mobile-web'],
                     'status':'planned'})
emit('samples/coverage/games.json',{'format':'a2game-coverage','registryVersion':V,'games':coverage})

for aid,targets in [('cocosairjs',['desktop-web','mobile-web']),('threejs',['desktop-web','mobile-web'])]:
    emit('samples/adapters/'+aid+'.adapter.json',{
        'format':'a2game-adapter-capabilities','manifestVersion':V,'adapterId':aid+'-a2game',
        'adapterVersion':V,'runtimeVersion':V,'status':'planned',
        'supportedCapabilities':[], 'physicsProfiles':[], 'targetPlatforms':targets,
        'limitations':['Design only: no A2Game adapter implementation or conformance results.']
    })

# Formal input capture interchange (source device vs recognized action kept separate).
trace_schema={
    '$schema':DRAFT,'$id':'urn:a2game:schemas:input-trace:0.1.0',
    'title':'A2Game Normalized Input Trace 0.1.0',
    'type':'object','additionalProperties':False,
    'required':['format','traceVersion','session','events'],
    'properties':{
        'format':{'const':'a2game-input-trace'},'traceVersion':{'const':V},
        'session':{'type':'object','additionalProperties':False,
            'required':['gameId','gameRevision','tickHz','seed','inputNormalizerVersion','coordinateProfile','recognizers'],
            'properties':{
                'gameId':string,'gameRevision':{'type':'integer','minimum':1},
                'tickHz':{'enum':[30,60,120]},'seed':{'type':'integer','minimum':0,'maximum':4294967295},
                'inputNormalizerVersion':string,'coordinateProfile':string,
                'recognizers':{'type':'object','additionalProperties':string}
            }},
        'events':{'type':'array','items':{
            'type':'object','additionalProperties':False,
            'required':['tickIndex','seq','source','kind','timeUs','payload'],
            'properties':{
                'tickIndex':{'type':'integer','minimum':0},'seq':{'type':'integer','minimum':0},
                'source':{'enum':['pointer','keyboard','imu','system','action']},
                'kind':string,'timeUs':{'type':'integer','minimum':0},'payload':{'type':'object'}
            }
        }}
    }
}
emit('schemas/input-trace.schema.json',trace_schema)

receipt_schema={
    '$schema':DRAFT,'$id':'urn:a2game:schemas:coverage-result:0.1.0',
    'title':'A2Game Coverage Test Result Receipt 0.1.0',
    'type':'object','additionalProperties':False,
    'required':['format','receiptVersion','gameId','testCaseId','adapterId','platformProfile','capabilitySetDigest','testRevision','status','evidence'],
    'properties':{
        'format':{'const':'a2game-coverage-result'},'receiptVersion':{'const':V},
        'gameId':string,'testCaseId':string,'adapterId':string,'platformProfile':string,
        'capabilitySetDigest':string,'testRevision':string,
        'runtimeRevision':string,'physicsProfile':string,
        'status':{'enum':['PASS','FAIL','NOT_RUN','BLOCKED','NOT_APPLICABLE']},
        'reason':{'type':'string'},
        'evidence':{'type':'object','additionalProperties':False,
            'properties':{'runId':string,'eventTraceUri':string,'stateTraceUri':string,'screenCaptureUri':string,'diagnosticsUri':string}}
    },
    'allOf':[
        {'if':{'properties':{'status':{'const':'PASS'}}},'then':{'properties':{'evidence':{'required':['runId','eventTraceUri']}}}},
        {'if':{'properties':{'status':{'enum':['BLOCKED','NOT_APPLICABLE']}}},'then':{'required':['reason']}}
    ]
}
emit('schemas/coverage-result.schema.json',receipt_schema)

emit('samples/tests/touch-imu.input-trace.json',{
    'format':'a2game-input-trace','traceVersion':V,
    'session':{'gameId':'org.a2game.samples.tap-target','gameRevision':1,'tickHz':60,
               'seed':42,'inputNormalizerVersion':V,'coordinateProfile':'viewport-top-left-v1',
               'recognizers':{'touch.tap':V,'imu.tilt':V}},
    'events':[
        {'tickIndex':0,'seq':0,'source':'pointer','kind':'down','timeUs':1000,
         'payload':{'pointerId':7,'pointerType':'touch','u':0.50,'v':0.50,'pressure':None}},
        {'tickIndex':0,'seq':1,'source':'pointer','kind':'up','timeUs':4000,
         'payload':{'pointerId':7,'pointerType':'touch','u':0.50,'v':0.50,'pressure':None}},
        {'tickIndex':1,'seq':2,'source':'imu','kind':'sample','timeUs':19000,
         'payload':{'reference':'device','screenRotationRad':0,'linearAccelerationMps2':[0.1,0.2,0.3],
                    'angularVelocityRadps':[0.0,0.1,0.0],'orientationQuaternion':None,'accuracy':'unknown'}}
    ]
})

emit('samples/coverage/not-run.receipt.json',{
    'format':'a2game-coverage-result','receiptVersion':V,'gameId':'G01',
    'testCaseId':'COVERAGE-G01','adapterId':'cocosairjs-a2game',
    'platformProfile':'desktop-web','capabilitySetDigest':'unavailable',
    'testRevision':'0.1.0-draft.1','status':'NOT_RUN','reason':'Runtime and adapters have not been implemented.',
    'evidence':{}
})

print('Built',len(GAMES),'coverage candidates and',len(items),'example capability manifests.')
