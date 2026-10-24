#!/usr/bin/env python3
"""Isolated Chromium verification when navigation is policy-blocked.
Runs *actual TypeScript source* compiled to AMD inside a page created by set_content();
projects the resulting observation through shared PresentationFrame to Canvas2D.
DOES NOT exercise actual Three.js/CocosAirJS SDKs or URL-based full page loading.
"""
from pathlib import Path
from subprocess import run
import json
import os
import shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
AMD=ROOT/'reports'/'core-amd-smoke.js'
local_tsc = ROOT/'node_modules'/'typescript'/'bin'/'tsc'
compiler = ['node', str(local_tsc)] if local_tsc.exists() else [shutil.which('tsc') or shutil.which('tsc.cmd') or 'tsc']
run([*compiler,'--module','amd','--moduleResolution','node','--target','ES2022','--lib','ES2022,DOM','--strict','--skipLibCheck','--outFile',str(AMD),'src/index.ts'],cwd=ROOT,check=True)
js=AMD.read_text(encoding='utf-8')
html=(ROOT/'player/index.html').read_text(encoding='utf-8').replace('<script type="module" src="./main.mjs"></script>','')
canvas_source=(ROOT/'player/adapters/canvas-preview.mjs').read_text(encoding='utf-8').replace('export class CanvasPreviewAdapter','class CanvasPreviewAdapter')
base=ROOT/'A2Game-V0.1-Spec'/'samples'
caps=[json.loads(p.read_text(encoding='utf-8')) for p in sorted((base/'capabilities').glob('*.capability.json'))]
results=[]
with sync_playwright() as p:
    # Prefer an explicit override or installed system Chromium, otherwise use
    # Playwright-managed Chromium (supported on Windows/Linux/macOS).
    chromium_path = os.environ.get('A2GAME_CHROMIUM') or shutil.which('chromium') or shutil.which('chromium-browser')
    options={'headless':True,'args':['--disable-dev-shm-usage','--use-gl=swiftshader']}
    if os.name != 'nt': options['args'].append('--no-sandbox')
    if chromium_path: options['executable_path']=chromium_path
    browser=p.chromium.launch(**options)
    scenarios=[('tap-target','tap-target',['collect','collect'],False),('grid-merge','grid-merge',['moveLeft'],False),('grid-merge-spawn','grid-merge-spawn',['moveLeft'],False),('grid-push','grid-push',['moveRight','moveUp'],False),('grid-push-swipe','grid-push',[],True)]
    for scenario, game_name, actions, use_trace in scenarios:
        page=browser.new_page(viewport={'width':1230,'height':920},device_scale_factor=1)
        page.set_content(html,wait_until='domcontentloaded')
        page.evaluate('''(source)=>{
          const mods={};
          window.define=(name,deps,factory)=>{
            const exports={};
            const args=deps.map(x=>x==='require'?function(dep){return mods[dep];}:x==='exports'?exports:mods[x]);
            factory(...args);
            mods[name]=exports;
          };
          (0,eval)(source);
          window.CORE=mods.index;
        }''',js)
        page.evaluate('(source)=>(0,eval)(source+"\\nwindow.CanvasTest=CanvasPreviewAdapter;")',canvas_source)
        defn=json.loads((base/'games'/f'{game_name}.game.json').read_text(encoding='utf-8'))
        trace=json.loads((base/'tests'/'grid-push-swipe.input-trace.json').read_text(encoding='utf-8')) if use_trace else None
        outcome=page.evaluate(r'''({game,manifests,actions,trace})=>{
          const reg=new window.CORE.CapabilityRegistry();
          for(const m of manifests){
             const impl=m.id==='a2game.puzzle.grid-slide-merge'?window.CORE.gridSlideMergeImplementation:m.id==='a2game.puzzle.grid-push'?window.CORE.gridPushImplementation:
               {role:m.kind==='core'?'builtin':m.kind==='rule-op'?'rule-op':m.kind==='input-source'||m.kind==='recognizer'?'recognizer':'headless-presentation'};
             reg.register(m,impl);
          }
          window.CORE.addReferenceRuleOps(reg);
          const rt=new window.CORE.HeadlessRuntime(game,reg);
          const renderer=new window.CanvasTest(document.querySelector('canvas'));
          const initial=rt.observe().exactHash;
          if(trace){ window.CORE.replayNormalizedInputTrace(rt,trace); }
          else {
            rt.start();
            for(const action of actions){
                rt.injectAction({action,phase:'press',sourceId:`test:${action}`});
                rt.injectAction({action,phase:'release',sourceId:`test:${action}`});
                rt.step(1);
            }
          }
          const obs=rt.observe();const frame=window.CORE.projectPresentation(game,obs);renderer.draw(frame);
          document.getElementById('status').textContent=obs.flow.status.toUpperCase();
          const hud=game.presentation.hud?.[0]?.bind?.text;
          document.getElementById('score').textContent=hud?.template ? hud.template.replace(/\{(\d+)\}/g,(all,index)=>String(obs.state[hud.args[Number(index)].state.slice(1)])) : JSON.stringify(obs.state);
          document.getElementById('hash').textContent=obs.exactHash;
          document.getElementById('trace').textContent=`tick ${obs.tickIndex} · ${game.world.clock.tickHz} Hz`;
          document.getElementById('game').value=game.id.includes('grid-merge-spawn')?'grid-merge-spawn':game.id.includes('grid-merge')?'grid-merge':game.id.includes('grid-push')?'grid-push':'tap-target';
          window.SMOKE={runtime:rt,renderer};
          return {initialHash:initial,finalHash:obs.exactHash,status:obs.flow.status,state:obs.state,tickIndex:obs.tickIndex};
        }''',{'game':defn,'manifests':caps,'actions':actions,'trace':trace})
        screenshot=ROOT/'reports'/f'browser-actual-core-{scenario}.png'
        page.screenshot(path=str(screenshot),full_page=True)
        pixels=page.evaluate('''()=>Array.from(document.querySelector('canvas').getContext('2d').getImageData(200,200,1,1).data)''')
        assert pixels[3]==255,(game_name,'canvas drawing absent')
        assert len(outcome['finalHash'])==64
        if game_name=='tap-target':assert outcome['status']=='won' and outcome['state']['score']==2
        elif game_name=='grid-push': assert outcome['status']=='won' and outcome['state']['boxes']==[7]
        else:assert outcome['state']['board'][0]==4
        results.append({'game':game_name,'scenario':scenario,'inputMode':'trace-replay' if use_trace else 'semantic-actions','status':'PASS','chromium':'144','runtime':'TS source compiled to AMD (shared core + projectPresentation)','screenshot':str(screenshot.relative_to(ROOT)),'observation':outcome,'canvasPixel':pixels})
        print('PASS',scenario, 'tick=',outcome['tickIndex'],'hash=',outcome['finalHash'])
        page.close()
    browser.close()
report={'status':'PASS','scope':'Chromium core logic + Canvas2D preview, not full navigation, not CocosAirJS/Three.js SDK render','cases':results,'limitations':['Actual URL navigation blocked by policy: ERR_BLOCKED_BY_ADMINISTRATOR','No actual SDK vendor builds in this environment','No real hardware touch/IMU']}
(ROOT/'reports'/'browser-core-smoke.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
