import {fail} from '../errors.js';
import {readPointer,safeInteger} from '../utils.js';
import type {GameDefinition,ModuleContext,ModuleResult,TrustedCapabilityImplementation} from '../types.js';
/** One start event per generation, plus an optional shared Tick counter. No host timers. */
export function simulateBootstrap(ctx:ModuleContext):ModuleResult{
 const started=readPointer(ctx.world.state,String(ctx.config.startedPath));if(typeof started!=='boolean')fail('A2G_E_CAP_CONFIG','Bootstrap flag must be boolean');
 const proposals:NonNullable<ModuleResult['proposals']>=[],events:NonNullable<ModuleResult['events']>=[];
 if(!started){proposals.push({kind:'state.set',path:String(ctx.config.startedPath),value:true});events.push({type:'level.started',payload:{}});}
 if(ctx.config.tickPath){const value=readPointer(ctx.world.state,String(ctx.config.tickPath));if(!safeInteger(value)||value<0||value>=1000000000)fail('A2G_E_BUDGET_EXCEEDED','Level tick budget exceeded');proposals.push({kind:'state.add',path:String(ctx.config.tickPath),value:1});events.push({type:'level.tick',payload:{tick:value+1}});}
 return {proposals,events};
}
export const bootstrapImplementation:TrustedCapabilityImplementation={role:'module',simulate:simulateBootstrap};
export function validateBootstrapDefinition(def:GameDefinition):void{
 const initial=Object.fromEntries(Object.entries(def.state).map(([key,field])=>[key,field.initial]));for(const entity of [...def.scenes.flatMap(scene=>scene.entities),...Object.values(def.prototypes??{})])for(const component of entity.components??[])if(component.capability.id==='a2game.core.bootstrap'){
  const c=component.config;if(readPointer(initial,String(c.startedPath))!==false)fail('A2G_E_CAP_CONFIG','Authored bootstrap flag must start false');if(c.tickPath){const ticks=readPointer(initial,String(c.tickPath));if(!safeInteger(ticks)||ticks<0)fail('A2G_E_CAP_CONFIG','Invalid bootstrap tick path');}
 }
}
