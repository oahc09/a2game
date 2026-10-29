#!/usr/bin/env python3
"""One-time additive V0.3 sample and schema migration; preserve V0.1 core protocol identity."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
SPEC=ROOT/'specs/v0.1'
GAMES=SPEC/'games'; CAPS=SPEC/'capabilities';TESTS=SPEC/'tests'
def load(path):return json.loads(path.read_text())
def write(path,obj):path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
color={'type':'string','pattern':'^#[0-9a-fA-F]{6}$'}
vec2={'type':'array','prefixItems':[{'type':'number'},{'type':'number'}],'minItems':2,'maxItems':2}
capref={'id':'a2game.visual.scene2d','version':'0.1.0'}
base=load(SPEC/'schemas/game.schema.json')
D=base['$defs']
D['visualBinding']={'oneOf':[
 {'type':'object','required':['state'],'properties':{'state':{'type':'string','pattern':'^/' }},'additionalProperties':False},
 {'type':'object','required':['item'],'properties':{'item':{'const':True}},'additionalProperties':False},
 {'type':'object','required':['literal'],'properties':{'literal':{}},'additionalProperties':False}
]}
D['visualColor']={'oneOf':[color,{'type':'object','required':['from','map','fallback'],'properties':{
 'from':{'$ref':'#/$defs/visualBinding'},'map':{'type':'object','maxProperties':128,'additionalProperties':color},'fallback':color},'additionalProperties':False}]}
D['visualNode']={'type':'object','required':['id','kind','at','fill'],'properties':{
 'id':{'type':'string','pattern':'^[_a-zA-Z][_a-zA-Z0-9-]*$'},
 'kind':{'enum':['rect','circle','text']},'at':vec2,'size':vec2,'radius':{'type':'number','exclusiveMinimum':0},
 'fill':{'$ref':'#/$defs/visualColor'}, 'text':{'$ref':'#/$defs/visualBinding'},
 'fontSize':{'type':'number','exclusiveMinimum':0},'omitWhen':{'type':'array','maxItems':16,'items':{'type':['string','number','boolean','null']}}
 },'allOf':[
 {'if':{'properties':{'kind':{'const':'rect'}},'required':['kind']},'then':{'required':['size']}},
 {'if':{'properties':{'kind':{'const':'circle'}},'required':['kind']},'then':{'required':['radius']}},
 {'if':{'properties':{'kind':{'const':'text'}},'required':['kind']},'then':{'required':['text','fontSize']}}
 ],'additionalProperties':False}
D['visualRepeat']={'type':'object','required':['id','source','columns','origin','step','indexMode','template'],'properties':{
 'id':{'type':'string','pattern':'^[_a-zA-Z][_a-zA-Z0-9-]*$'},'source':{'$ref':'#/$defs/visualBinding'},
 'columns':{'type':'integer','minimum':1,'maximum':64},'origin':vec2,
 'step':{'type':'array','prefixItems':[{'type':'number','exclusiveMinimum':0},{'type':'number','exclusiveMinimum':0}],'minItems':2,'maxItems':2},
 'indexMode':{'enum':['array','cell']},'template':{'type':'array','minItems':1,'maxItems':8,'items':{'$ref':'#/$defs/visualNode'}}
 },'additionalProperties':False}
D['scene2d']={'type':'object','required':['width','height','background','nodes'],'properties':{
 'width':{'type':'number','exclusiveMinimum':0,'maximum':10000},'height':{'type':'number','exclusiveMinimum':0,'maximum':10000},
 'background':color,'nodes':{'type':'array','maxItems':128,'items':{'$ref':'#/$defs/visualNode'}},
 'repeat':{'type':'array','maxItems':16,'items':{'$ref':'#/$defs/visualRepeat'}}
 },'additionalProperties':False}
base['properties']['presentation']['properties']['scene2d']={'$ref':'#/$defs/scene2d'}
write(SPEC/'schemas/game.schema.json',base)

## Trusted render capability is declared, not an executable URL or script source.
manifest={
 'format':'a2game-capability','manifestVersion':'0.1.0','id':capref['id'],'version':'0.1.0',
 'kind':'presentation','portability':'host-defined','description':'有限 2D 原语 rect/circle/text + 声明式重复网格；观测状态的只读映射，禁止执行任意脚本。',
 'phase':'present','dependencies':[{'id':'a2game.core.state','version':'0.1.0'}],
 'contract':{'configSchema':{'$ref':'urn:a2game:schemas:game:0.1.0#/$defs/scene2d'},
  'stateSchema':{'type':'object','additionalProperties':False},'commands':[], 'events':[], 'stateWrites':[],
  'lifecycle':['initialize','tick','dispose']},
 'testSuites':['PRES-001','PRES-002']}
write(CAPS/'a2game.visual.scene2d.capability.json',manifest)
paths=['width','height','wallsPath','goalsPath','boxesPath','playerPath','movesPath','solvedPath','actions']
push={
 'format':'a2game-capability','manifestVersion':'0.1.0','id':'a2game.puzzle.grid-push','version':'0.1.0',
 'kind':'behavior','portability':'exact','description':'推箱子风格网格合法性、原子推动与目标格成功判定。',
 'phase':'simulate','dependencies':[{'id':'a2game.core.state','version':'0.1.0'}],
 'contract':{'configSchema':{'type':'object','required':paths,'properties':{
 'width':{'type':'integer','minimum':3,'maximum':32},'height':{'type':'integer','minimum':3,'maximum':32},
 **{k:{'type':'string','pattern':'^/'} for k in paths if k.endswith('Path')},
 'actions':{'type':'object','required':['left','right','up','down'],'properties':{k:{'type':'string'} for k in ['left','right','up','down']},'additionalProperties':False}
 },'additionalProperties':False},'stateSchema':{'type':'object'},'commands':[],
 'events':[{'name':e,'payloadSchema':{'type':'object'}} for e in ['grid.player-moved','grid.box-pushed']],
 'stateWrites':['global'],'lifecycle':['initialize','tick','reset','dispose']},'testSuites':['PUSH-001','PUSH-002','PUSH-003']}
write(CAPS/'a2game.puzzle.grid-push.capability.json',push)
swipe={
 'format':'a2game-capability','manifestVersion':'0.1.0','id':'a2game.input.touch.swipe','version':'0.1.0',
 'kind':'recognizer','portability':'exact','description':'归一化单指指针释放后识别上下左右方向；取消手势不发出动作。',
 'phase':'recognize','dependencies':[],
 'contract':{'configSchema':{'type':'object','required':['direction'],'properties':{
   'direction':{'enum':['left','right','up','down']},'minDistanceNorm':{'type':'number','minimum':0,'maximum':2},
   'maxDurationUs':{'type':'integer','minimum':0,'maximum':10000000}},'additionalProperties':False},
  'stateSchema':{'type':'object'},'commands':[],'events':[], 'stateWrites':[],
  'lifecycle':['initialize','tick','reset','dispose']},'testSuites':['SWIPE-001','SWIPE-002']}
write(CAPS/'a2game.input.touch.swipe.capability.json',swipe)

palette={'0':'#243851','2':'#577f9f','4':'#368aa5','8':'#2a9b91','16':'#89b482','32':'#dfaf66','64':'#df8c66','128':'#ce6877'}
def node(id,kind,at,fill,**kwargs):return {'id':id,'kind':kind,'at':at,'fill':fill,**kwargs}
def board2d():
 return {'width':8,'height':6,'background':'#0d1729','nodes':[
  node('back','rect',[0,-0.15],'#202f46',size=[4.6,4.6]),
  node('caption','text',[-1.7,2.55],'#b5cee8',text={'literal':'A2Game / 2048'},fontSize=.31),
  node('best','text',[2.3,2.55],'#f3ce8b',text={'state':'/best'},fontSize=.5),
 ],'repeat':[{'id':'tiles','source':{'state':'/board'},'columns':4,'origin':[-1.68,1.52],
   'step':[1.12,1.12],'indexMode':'array','template':[
    node('cell','rect',[0,0],{'from':{'item':True},'map':palette,'fallback':'#8e65ae'},size=[1.03,1.03]),
    node('value','text',[0,0],'#ffffff',text={'item':True},fontSize=.52,omitWhen=[0])
 ]}]}
for game_name in ['grid-merge','grid-merge-spawn']:
 p=GAMES/f'{game_name}.game.json';g=load(p)
 g['revision']=max(g['revision'],2)
 if capref not in g['requires']['all']:g['requires']['all'].append(capref)
 g['presentation']['scene2d']=board2d()
 swipeRef={'id':'a2game.input.touch.swipe','version':'0.1.0'}
 if swipeRef not in g['requires']['all']:g['requires']['all'].append(swipeRef)
 for action in g['inputs']['actions']:
  direction={'moveLeft':'left','moveRight':'right','moveUp':'up','moveDown':'down'}.get(action['id'])
  if direction and not any(b['source']=='touch.swipe' for b in action['bindings']):
   action['bindings'].append({'source':'touch.swipe','config':{'direction':direction,'minDistanceNorm':0.12,'maxDurationUs':1200000}})
 write(p,g)
p=GAMES/'tap-target.game.json';g=load(p)
g['revision']=max(g['revision'],2)
if capref not in g['requires']['all']:g['requires']['all'].append(capref)
g['presentation']['scene2d']={'width':8,'height':6,'background':'#0d1729','nodes':[
 node('outer','circle',[0,0],'#173955',radius=1.7),
 node('target','circle',[0,0],'#2c91c5',radius=1.34),
 node('center','circle',[0,0],'#6ed2ef',radius=.85),
 node('score','text',[0,0],'#0c3556',fontSize=.8,text={'state':'/score'}),
 node('title','text',[0,2.45],'#c8e5fd',fontSize=.32,text={'literal':'A2Game / Tap to score'}),
 ]}
write(p,g)

## Second gameplay: authentic Sokoban rules, no per-game JS controller.
wall_indices=[0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24]
player=16; boxes=[12];goals=[7]
config={
 'width':5,'height':5,'wallsPath':'/walls','goalsPath':'/goals','boxesPath':'/boxes',
 'playerPath':'/player','movesPath':'/moves','solvedPath':'/solved',
 'actions':{'left':'moveLeft','right':'moveRight','up':'moveUp','down':'moveDown'}
}
ref={'id':'a2game.puzzle.grid-push','version':'0.1.0'}
sok={
 'format':'a2game','specVersion':'0.1.0','id':'org.a2game.samples.grid-push','revision':1,
 'meta':{'title':'推箱子 / 第一关','description':'移动并推动方块进入目标位置，非法移动不消耗步数。','genres':['puzzle']},
 'requires':{'all':[{'id':i,'version':'0.1.0'} for i in ['a2game.core.state','a2game.core.rules','a2game.core.flow','a2game.input.keyboard.button','a2game.puzzle.grid-push','a2game.visual.scene2d']]},
 'world':{'dimension':'2d','coordinateSystem':'rh-y-up','units':'meter','clock':{'tickHz':60,'seed':42,'maxCatchUpTicks':5}},
 'assets':{},'prototypes':{},'scenes':[{'id':'main','entities':[{'id':'pushController','components':[{'capability':ref,'config':config}]}]}],
 'entryScene':'main','state':{
 **{k:{'type':'array','initial':v} for k,v in [('walls',wall_indices),('goals',goals),('boxes',boxes)]},
 'player':{'type':'int','initial':player},'moves':{'type':'int','initial':0},'solved':{'type':'bool','initial':False}
 },
 'inputs':{'actions':[{'id':f'move{x}','valueType':'button','policy':'first-ready','bindings':[{'source':'keyboard.button','config':{'code':f'Arrow{x}'}}]} for x in ['Left','Right','Up','Down']], 'traceRecording':'disabled'},
 'rules':[],'outcomes':[{'id':'completed','status':'won','priority':0,'when':{'state':'/solved'}}],
 'presentation':{'hud':[{'id':'movesHud','kind':'text','text':'移动次数','bind':{'text':{'template':'Moves: {0}','args':[{'state':'/moves'}]}}}], 'cues':[],'scene2d':{
  'width':8,'height':6.5,'background':'#0d1729','nodes':[
   node('title','text',[0,2.94],'#b5cee8',text={'literal':'A2Game / Push Box'},fontSize=.36),
   node('movesLabel','text',[3.0,2.94],'#ecb963',text={'state':'/moves'},fontSize=.42)
  ],
  'repeat':[
   {'id':'floor','source':{'literal':list(range(25))},'columns':5,'origin':[-2,2],'step':[1,1], 'indexMode':'cell',
     'template':[node('base','rect',[0,0],'#243550',size=[.94,.94])]},
   {'id':'walls','source':{'state':'/walls'},'columns':5,'origin':[-2,2],'step':[1,1], 'indexMode':'cell',
     'template':[node('block','rect',[0,0],'#536d89',size=[.92,.92])]},
   {'id':'goals','source':{'state':'/goals'},'columns':5,'origin':[-2,2],'step':[1,1], 'indexMode':'cell',
     'template':[node('marker','circle',[0,0],'#e3bc68',radius=.2)]},
   {'id':'boxes','source':{'state':'/boxes'},'columns':5,'origin':[-2,2],'step':[1,1], 'indexMode':'cell',
     'template':[node('crate','rect',[0,0],'#c88955',size=[.77,.77])]},
   {'id':'player','source':{'state':'/player'},'columns':5,'origin':[-2,2],'step':[1,1], 'indexMode':'cell',
     'template':[node('avatar','circle',[0,0],'#57d7c8',radius=.34)]}
  ]}},
 'tests':['../tests/grid-push.conformance.json'],'extensions':{}
}
sok['requires']['all'].append({'id':'a2game.input.touch.swipe','version':'0.1.0'})
for action in sok['inputs']['actions']:
 direction={'moveLeft':'left','moveRight':'right','moveUp':'up','moveDown':'down'}[action['id']]
 action['bindings'].append({'source':'touch.swipe','config':{'direction':direction,'minDistanceNorm':0.12,'maxDurationUs':1200000}})
write(GAMES/'grid-push.game.json',sok)

def inject(action):return [{'op':'injectAction','action':action,'phase':e} for e in ('press','release')]
def case(id,seq):return {'id':id,'seed':42,'steps':seq}
suite={'format':'a2game-conformance','specVersion':'0.1.0','suiteId':'grid-push-core',
 'subject':{'type':'game','id':sok['id'],'file':'../games/grid-push.game.json'},
 'cases':[
 case('wall-move-does-not-consume-step',[{'op':'start'},*inject('moveLeft'),{'op':'step','ticks':1},
     {'op':'assert','path':'/state/player','equals':16},{'op':'assert','path':'/state/moves','equals':0},{'op':'assert','path':'/flow/status','equals':'playing'}]),
 case('push-box-into-goal',[{'op':'start'},*inject('moveRight'),{'op':'step','ticks':1},
     {'op':'assert','path':'/state/player','equals':17},{'op':'assert','path':'/state/moves','equals':1},
     *inject('moveUp'),{'op':'step','ticks':1},
     {'op':'assert','path':'/state/boxes','equals':[7]},{'op':'assert','path':'/state/solved','equals':True},
     {'op':'assert','path':'/flow/status','equals':'won'},
     {'op':'assertEvent','eventType':'grid.box-pushed','count':1}]),
 case('restart-restores-the-level',[{'op':'start'},*inject('moveRight'),{'op':'step','ticks':1},
     {'op':'restart'},{'op':'assert','path':'/state/player','equals':16},
     {'op':'assert','path':'/state/boxes','equals':[12]}, {'op':'assert','path':'/state/moves','equals':0},
     {'op':'assert','path':'/flow/status','equals':'playing'}])
 ]}
write(TESTS/'grid-push.conformance.json',suite)
# Migrated trace data is a fixture, not evidence of a real device sensor run.
old=load(TESTS/'touch-imu.input-trace.json');old['session']['gameRevision']=load(GAMES/'tap-target.game.json')['revision'];write(TESTS/'touch-imu.input-trace.json',old)
swipe_trace={
 'format':'a2game-input-trace','traceVersion':'0.1.0',
 'session':{'gameId':sok['id'],'gameRevision':sok['revision'],'tickHz':60,'seed':42,
  'inputNormalizerVersion':'0.1.0','coordinateProfile':'viewport-top-left-v1','recognizers':{'touch.swipe':'0.1.0'}},
 'events':[
  {'tickIndex':0,'seq':0,'source':'pointer','kind':'down','timeUs':1000,'payload':{'pointerId':1,'pointerType':'touch','u':.5,'v':.75}},
  {'tickIndex':10,'seq':1,'source':'pointer','kind':'up','timeUs':180000,'payload':{'pointerId':1,'pointerType':'touch','u':.7,'v':.75}},
  {'tickIndex':18,'seq':2,'source':'pointer','kind':'down','timeUs':300000,'payload':{'pointerId':2,'pointerType':'touch','u':.6,'v':.7}},
  {'tickIndex':27,'seq':3,'source':'pointer','kind':'up','timeUs':450000,'payload':{'pointerId':2,'pointerType':'touch','u':.6,'v':.35}}
 ]}
write(TESTS/'grid-push-swipe.input-trace.json',swipe_trace)
print('Updated scene2d schema, capability manifests and 4 game samples')
