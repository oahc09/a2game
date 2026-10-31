/** Actual browser input + original generated presentation. Never edits a game or calls a model. */
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {previewGeneratedDirectory,safePath} from '../generator/index.mjs';
import {playSolution} from './agent-solver.mjs';
import {HeadlessRuntime,readPointer} from '../dist/index.js';
import {root,makeRegistry} from './registry.mjs';
const input=safePath(process.argv[2]),assertHud=process.argv.includes('--assert-hud'),directory=resolve(root,'reports/generator-game-review-'+randomUUID());mkdirSync(directory,{recursive:true});
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),rel=p=>relative(root,p).replaceAll('\\','/'),save=(name,v)=>writeFileSync(join(directory,name),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const files=dir=>readdirSync(resolve(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]);
const sourcePaths=['scripts/generator-game-review.mjs','generator/index.mjs','scripts/content-service.mjs','scripts/registry.mjs',...files('src'),...files('dist').filter(p=>p.endsWith('.js')),...files('player').filter(p=>!p.startsWith('player/vendor/'))];
const fingerprints=Object.fromEntries(sourcePaths.map(p=>[p,hash(resolve(root,p))]));save('fingerprints.json',fingerprints);
const sdk=JSON.parse(readFileSync(resolve(root,'player/vendor/sdk-provenance.json'),'utf8'));for(const file of sdk.files)assert.equal(hash(resolve(root,file.path)),file.sha256);save('sdk-provenance.json',sdk);
const gameFile=join(input,'game.json'),solutionFile=join(input,'solution.json'),game=JSON.parse(readFileSync(gameFile,'utf8')),solution=JSON.parse(readFileSync(solutionFile,'utf8'));
const report={format:'a2game-generator-game-review',version:1,status:'PARTIAL',game:rel(gameFile),gameSha256:hash(gameFile),solutionSha256:hash(solutionFile),modelCalls:0,scope:'Original generated JSON and UI; actual keyboard/DOM-button input where supported, desktop/390px, idle negative scenario. No raw-input injection fallback. Not all-rule-variant or subjective/human acceptance.',humanReview:'NOT_RUN',G3:'NOT_RUN',cases:[]};
let browser;
try{
 const unsupported=solution.some(row=>row.raw?.length||row.action&&(!game.inputs.actions.some(a=>a.id===row.action&&a.valueType==='button')||row.value!==undefined&&typeof row.value!=='boolean'));
 if(unsupported){report.status='BLOCKED';report.code='SOURCE_INPUT_PROFILE_REQUIRED';throw Error('Solution uses raw or non-button inputs; requires a specific physical browser input profile.');}
 const components=game.scenes.flatMap(s=>s.entities.flatMap(e=>e.components??[])),worldComponent=components.find(c=>c.capability.id==='a2game.realtime.world');
 const configuredDeadline=Math.max(0,...components.map(c=>Number.isInteger(c.config?.maxTicks)?c.config.maxTicks+1:0));
 const expected=playSolution(game,solution),negativeTicks=Math.min(12000,Math.max(1,expected.requestedTicks,configuredDeadline)),idle=new HeadlessRuntime(game,makeRegistry());let idleExpected;
 try{idle.start();idle.step(negativeTicks);idleExpected=idle.observe();}finally{idle.dispose();}
 browser=await chromium.launch({headless:true});report.browser=browser.version();
 for(const backend of ['three','air'])for(const viewport of [{name:'desktop',width:1280,height:1050},{name:'mobile',width:390,height:844}]){
  const row={backend,viewport:viewport.name,status:'FAIL',keyboardActions:0,buttonActions:0,errors:[],consoleErrors:[],screenshots:{}};let session,context;
  try{
   session=await previewGeneratedDirectory(input,{backend});assert.equal(session.status,'READY');context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}});const page=await context.newPage();
   page.on('pageerror',e=>row.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});
   await page.goto(session.url+'&clock=manual');await page.waitForFunction(()=>window.__a2game?.getState().flow.status==='playing',null,{timeout:60000});
   assert.equal(await page.evaluate(()=>window.__a2game.backend),backend);
   const verifyHud=async state=>{
    const hud=await page.locator('#score').textContent(),buttons=await page.locator('button[data-action]').evaluateAll(els=>els.map(el=>({id:el.dataset.action,text:el.textContent,aria:el.getAttribute('aria-label'),pad:!!el.closest('.pad')})));
    for(const item of game.presentation.hud??[]){
     if(item.kind==='text'&&typeof item.bind?.state==='string'&&!item.bind?.text){
      let value;try{value=readPointer(state.state,item.bind.state);}catch{continue;}
      if(['string','number','boolean'].includes(typeof value)){assert.ok(hud.includes((item.text??'').split('/')[0].trim()));assert.ok(hud.includes(typeof value==='boolean'?(value?'是':'否'):String(value)));}
     }else if(item.kind==='button'&&item.text?.trim()&&game.inputs.actions.some(a=>a.id===item.bind?.action&&a.valueType==='button')){
      const first=game.presentation.hud.find(h=>h.kind==='button'&&h.bind?.action===item.bind.action&&h.text?.trim());if(first!==item)continue;
      const button=buttons.find(b=>b.id===item.bind.action);assert.ok(button,'Declared HUD button is missing');assert.equal(button.aria,item.text);if(!button.pad||button.id==='collect')assert.equal(button.text,item.text);
     }
    }
    return {text:hud,buttons};
   };
   const screenshot=async phase=>{const p=join(directory,`${backend}-${viewport.name}-${phase}.png`);await page.screenshot({path:p,fullPage:true});const canvas=join(directory,`${backend}-${viewport.name}-${phase}-canvas.png`);await page.locator('#GameCanvas').screenshot({path:canvas});row.screenshots[phase]={path:rel(p),sha256:hash(p),canvas:rel(canvas),canvasSha256:hash(canvas)};};
   row.initial=await page.evaluate(()=>window.__a2game.getState());if(assertHud)row.initialHud=await verifyHud(row.initial);await screenshot('initial');
   row.layout=await page.evaluate(()=>{const frame=JSON.parse(window.render_game_to_text()).presentation,rect=document.getElementById('GameCanvas').getBoundingClientRect(),scale=Math.min(rect.width/frame.width,rect.height/frame.height),text=frame.commands.filter(c=>c.kind==='text');return {noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth,minCssTextPx:text.length?Math.min(...text.map(c=>c.fontSize*scale)):null,textCount:text.length,buttons:[...document.querySelectorAll('button[data-action]')].filter(b=>b.getBoundingClientRect().width>0&&getComputedStyle(b).visibility!=='hidden').map(b=>({id:b.dataset.action,width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height}))};});
   await page.locator('#pause').click();const paused=await page.evaluate(()=>window.__a2game.getHash());await page.evaluate(()=>window.__a2game.step(3));assert.equal(await page.evaluate(()=>window.__a2game.getHash()),paused);await page.locator('#pause').click();await page.locator('#restart').click();
   row.trace=[];
   for(const [i,step]of solution.entries()){
    if(step.action&&step.value===false){row.falseButtonRowsWaited=(row.falseButtonRowsWaited??0)+1;}
    // A false-valued normalized button press has no physical down event. Wait instead only when every resulting Hash is identical.
    if(step.action&&step.value!==false){const action=game.inputs.actions.find(a=>a.id===step.action),key=action.bindings.find(b=>b.source==='keyboard.button')?.config?.code;
     if(viewport.name==='desktop'&&key&&/^(Key[A-Z]|Digit[0-9]|Arrow(Left|Right|Up|Down)|Space|Enter|Escape|Backspace)$/.test(key)){await page.locator('h1').first().click();await page.keyboard.press(key);row.keyboardActions++;}
     else{const buttons=page.locator('button[data-action]'),index=await buttons.evaluateAll((els,id)=>els.findIndex(e=>e.dataset.action===id),step.action);assert.ok(index>=0,'No actual browser control for winning action');await buttons.nth(index).click({timeout:5000});row.buttonActions++;}
    }
    await page.evaluate(ticks=>window.__a2game.step(ticks),step.ticks);const state=await page.evaluate(()=>window.__a2game.getState());assert.equal(state.exactHash,expected.trace[i].hash,`Source input Hash differs at row ${i}`);row.trace.push({index:i,tickIndex:state.tickIndex,status:state.flow.status,hash:state.exactHash});
    if(assertHud)row.finalHud=await verifyHud(state);
    if(!row.screenshots.progress&&state.flow.status==='playing')await screenshot('progress');
   }
   row.final=await page.evaluate(()=>window.__a2game.getState());assert.equal(row.final.flow.status,'won');await screenshot('won');
   if(worldComponent&&viewport.name==='desktop'){
    row.movement=[];
    const player=state=>{let value=state.state;for(const part of worldComponent.config.statePath.slice(1).split('/'))value=value?.[part.replaceAll('~1','/').replaceAll('~0','~')];const bodies=Array.isArray(value?.bodies)?value.bodies:Object.values(value?.bodies??{});return bodies.find(b=>b.kind==='actor'&&b.hp>0);};
    for(const id of ['left','right','up','down']){
     const action=game.inputs.actions.find(a=>a.id===worldComponent.config.actions?.[id]),key=action?.bindings.find(b=>b.source==='keyboard.button')?.config?.code;if(!key)continue;
     await page.locator('#restart').click();const before=player(await page.evaluate(()=>window.__a2game.getState()));await page.locator('h1').first().click();await page.keyboard.down(key);await page.evaluate(()=>window.__a2game.step(3));const after=player(await page.evaluate(()=>window.__a2game.getState()));await page.keyboard.up(key);await page.evaluate(()=>window.__a2game.step(1));
     row.movement.push({action:id,source:'ACTUAL_KEYBOARD_HOLD',before,after,moved:!!before&&!!after&&(before.x!==after.x||before.y!==after.y)});
    }
   }
   await page.locator('#restart').click();assert.equal(await page.evaluate(()=>window.__a2game.getHash()),row.initial.exactHash);if(assertHud)assert.equal((await verifyHud(await page.evaluate(()=>window.__a2game.getState()))).text,row.initialHud.text);
   await page.evaluate(ticks=>window.__a2game.step(ticks),negativeTicks);row.negativeTicks=negativeTicks;row.idle=await page.evaluate(()=>window.__a2game.getState());assert.equal(row.idle.exactHash,idleExpected.exactHash);await screenshot('idle-negative');
   row.noInputCannotWin=row.idle.flow.status!=='won';
   await page.evaluate(()=>window.__a2game.dispose());row.disposal=await page.evaluate(()=>window.__a2game.diagnostics());assert.equal(row.disposal.resources.ownedResources,0);assert.equal(row.disposal.listenersActive,false);assert.equal(row.disposal.adapter.disposed,true);
   assert.deepEqual(row.errors,[]);assert.deepEqual(row.consoleErrors,[]);row.status='PASS_REFERENCE';
  }catch(e){row.code=e.code??'A2G_GEN_GAME_REVIEW';row.failure=String(e.message);}
  finally{await context?.close();await session?.close?.();if(session?.url){await assert.rejects(fetch(session.url));row.listenerClosed=true;}save(`${backend}-${viewport.name}.json`,row);report.cases.push(row);}
 }
 report.sourceInput=report.cases.length===4&&report.cases.every(c=>c.status==='PASS_REFERENCE')?'PASS_REFERENCE':'PARTIAL';
 report.autoQuality={noIdleVictory:report.cases.every(c=>c.noInputCannotWin),noHorizontalOverflow:report.cases.every(c=>c.layout?.noHorizontalOverflow),readableText16px:report.cases.every(c=>c.layout?.minCssTextPx>=16),touchTargets44px:report.cases.every(c=>c.layout?.buttons.every(b=>b.width>=44&&b.height>=44)),progressObserved:report.cases.every(c=>c.screenshots.progress),humanReview:'NOT_RUN'};
 report.status=report.sourceInput==='PASS_REFERENCE'&&Object.entries(report.autoQuality).filter(([key])=>key!=='humanReview').every(([,value])=>value===true)?'PASS_REFERENCE':'PARTIAL';
}catch(e){report.code??=e.code??'A2G_GEN_GAME_REVIEW';report.failure=String(e.message);}
finally{await browser?.close();report.originalUnchanged=hash(gameFile)===report.gameSha256&&hash(solutionFile)===report.solutionSha256;report.sourcesUnchanged=Object.entries(fingerprints).every(([p,sha])=>hash(resolve(root,p))===sha);if(!report.originalUnchanged||!report.sourcesUnchanged)report.status='FAIL';save('summary.json',report);console.log(JSON.stringify({status:report.status,sourceInput:report.sourceInput,receipt:rel(join(directory,'summary.json')),failure:report.failure}));}
if(report.status==='FAIL'||report.status==='BLOCKED')process.exitCode=1;
