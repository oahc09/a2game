/** Deterministic engineering fixture. Never an independent model or G3 evidence. */
import {readFileSync} from 'node:fs';
let text='';for await(const chunk of process.stdin)text+=chunk;const request=JSON.parse(text);
if(request.attempt>1&&!request.previous?.output)throw Error('Repair must receive the previous output');
if(process.argv.includes('--stall'))await new Promise(resolve=>setTimeout(resolve,10000));
const game=JSON.parse(readFileSync('specs/v0.1/samples/games/tap-target.game.json','utf8'));game.id='org.a2game.generated.fixture-counter';game.meta.title='生成链夹具：三次点击';game.revision=1;game.state.goal.initial=3;game.tests=['../tests/fixture-counter.conformance.json'];
if(process.argv.includes('--always-invalid')||request.attempt===1&&!process.argv.includes('--one-shot'))game.specVersion='0.9.0';
const clicks=count=>Array.from({length:count},()=>[{op:'injectAction',action:'collect',phase:'press'},{op:'injectAction',action:'collect',phase:'release'},{op:'step',ticks:1}]).flat();
const conformance={format:'a2game-conformance',specVersion:'0.1.0',suiteId:'fixture-counter',subject:{type:'game',id:game.id,file:'../games/fixture-counter.game.json'},cases:[{id:'fixture-positive',steps:[{op:'start'},...clicks(3),{op:'assert',path:'/flow/status',equals:'won'}]},{id:'fixture-negative',steps:[{op:'start'},...clicks(2),{op:'assert',path:'/flow/status',equals:'playing'}]}]};
for(const c of conformance.cases)c.seed=42;
process.stdout.write(JSON.stringify({format:'a2game-generation-output',version:1,game,conformance,provenance:{kind:'fixture',model:'deterministic-engineering-fixture'}}));
