import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cp,mkdir,mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {extname,join,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const read=async file=>JSON.parse(await readFile(file,'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const {refreshedStandalonePackages}= (await read('project/status.json')).threeCompleteGamesBusinessRun;
const packages=Object.fromEntries(['skylinePatrol','patternHarbor','tideglassMatch','tideglassCombos']
  .map(id=>[id,resolve(refreshedStandalonePackages[id])]));
const results=[];
const inventories={};
const packageModule=(root,file)=>import(pathToFileURL(join(root,file)).href);
async function verifyStaticContent(id,root,inventory){
  const {sha256Canonical}=await packageModule(root,'dist/exact-hash.js');
  const {capabilityManifestDigest,verifyReleasedGame}=await packageModule(root,'dist/content-release.js');
  const folder=join(root,'specs/v0.1/capabilities');
  const manifests=await Promise.all((await readdir(folder)).filter(file=>file.endsWith('.capability.json')).map(file=>read(join(folder,file))));
  const manifestDigest=capabilityManifestDigest(manifests);
  if(id==='skylinePatrol'){
    const {trustedBundleDigest}=await packageModule(root,'player/trusted-bundle.mjs');
    const bundle=await read(join(root,'player/game.release.json'));
    assert.equal(sha256Canonical(bundle),trustedBundleDigest);
    const envelope={...bundle,receipt:inventory.receipt};
    verifyReleasedGame(envelope,bundle.sha256Jcs,manifestDigest);
    assert.throws(()=>verifyReleasedGame({...envelope,definition:{...bundle.definition,revision:bundle.definition.revision+1}},
      bundle.sha256Jcs,manifestDigest),{code:'A2G_E_RELEASE_INTEGRITY'});
    return 1;
  }
  const lock=await packageModule(root,'player/static-delivery-lock.mjs');
  const collection=await read(join(root,'player/collection.static.json'));
  assert.equal(sha256Canonical(collection),lock.collectionDigest);
  assert.equal(lock.collectionDigest,inventory.collectionDigest);
  assert.equal(collection.id,inventory.collection);
  for(const level of collection.levels){
    const envelope=await read(join(root,'player','releases',level.release+'.json'));
    assert.equal(sha256Canonical(envelope),lock.releaseDigests[level.release]);
    assert.ok(inventory.receipts.some(receipt=>receipt.sha256Jcs===level.release));
    verifyReleasedGame(envelope,level.release,manifestDigest);
    const altered={...envelope,definition:{...envelope.definition,revision:envelope.definition.revision+1}};
    assert.throws(()=>verifyReleasedGame(altered,level.release,manifestDigest),{code:'A2G_E_RELEASE_INTEGRITY'});
  }
  return collection.levels.length;
}
for(const [id,root] of Object.entries(packages)){
  const inventory=await read(join(root,'build-inventory.json'));
  for(const {file,sha256} of inventory.files){
    const absolute=resolve(root,file);
    assert.ok(absolute.startsWith(root+sep),file);
    assert.equal(sha(await readFile(absolute)),sha256,file);
  }
  const releases=await verifyStaticContent(id,root,inventory);
  inventories[id]={files:inventory.files.length,releases,sha256:sha(await readFile(join(root,'build-inventory.json')))};
  console.log(id,`PASS ${inventory.files.length} inventory entries, ${releases} content releases`);
}
if(process.argv.includes('--inventory-only'))process.exit(0);

const fixtures=resolve('games/business-complete');
const trace=(game,file)=>read(join(fixtures,game,file));
const output=`output/three-games-delivery-${Date.now()}`;
await mkdir(output,{recursive:true});
const isolated=await mkdtemp(join(tmpdir(),'a2game-business-delivery-'));
for(const [id,root] of Object.entries(packages))await cp(root,join(isolated,id),{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json',
  '.css':'text/css','.png':'image/png','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{
  try{
    const path=resolve(isolated,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!path.startsWith(isolated+sep))throw Error('Path outside static root');
    const bytes=await readFile(path);
    res.writeHead(200,{'content-type':mime[extname(path)]??'application/octet-stream'});res.end(bytes);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin=`http://127.0.0.1:${server.address().port}`;
const canvasIn=page=>page.frameLocator('#game').locator('#GameCanvas');
const collectionState=page=>page.evaluate(()=>JSON.parse(window.render_game_to_text()).game.state.puzzle);
const waitLevel=(page,level,status='playing')=>page.waitForFunction(({level,status})=>{
  const state=JSON.parse(window.render_game_to_text?.()??'{}');
  return !state.loading&&state.level===level&&state.game?.flow.status===status;
},{level,status});
const waitMoves=(page,moves)=>page.waitForFunction(moves=>JSON.parse(window.render_game_to_text()).game?.state.puzzle.moves===moves,moves);
async function checkSoundPreference(page){
  const button=page.locator('#sound');
  assert.equal(await button.getAttribute('aria-pressed'),'false');
  await button.click();
  await page.waitForFunction(()=>document.getElementById('sound')?.textContent==='声音：开');
  await button.click();
  await page.waitForFunction(()=>document.getElementById('sound')?.textContent==='声音：关');
  await button.click();
  await page.waitForFunction(()=>document.getElementById('sound')?.textContent==='声音：开');
  await page.reload();
  await waitLevel(page,0);
  assert.equal(await button.getAttribute('aria-pressed'),'true');
  assert.match(await button.innerText(),/待启用/);
}
async function coordinates(canvas,width,height){
  await canvas.scrollIntoViewIfNeeded();
  const box=await canvas.boundingBox();
  const scale=Math.min(box.width/width,box.height/height);
  return ({u,v})=>[box.x+box.width/2+(u-.5)*width*scale,box.y+box.height/2+(v-.5)*height*scale];
}
async function selectCards(page,sequence,moves=0){
  const at=await coordinates(canvasIn(page),9,13);
  for(const action of sequence.events.filter(event=>event.kind==='down')){
    await page.mouse.click(...at(action.payload));
    await waitMoves(page,++moves);
  }
}
async function exchange(page,sequence,index=0){
  await page.waitForFunction(()=>{
    const {game}=JSON.parse(window.render_game_to_text?.()??'{}');
    return game&&game.tickIndex>=game.state.puzzle.settleUntilTick;
  });
  const at=await coordinates(canvasIn(page),8,10);
  const [from,,to]=sequence.events.slice(index*3,index*3+3);
  await page.mouse.move(...at(from.payload));await page.mouse.down();
  await page.mouse.move(...at(to.payload),{steps:4});await page.mouse.up();
  await waitMoves(page,index+1);
}

async function shooter(page,engine){
  const sequence=await trace('skyline-patrol','delivery-score-trace.json');
  await page.goto(`${origin}/skylinePatrol/player/index.html?backend=${engine==='air'?'cocosairjs':engine}`);
  await page.locator('#start').click();
  const at=await coordinates(page.locator('#game canvas'),10,16);
  const [down,align,crash]=sequence.events;
  await page.mouse.move(...at(down.payload));await page.mouse.down();await page.mouse.move(...at(align.payload));
  await page.waitForFunction(()=>/得分 100\b/.test(document.getElementById('hud')?.textContent??''));
  await page.mouse.move(...at(crash.payload));
  await page.waitForFunction(()=>window.examplePlayer?.status()==='lost');
  await page.mouse.up();
  assert.match(await page.locator('#hud').innerText(),/最高分 100/);
  await page.screenshot({path:`${output}/skyline-${engine}.png`});
  await page.locator('#restart').click();
  await page.waitForFunction(()=>window.examplePlayer?.status()==='playing');
  assert.match(await page.locator('#hud').innerText(),/得分 0/);
  await page.reload();
  await page.waitForFunction(()=>/最高分 100\b/.test(document.getElementById('hud')?.textContent??''));
  await page.locator('#dispose').click();
  await page.waitForFunction(()=>window.examplePlayer?.diagnostics().disposed===true);
  return {score:100,restart:true,bestAfterRefresh:100,disposed:true};
}

async function tray(page,engine){
  await page.goto(`${origin}/patternHarbor/player/collection.html?backend=${engine}`);
  await waitLevel(page,0);
  await checkSoundPreference(page);
  await selectCards(page,await trace('pattern-harbor','tutorial-trace.json'));
  await page.waitForFunction(()=>document.getElementById('sound')?.textContent==='声音：开');
  await waitLevel(page,0,'won');await page.locator('#next').click();await waitLevel(page,1);
  const loss=await trace('pattern-harbor','challenge-loss-trace.json');
  await selectCards(page,loss);await waitLevel(page,1,'lost');
  await page.locator('#retry').click();await waitLevel(page,1);
  await selectCards(page,{events:loss.events.slice(0,6)});
  await page.getByRole('button',{name:'移出前三张',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).game?.state.puzzle.trayTools.reserveIds.length===3);
  const saved=await collectionState(page);
  await page.reload();await waitLevel(page,1);
  await page.getByText('已恢复上次牌局。',{exact:true}).waitFor();
  assert.deepEqual(await collectionState(page),saved);
  await page.getByRole('button',{name:'取回第 1 张',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).game?.state.puzzle.trayTools.reserveIds.length===2);
  await page.locator('#undo').click();
  await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).game?.state.puzzle.trayTools.undoRemaining===0);
  await page.locator('#retry').click();await waitLevel(page,1);
  await selectCards(page,await trace('pattern-harbor','challenge-win-trace.json'));
  await waitLevel(page,1,'won');
  await page.locator('#message').filter({hasText:'全部关卡已完成。'}).waitFor();
  assert.match(await page.locator('#moves').innerText(),/144 步/);
  await page.screenshot({path:`${output}/pattern-${engine}.png`});
  return {tutorialCards:18,challengeCards:144,restartAfterLoss:true,restoredReserve:true,undoAfterRestore:true,soundRestored:true};
}

async function match(page,engine,combos=false){
  const prefix=combos?'combos/':'',id=combos?'tideglassCombos':'tideglassMatch';
  const {levels}=await trace('tideglass-match',prefix+'collection.json');
  await page.goto(`${origin}/${id}/player/collection.html?backend=${engine}`);
  await waitLevel(page,0);
  if(!combos){
    await checkSoundPreference(page);
    await exchange(page,await trace('tideglass-match','m01-loss-trace.json'));await waitLevel(page,0,'lost');
    await page.waitForFunction(()=>document.getElementById('sound')?.textContent==='声音：开');
    await page.locator('#retry').click();await waitLevel(page,0);
  }
  for(const [i,level] of levels.entries()){
    const route=await trace('tideglass-match',prefix+level.game.replace('.game.json','-win-trace.json'));
    for(let j=0;j<route.events.length/3;j++){
      await exchange(page,route,j);
      if(level.id==='m12'&&j===0){
        const saved=await collectionState(page);
        await page.reload();await waitLevel(page,i);
        await page.getByText('已恢复上次棋局。',{exact:true}).waitFor();
        const restored=await collectionState(page);
        assert.deepEqual(restored.board,saved.board);
        assert.equal(restored.movesRemaining,saved.movesRemaining);
      }
    }
    await waitLevel(page,i,'won');
    assert.equal((await collectionState(page)).score,2*level.baseScore);
    await page.locator('#levels button').nth(i).getByText('3 星 · '+2*level.baseScore+' 分',{exact:true}).waitFor();
    if(i<levels.length-1){await page.locator('#next').click();await waitLevel(page,i+1);}
  }
  await page.locator('#message').filter({hasText:'全部关卡已完成。'}).waitFor();
  await page.screenshot({path:`${output}/${id}-${engine}.png`});
  return {levels:levels.length,allThreeStars:true,
    ...(combos?{playableVariants:3}:{restartAfterLoss:true,restoredFinalBoard:true,soundRestored:true})};
}

async function narrowViewport(page,id,engine){
  if(id==='skylinePatrol'){
    await page.goto(`${origin}/${id}/player/index.html?backend=${engine==='air'?'cocosairjs':engine}`);
    await page.locator('#start').tap();
    await page.waitForFunction(()=>window.examplePlayer?.status()==='playing');
    await page.locator('#pause').tap();
    await page.waitForFunction(()=>window.examplePlayer?.status()==='paused');
  }else{
    await page.goto(`${origin}/${id}/player/collection.html?backend=${engine}`);
    await waitLevel(page,0);
    if(id==='patternHarbor'){
      const at=await coordinates(canvasIn(page),9,13);
      const route=await trace('pattern-harbor','tutorial-trace.json');
      await page.touchscreen.tap(...at(route.events[0].payload));
      await waitMoves(page,1);
      await page.locator('#moves').filter({hasText:'1 步'}).waitFor();
    }else{
      const at=await coordinates(canvasIn(page),8,10);
      const route=await trace('tideglass-match','m01-win-trace.json');
      const [from,,to]=route.events;
      const client=await page.context().newCDPSession(page);
      const touch=(type,points)=>client.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y])=>({x,y}))});
      try{
        await touch('touchStart',[at(from.payload)]);
        await touch('touchMove',[at(to.payload)]);
        await touch('touchEnd',[]);
      }finally{await client.detach();}
      await waitLevel(page,0,'won');
      await page.locator('#message').filter({hasText:'本关已完成'}).waitFor();
    }
  }
  const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,dpr:devicePixelRatio}));
  assert.equal(dimensions.dpr,2);
  assert.ok(dimensions.scroll<=dimensions.width+1,`Horizontal overflow: ${JSON.stringify(dimensions)}`);
  if(id!=='skylinePatrol'){
    const widths=await page.locator('#levels button').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().width));
    assert.ok(widths.length&&widths.every(width=>width>=100),`Unreadable level buttons: ${widths}`);
  }
  await page.screenshot({path:`${output}/${id}-${engine}-390.png`,fullPage:true});
  return dimensions;
}

const receipt={status:'IN_PROGRESS',packages,inventories,results};
const save=()=>writeFile(output+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');
let browser;
try{
  browser=await chromium.launch();
  receipt.browser=browser.version();
  for(const engine of ['three','air'])for(const [id,scenario] of [
    ['skylinePatrol',shooter],['patternHarbor',tray],['tideglassMatch',match],
    ['tideglassCombos',(page,backend)=>match(page,backend,true)]
  ]){
    const page=await browser.newPage({viewport:{width:1000,height:945}});
    const errors=[],network=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.origin===origin&&!url.pathname.includes('/api/'))return route.continue();
      network.push(url.href);
      return route.abort();
    });
    try{
      const result=await scenario(page,engine);
      assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
      results.push({id,engine,status:'PASS',...result});
      await save();
      console.log(id,engine,'PASS');
    }finally{await page.close();}
  }
  receipt.integrityRejections=[];
  for(const id of Object.keys(packages)){
    const single=id==='skylinePatrol';
    const entry=single?'index':'collection',target=single?'game.release.json':'collection.static.json';
    const json=await read(join(isolated,id,'player',target));
    if(single)json.definition.meta.title+=' (changed)';
    else json.title+=' (changed)';
    const page=await browser.newPage();
    try{
      await page.route(`${origin}/${id}/player/${target}`,route=>route.fulfill({json}));
      await page.goto(`${origin}/${id}/player/${entry}.html`);
      await page.waitForFunction(id=>(document.getElementById(id)?.textContent??'').includes('A2G_E_RELEASE_INTEGRITY'),single?'status':'error');
      assert.equal(await page.locator(single?'#game canvas':'#levels button').count(),0);
      receipt.integrityRejections.push(id);
    }finally{await page.close();}
  }
  receipt.narrowViewport=[];
  for(const engine of ['three','air'])for(const id of ['skylinePatrol','patternHarbor','tideglassMatch']){
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
    try{
      const dimensions=await narrowViewport(page,id,engine);
      receipt.narrowViewport.push({id,engine,...dimensions,input:'browser-touch-emulation'});
      console.log(id,engine,'PASS 390px/DPR2');
    }finally{await page.close();}
  }
  receipt.status='PASS';
  await save();console.log(output);
}catch(error){
  receipt.status='FAIL';receipt.error=String(error.stack??error);
  await save();console.error(output);throw error;
}finally{
  await browser?.close();
  await new Promise(done=>server.close(done));
}
