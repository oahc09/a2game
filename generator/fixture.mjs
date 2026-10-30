/** Constructed engineering fixture, never an independent model/G3 result. */
export function createFixture(){
 const capability=id=>({id,version:'0.1.0'}),game={
  format:'a2game',specVersion:'0.1.0',id:'org.a2game.generator.demo-fixture',revision:1,
  meta:{title:'DEMO_FIXTURE',description:'Deterministic pipeline counter; not model evidence.',genres:['casual']},
  requires:{all:['a2game.core.state','a2game.core.rules','a2game.core.flow','a2game.rules.state-add','a2game.visual.text','a2game.visual.scene2d','a2game.input.keyboard.button'].map(capability)},
  world:{dimension:'2d',coordinateSystem:'rh-y-up',units:'meter',clock:{tickHz:60,seed:42,maxCatchUpTicks:5}},
  assets:{},prototypes:{},scenes:[{id:'main',entities:[]}],entryScene:'main',
  state:{score:{type:'int',initial:0},goal:{type:'int',initial:3}},
  inputs:{actions:[{id:'collect',valueType:'button',policy:'first-ready',bindings:[{source:'keyboard.button',config:{code:'Space'}}]}],traceRecording:'disabled'},
  rules:[{id:'count',priority:0,on:{type:'input.action',action:'collect',edge:'press'},if:{op:'lt',args:[{state:'/score'},{state:'/goal'}]},do:[{op:'state.add',path:'/score',value:1}]}],
  outcomes:[{id:'complete',status:'won',priority:0,when:{op:'gte',args:[{state:'/score'},{state:'/goal'}]}}],
  presentation:{hud:[{id:'score',kind:'text',text:'DEMO_FIXTURE',bind:{text:{template:'DEMO_FIXTURE: {0} / {1}',args:[{state:'/score'},{state:'/goal'}]}}}],cues:[],scene2d:{width:8,height:6,background:'#102030',nodes:[{id:'label',kind:'text',at:[0,1],fill:'#ffffff',fontSize:0.4,text:{literal:'DEMO_FIXTURE'}},{id:'value',kind:'text',at:[0,0],fill:'#ffffff',fontSize:0.6,text:{state:'/score'}}]}},
  tests:['../tests/demo-fixture.conformance.json'],extensions:{}};
 const clicks=count=>Array.from({length:count},()=>[{op:'injectAction',action:'collect',phase:'press'},{op:'injectAction',action:'collect',phase:'release'},{op:'step',ticks:1}]).flat();
 const conformance={format:'a2game-conformance',specVersion:'0.1.0',suiteId:'demo-fixture',subject:{type:'game',id:game.id,file:'../games/demo-fixture.game.json'},cases:[{id:'three-clicks-win',seed:42,steps:[{op:'start'},...clicks(3),{op:'assert',path:'/state/score',equals:3},{op:'assert',path:'/flow/status',equals:'won'}]},{id:'two-clicks-not-enough',seed:42,steps:[{op:'start'},...clicks(2),{op:'assert',path:'/state/score',equals:2},{op:'assert',path:'/flow/status',equals:'playing'}]}]};
 return {format:'a2game-generation-output',version:1,game,conformance,provenance:{kind:'fixture',model:'DEMO_FIXTURE'},solution:Array.from({length:3},()=>({action:'collect',ticks:1}))};
}
