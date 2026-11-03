/** Advisory caller observations only: no browser attestation or artifact mutation. */
import {z} from 'zod';
const positive=z.number().finite().positive().max(1e7),coordinate=z.number().finite().min(-1e7).max(1e7);
const size=z.object({width:positive,height:positive}).strict();
export const textReadabilityObservationSchema=z.object({
 previewId:z.string().uuid(),gameSha256:z.string().regex(/^[0-9a-f]{64}$/),
 backend:z.enum(['air','three']),viewport:size,
 status:z.enum(['DIAGNOSTIC_ONLY','UNAVAILABLE']),referenceCssPx:positive,
 measuredCanvasRect:z.object({left:coordinate,top:coordinate,width:positive,height:positive}).strict().nullable(),
 scene:size.nullable(),
 texts:z.array(z.object({fontScene:positive,nominalTextCssPx:positive}).strict()).max(256)
}).strict().superRefine((value,ctx)=>{
 if(value.status==='DIAGNOSTIC_ONLY'&&(!value.measuredCanvasRect||!value.scene))ctx.addIssue({code:'custom',message:'Measured geometry is required.'});
 if(value.status==='UNAVAILABLE'&&value.texts.length)ctx.addIssue({code:'custom',message:'Unavailable measurements cannot contain text sizes.'});
});
export function inspectTextReadability(input,{artifactId,gameSha256,preview}){
 const observation=textReadabilityObservationSchema.parse(input);
 if(!preview||preview.closing||preview.artifactId!==artifactId||preview.backend!==observation.backend||observation.gameSha256!==gameSha256)throw Object.assign(Error('Readability observation does not match an active artifact preview.'),{code:'A2G_MCP_READABILITY_BINDING'});
 const warnings=observation.status==='UNAVAILABLE'?[{code:'MEASUREMENT_UNAVAILABLE',repairHint:'Open the active preview and remeasure visible canvas geometry after the viewport settles.'}]:observation.texts.flatMap((text,textIndex)=>text.nominalTextCssPx<observation.referenceCssPx?[{code:'SMALL_TEXT',textIndex,nominalTextCssPx:text.nominalTextCssPx,referenceCssPx:observation.referenceCssPx,repairHint:'Review this text visually at the reported viewport. If needed, have the author revise scene layout or font sizing, validate a new artifact and remeasure its new preview. Do not automatically change game JSON or weaken gameplay checks.'}]:[]);
 return {status:observation.status,provenance:'HOST_REPORTED_UNVERIFIED',binding:{artifactId,previewId:observation.previewId,gameSha256,backend:observation.backend},viewport:observation.viewport,measuredCanvasRect:observation.measuredCanvasRect,scene:observation.scene,referenceCssPx:observation.referenceCssPx,textCount:observation.texts.length,warnings,visualAcceptance:'NOT_RUN',limitations:['Caller-reported numeric observations; binding does not attest browser execution, freshness or measurement accuracy.','Nominal CSS font size only, not glyph bounds, occlusion, legibility or aesthetics.','The configurable reference is advisory; no warnings does not imply visual PASS. Text indices follow getTextReadability().texts order.']};
}
