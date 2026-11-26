import { fail } from './errors.js';
import { readPointer, safeFinite, safeInteger } from './utils.js';
import type { GameDefinition, Json, JsonRecord, SessionObservation } from './types.js';
import {validateVisualStage,projectVisualStage} from './visual-stage.js';
import type {StageAudio,VisualStageFrame,VisualStageSpec} from './visual-stage.js';
import type {WorldBody} from './modules/realtime.js';

/** Scene2D 0.1 extension: pure declarative layout, not an engine scene graph. */
export type DataBinding = { state: string } | { item: true } | { literal: Json };
export type ColorBinding = string | { from: DataBinding; map: Record<string, string>; fallback: string };
export interface VisualNode {
    id: string;
    kind: 'rect' | 'circle' | 'text';
    at: [number, number];
    size?: [number, number]; radius?: number;
    fill?: ColorBinding;
    text?: DataBinding; fontSize?: number; omitWhen?: Json[];
}
export interface VisualRepeat {
    id: string;
    source: DataBinding;
    columns: number;
    origin: [number, number];
    step: [number, number];
    /** array: each item uses its list index; cell: each item holds a flattened grid index. */
    indexMode: 'array' | 'cell';
    positions?: [number,number][];
    omitItems?: number[];
    template: VisualNode[];
}
export interface Scene2DSpec {
    width: number; height: number;
    background: string;
    nodes: VisualNode[];
    repeat?: VisualRepeat[];
    bodyLayer?: {statePath:string;unitsPerMeter:1000;origin:[number,number];palette:Record<WorldBody['kind'],string>;circleKinds?:WorldBody['kind'][];valuePalette?:Record<string,string>;showValues?:boolean;minValueFontSize?:number;minValueBodySize?:number;motifs?:Partial<Record<WorldBody['kind'],VisualNode[]>>};
}
export type DrawCommand =
    | { id: string; kind: 'rect'; at: [number,number]; size: [number,number]; fill: string }
    | { id: string; kind: 'circle'; at: [number,number]; radius: number; fill: string }
    | { id: string; kind: 'text'; at: [number,number]; text: string; fontSize: number; fill: string };
export interface PresentationFrame {
    width: number; height: number; background: string;
    commands: DrawCommand[];
    stage?: VisualStageFrame;
}
export interface RenderSetup {
    width: number; height: number; background: string;
    stage?: {
        projection: VisualStageSpec['camera']['projection'];
        audio: Pick<StageAudio, 'id' | 'asset' | 'volume'>[];
    };
}
const color = /^#[0-9a-fA-F]{6}$/;
const nodeKeys=['id','kind','at','size','radius','fill','text','fontSize','omitWhen'];
const bindingKeys=['state','item','literal'];
const maxNodes=640;
function hasOnly(v: Record<string,unknown>, keys:string[], path:string):void {
    for(const key of Object.keys(v)) if(!keys.includes(key)) fail('A2G_E_PRESENTATION',`Unsupported field ${key}`,{jsonPointer:`${path}/${key}`});
}
function record(v:unknown,path:string):Record<string,unknown>{
    if(!v||typeof v!=='object'||Array.isArray(v))fail('A2G_E_PRESENTATION','Object expected',{jsonPointer:path});
    return v as Record<string,unknown>;
}
function coordinate(v:unknown,path:string): asserts v is [number,number] {
    if(!Array.isArray(v)||v.length!==2||!v.every(x=>safeFinite(x)&&Math.abs(x)<=10000))fail('A2G_E_PRESENTATION','Invalid two-dimensional coordinate',{jsonPointer:path});
}
function positive(v:unknown,path:string):void{
    if(!safeFinite(v)||v<=0||v>10000)fail('A2G_E_PRESENTATION','Positive finite value required',{jsonPointer:path});
}
function cssColor(v:unknown,path:string): asserts v is string {
    if(typeof v!=='string'||!color.test(v))fail('A2G_E_PRESENTATION','#RRGGBB color required',{jsonPointer:path});
}
function checkBinding(value:unknown,states:Set<string>,path:string):void{
    const v=record(value,path);
    hasOnly(v,bindingKeys,path);
    if(Object.keys(v).length!==1)fail('A2G_E_PRESENTATION','Exactly one binding branch required',{jsonPointer:path});
    if(Object.hasOwn(v,'state')){
        if(typeof v.state!=='string'||!/^\/(?:[^/~]|~[01])+/.test(v.state))fail('A2G_E_PRESENTATION','JSON Pointer required',{jsonPointer:path+'/state'});
        const key=v.state.split('/')[1]?.replace(/~1/g,'/').replace(/~0/g,'~');
        if(!key||!states.has(key))fail('A2G_E_PRESENTATION','Unknown game state binding',{jsonPointer:path+'/state'});
    }else if(Object.hasOwn(v,'item')){
        if(v.item!==true)fail('A2G_E_PRESENTATION','item must be true',{jsonPointer:path+'/item'});
    }else if(Object.hasOwn(v,'literal')) {
        if(v.literal===undefined)fail('A2G_E_PRESENTATION','Invalid literal',{jsonPointer:path+'/literal'});
    }
}
function checkFill(fill:unknown,states:Set<string>,path:string):void{
    if(typeof fill==='string'){cssColor(fill,path);return;}
    const f=record(fill,path);hasOnly(f,['from','map','fallback'],path);
    checkBinding(f.from,states,path+'/from');
    const map=record(f.map,path+'/map');
    if(Object.keys(map).length>128)fail('A2G_E_PRESENTATION','Too many palette entries',{jsonPointer:path+'/map'});
    for(const [k,v] of Object.entries(map))cssColor(v,`${path}/map/${k}`);
    cssColor(f.fallback,path+'/fallback');
}
function checkNode(raw:unknown,states:Set<string>,path:string):void{
    const node=record(raw,path);hasOnly(node,nodeKeys,path);
    if(typeof node.id!=='string'||!/^[_a-zA-Z][_a-zA-Z0-9-]*$/.test(node.id))fail('A2G_E_PRESENTATION','Invalid node ID',{jsonPointer:path+'/id'});
    if(!['rect','circle','text'].includes(String(node.kind)))fail('A2G_E_PRESENTATION','Unsupported primitive',{jsonPointer:path+'/kind'});
    coordinate(node.at,path+'/at');
    if(node.kind==='rect'){coordinate(node.size,path+'/size');for(const n of node.size)positive(n,path+'/size');}
    if(node.kind==='circle')positive(node.radius,path+'/radius');
    if(node.kind==='text'){
        checkBinding(node.text,states,path+'/text');positive(node.fontSize,path+'/fontSize');
        if(node.omitWhen!==undefined && (!Array.isArray(node.omitWhen)||node.omitWhen.length>16||!node.omitWhen.every(x=>['string','boolean','number'].includes(typeof x)||x===null))) fail('A2G_E_PRESENTATION','Invalid omitWhen list',{jsonPointer:path+'/omitWhen'});
    } else if(node.text!==undefined||node.fontSize!==undefined||node.omitWhen!==undefined)fail('A2G_E_PRESENTATION','Text attributes require kind=text',{jsonPointer:path});
    if(node.fill===undefined)fail('A2G_E_PRESENTATION','Explicit fill required',{jsonPointer:path+'/fill'});
    checkFill(node.fill,states,path+'/fill');
}
function uniqueNodes(nodes:unknown[],states:Set<string>,path:string):void{
    const ids=new Set<string>();
    for(const [i,node] of nodes.entries()){
        checkNode(node,states,`${path}/${i}`);
        const id=(node as VisualNode).id;
        if(ids.has(id))fail('A2G_E_PRESENTATION','Duplicate visual node ID',{jsonPointer:`${path}/${i}/id`});
        ids.add(id);
    }
}
export function validatePresentation(def:GameDefinition):void {
    validateVisualStage(def);
    const scene = def.presentation.scene2d;
    if(scene===undefined)return; // 0.1 legacy HUD-only definitions remain valid.
    if(!def.requires.all.some(x=>x.id==='a2game.visual.scene2d'&&x.version==='0.1.0'))fail('A2G_E_CAP_DEPENDENCY','scene2d requires a2game.visual.scene2d@0.1.0',{jsonPointer:'/requires/all',ruleId:'presentation.scene2d-dependency',capabilityId:'a2game.visual.scene2d',expected:'0.1.0'});
    const p=record(scene,'/presentation/scene2d');
    hasOnly(p,['width','height','background','nodes','repeat','bodyLayer'],'/presentation/scene2d');
    positive(p.width,'/presentation/scene2d/width');positive(p.height,'/presentation/scene2d/height');cssColor(p.background,'/presentation/scene2d/background');
    const states=new Set(Object.keys(def.state));
    if(p.bodyLayer!==undefined){
        const layer=record(p.bodyLayer,'/presentation/scene2d/bodyLayer');hasOnly(layer,['statePath','unitsPerMeter','origin','palette','circleKinds','valuePalette','showValues','minValueFontSize','minValueBodySize','motifs'],'/presentation/scene2d/bodyLayer');
        checkBinding({state:layer.statePath},states,'/presentation/scene2d/bodyLayer/statePath');coordinate(layer.origin,'/presentation/scene2d/bodyLayer/origin');
        if(layer.unitsPerMeter!==1000)fail('A2G_E_PRESENTATION','bodyLayer requires declared integer units');
        const palette=record(layer.palette,'/presentation/scene2d/bodyLayer/palette');for(const kind of ['actor','solid','target','projectile','pickup'])cssColor(palette[kind],'/presentation/scene2d/bodyLayer/palette/'+kind);
        if(!def.requires.all.some(ref=>['a2game.realtime.world','a2game.combat.bubble-grid','a2game.strategy.tower-defense'].includes(ref.id)))fail('A2G_E_CAP_DEPENDENCY','bodyLayer requires a trusted body producer');
        if(layer.circleKinds!==undefined){if(!Array.isArray(layer.circleKinds)||layer.circleKinds.length>5||layer.circleKinds.some(kind=>!['actor','solid','target','projectile','pickup'].includes(String(kind))))fail('A2G_E_PRESENTATION','Invalid circle styles');if(!def.requires.all.some(ref=>ref.id==='a2game.visual.body-style'))fail('A2G_E_CAP_DEPENDENCY','Circle body styles require visual.body-style',{jsonPointer:'/requires/all',ruleId:'presentation.body-style-dependency',capabilityId:'a2game.visual.body-style',expected:'0.1.0'});}
        if(layer.valuePalette!==undefined||layer.showValues!==undefined){if(!def.requires.all.some(ref=>ref.id==='a2game.visual.body-style'))fail('A2G_E_CAP_DEPENDENCY','Value styles require visual.body-style',{jsonPointer:'/requires/all',ruleId:'presentation.body-style-dependency',capabilityId:'a2game.visual.body-style',expected:'0.1.0'});if(layer.showValues!==undefined&&typeof layer.showValues!=='boolean')fail('A2G_E_PRESENTATION','Invalid value label flag');if(layer.valuePalette!==undefined){const palette=record(layer.valuePalette,'/presentation/scene2d/bodyLayer/valuePalette');if(Object.keys(palette).length>128)fail('A2G_E_BUDGET_EXCEEDED','Value palette budget');for(const value of Object.values(palette))cssColor(value,'/presentation/scene2d/bodyLayer/valuePalette');}}
        for(const key of ['minValueFontSize','minValueBodySize'])if(layer[key]!==undefined){const value=layer[key];if(!safeFinite(value)||value<=0||value>2)fail('A2G_E_PRESENTATION','Value style minimum must be greater than zero and at most two',{jsonPointer:'/presentation/scene2d/bodyLayer/'+key});if(layer.showValues!==true)fail('A2G_E_PRESENTATION','Value style minimum requires showValues=true',{jsonPointer:'/presentation/scene2d/bodyLayer/'+key});}
        if(layer.motifs!==undefined){
            if(!def.requires.all.some(ref=>ref.id==='a2game.visual.body-motif'&&ref.version==='0.1.0'))fail('A2G_E_CAP_DEPENDENCY','Body motifs require visual.body-motif@0.1.0',{jsonPointer:'/requires/all',ruleId:'presentation.body-motif-dependency',capabilityId:'a2game.visual.body-motif',expected:'0.1.0'});
            const path='/presentation/scene2d/bodyLayer/motifs',motifs=record(layer.motifs,path);
            hasOnly(motifs,['actor','solid','target','projectile','pickup'],path);
            for(const [kind,templates] of Object.entries(motifs)){
                const pth=path+'/'+kind;
                if(!Array.isArray(templates)||templates.length<1||templates.length>8)fail('A2G_E_PRESENTATION','Body motif requires 1 to 8 nodes',{jsonPointer:pth});
                uniqueNodes(templates,states,pth);
                for(const [i,raw] of templates.entries()){
                    const n=raw as VisualNode,where=pth+'/'+i;
                    if(n.at.some(v=>Math.abs(v)>2)||n.size!==undefined&&(!Array.isArray(n.size)||n.size.length!==2||n.size.some(v=>!safeFinite(v)||v<=0||v>4))||n.radius!==undefined&&(!safeFinite(n.radius)||n.radius<=0||n.radius>2)||n.fontSize!==undefined&&(!safeFinite(n.fontSize)||n.fontSize<=0||n.fontSize>4))fail('A2G_E_PRESENTATION','Body motif geometry exceeds normalized bounds',{jsonPointer:where});
                }
            }
        }
    }
    if(!Array.isArray(p.nodes)||p.nodes.length>128)fail('A2G_E_PRESENTATION','Invalid nodes',{jsonPointer:'/presentation/scene2d/nodes'});
    uniqueNodes(p.nodes,states,'/presentation/scene2d/nodes');
    const repeats=p.repeat??[];
    if(!Array.isArray(repeats)||repeats.length>16)fail('A2G_E_PRESENTATION','Invalid repeat blocks',{jsonPointer:'/presentation/scene2d/repeat'});
    const ids=new Set((p.nodes as VisualNode[]).map(x=>x.id));
    for(const [i,repeat] of repeats.entries()){
        const path=`/presentation/scene2d/repeat/${i}`,r=record(repeat,path);
        hasOnly(r,['id','source','columns','origin','step','indexMode','template','positions','omitItems'],path);
        if(typeof r.id!=='string'||!/^[_a-zA-Z][_a-zA-Z0-9-]*$/.test(r.id)||ids.has(r.id))fail('A2G_E_PRESENTATION','Duplicate/invalid repeat ID',{jsonPointer:path+'/id'});
        ids.add(r.id);
        if(!safeInteger(r.columns)||r.columns<1||r.columns>64)fail('A2G_E_PRESENTATION','Invalid column count',{jsonPointer:path+'/columns'});
        if(!['array','cell'].includes(String(r.indexMode)))fail('A2G_E_PRESENTATION','Invalid indexMode',{jsonPointer:path+'/indexMode'});
        checkBinding(r.source,states,path+'/source');coordinate(r.origin,path+'/origin');coordinate(r.step,path+'/step');
        if(r.step.some(x=>x<=0))fail('A2G_E_PRESENTATION','Grid step must be positive',{jsonPointer:path+'/step'});
        if(r.positions!==undefined){
            if(r.indexMode!=='array'||!Array.isArray(r.positions)||!r.positions.length||r.positions.length>256)fail('A2G_E_PRESENTATION','Invalid explicit repeat positions',{jsonPointer:path+'/positions'});
            for(const [j,pos] of r.positions.entries())coordinate(pos,path+'/positions/'+j);
        }
        if(r.omitItems!==undefined&&(!Array.isArray(r.omitItems)||r.omitItems.length>16||!r.omitItems.every(safeInteger)))fail('A2G_E_PRESENTATION','Invalid repeat omissions',{jsonPointer:path+'/omitItems'});
        if(!Array.isArray(r.template)||r.template.length<1||r.template.length>8)fail('A2G_E_PRESENTATION','Invalid repeat template',{jsonPointer:path+'/template'});
        uniqueNodes(r.template,states,path+'/template');
    }
}
function readBinding(binding:DataBinding,obs:SessionObservation,item?:Json):Json{
    if('literal' in binding)return binding.literal;
    if('item' in binding)return item??null;
    return readPointer(obs.state,binding.state) as Json;
}
function paint(fill:ColorBinding,obs:SessionObservation,item?:Json):string{
    if(typeof fill==='string')return fill;
    const value=readBinding(fill.from,obs,item);
    const key=(value===null||typeof value==='object')?'':String(value);
    return Object.hasOwn(fill.map,key) ? fill.map[key]! : fill.fallback;
}
function textValue(value:Json):string {
    if(value===null)return '';
    if(['number','boolean','string'].includes(typeof value))return String(value);
    fail('A2G_E_PRESENTATION','Text binding must resolve to scalar');
}
function requireScene2D(def:GameDefinition):Scene2DSpec{
    const layout = def.presentation.scene2d as unknown as Scene2DSpec|undefined;
    if(!layout)fail('A2G_E_PRESENTATION','No scene2d defined');
    return layout;
}
export function projectRenderSetup(def:GameDefinition):RenderSetup{
    const {width,height,background}=requireScene2D(def);
    const stage=def.presentation.stage as unknown as VisualStageSpec|undefined;
    return {
        width,height,background,
        ...(stage?{stage:{projection:stage.camera.projection,audio:(stage.audio??[]).map(({id,asset,volume})=>({id,asset,volume}))}}:{})
    };
}
export function projectPresentation(def:GameDefinition,obs:SessionObservation):PresentationFrame{
    const layout=requireScene2D(def);
    const commands:DrawCommand[]=[];
    const emit=(node:VisualNode,id:string,origin:[number,number],item?:Json):void=>{
        if(commands.length>=maxNodes)fail('A2G_E_BUDGET_EXCEEDED','Presentation primitive budget exceeded');
        const at:[number,number]=[origin[0]+node.at[0],origin[1]+node.at[1]];
        const fill=paint(node.fill!,obs,item);
        if(node.kind==='rect')commands.push({id,kind:'rect',at,size:node.size!,fill});
        else if(node.kind==='circle')commands.push({id,kind:'circle',at,radius:node.radius!,fill});
        else {
            const value=readBinding(node.text!,obs,item);
            if(node.omitWhen?.some(x=>x===value))return;
            commands.push({id,kind:'text',at,text:textValue(value),fontSize:node.fontSize!,fill});
        }
    };
    for(const node of layout.nodes)emit(node,node.id,[0,0]);
    for(const repeat of layout.repeat??[]){
        const source=readBinding(repeat.source,obs);
        const items=Array.isArray(source)?source:[source];
        if(items.length>256)fail('A2G_E_BUDGET_EXCEEDED','Too many repeat items');
        if(repeat.positions&&items.length!==repeat.positions.length)fail('A2G_E_PRESENTATION','Repeat source does not match explicit positions');
        for(const [i,item] of items.entries()){
            if(typeof item==='number'&&repeat.omitItems?.includes(item))continue;
            const cell=repeat.indexMode==='cell'?item:i;
            if(!safeInteger(cell)||cell<0||cell>4095)fail('A2G_E_PRESENTATION','Repeat cell index invalid');
            const pos=repeat.positions?.[i]??[repeat.origin[0]+(cell%repeat.columns)*repeat.step[0],repeat.origin[1]-Math.floor(cell/repeat.columns)*repeat.step[1]] as [number,number];
            for(const template of repeat.template)emit(template,`${repeat.id}[${i}].${template.id}`,pos,item);
        }
    }
    if(layout.bodyLayer){
        const layer=layout.bodyLayer,bodies=readPointer(obs.state,layer.statePath);
        const bodyLimit=def.requires.all.some(ref=>ref.id==='a2game.combat.bubble-grid')?256:128;
        if(!Array.isArray(bodies)||bodies.length>bodyLimit)fail('A2G_E_PRESENTATION','Invalid body projection');
        for(const raw of bodies){
            const b=raw as unknown as WorldBody;
            if(![b.x,b.y,b.hx,b.hy].every(safeFinite)||Math.abs(b.x)>32000||Math.abs(b.y)>32000||b.hx<=0||b.hy<=0||b.hx>2000||b.hy>2000||!Object.hasOwn(layer.palette,b.kind))fail('A2G_E_PRESENTATION','Invalid body primitive');
            if(commands.length>=maxNodes)fail('A2G_E_BUDGET_EXCEEDED','Body projection budget exceeded');
            const at:[number,number]=[layer.origin[0]+b.x/1000,layer.origin[1]+b.y/1000];
            const fill=layer.valuePalette?.[String(b.value)]??layer.palette[b.kind];
            const minSize=b.value>0?(layer.minValueBodySize??0):0;
            const motif=layer.motifs?.[b.kind];
            if(motif){
                const sx=b.hx/1000,sy=b.hy/1000,unit=Math.min(sx,sy);
                for(const node of motif){
                    const scaled:VisualNode={...node,at:[node.at[0]*sx,node.at[1]*sy],...(node.size?{size:[node.size[0]*sx,node.size[1]*sy]}:{}),...(node.radius!==undefined?{radius:node.radius*unit}:{}),...(node.fontSize!==undefined?{fontSize:node.fontSize*unit}:{})};
                    emit(scaled,'body:'+b.id+'.'+node.id,at,b.value);
                }
            }else if(layer.circleKinds?.includes(b.kind))commands.push({id:'body:'+b.id,kind:'circle',at,radius:Math.max(Math.min(b.hx,b.hy)/1000,minSize/2),fill});else commands.push({id:'body:'+b.id,kind:'rect',at,size:[Math.max(b.hx*2/1000,minSize),Math.max(b.hy*2/1000,minSize)],fill});
            if(layer.showValues&&b.value>0){if(commands.length>=maxNodes)fail('A2G_E_BUDGET_EXCEEDED','Body label budget');commands.push({id:'body-label:'+b.id,kind:'text',at,text:String(b.value),fontSize:Math.max(Math.min(b.hy/1000,0.4),layer.minValueFontSize??0),fill:'#ffffff'});}
        }
    }
    const stage=projectVisualStage(def,obs);
    return {width:layout.width,height:layout.height,background:layout.background,commands,...(stage?{stage}:{})};
}
