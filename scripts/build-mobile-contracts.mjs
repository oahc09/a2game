import {writeFileSync} from 'node:fs';
const n=(minimum,maximum)=>({type:'number',minimum,maximum}),i=(minimum,maximum)=>({type:'integer',minimum,maximum});
const object=properties=>({type:'object',properties,additionalProperties:false});
const contracts={
 'touch.raw':{},'touch.double-tap':{maxGapTicks:i(1,120),maxDistanceNorm:n(0,1)},
 'touch.long-press':{minTicks:i(1,600),maxDistanceNorm:n(0,1)},
 'touch.drag':{minDistanceNorm:n(0,1)},'touch.path':{minDistanceNorm:n(0,1)},
 'touch.pinch':{minDistanceNorm:n(0.001,1)},'touch.rotate':{minDistanceNorm:n(0.001,1)},
 'touch.multi-hold':{fingers:i(2,10),minTicks:i(1,600),maxDistanceNorm:n(0,1)},
 'imu.tilt':{rangeRad:n(0.01,3.1416),deadZone:n(0,0.9),smoothingPercent:i(1,100)},
 'imu.shake':{thresholdMps2:n(0.1,100),cooldownTicks:i(1,600)},
 'imu.orientation':{},'imu.acceleration':{},'imu.gyroscope':{},'imu.calibration':{}
};
for(const [short,properties] of Object.entries(contracts)){
 const id='a2game.input.'+short;
 const m={format:'a2game-capability',manifestVersion:'0.1.0',id,version:'0.1.0',kind:'recognizer',portability:'exact',description:`Bounded shared ${short} recognition over normalized samples, mobile-input-v1. Actual hardware availability/permission is a separate Host/device receipt.`,phase:'recognize',dependencies:short.startsWith('imu.')&&short!=='imu.calibration'?[{id:'a2game.input.imu.calibration',version:'0.1.0'}]:[],contract:{configSchema:object(properties),stateSchema:{type:'object'},commands:[],events:[{name:'input.action',payloadSchema:{type:'object'}}],stateWrites:[],lifecycle:['initialize','tick','pause','resume','reset','dispose']},limits:{profile:'mobile-input-v1',maxPointers:10,maxPathPoints:128,maxTraceSamples:4096,quantization:0.0001,calibration:'explicit normalized calibrate sample; reset on pause/orientation change',privacy:'opt-in recording; no automatic persistence or telemetry'},testSuites:['MOBILE-INPUT-001']};
 writeFileSync(`specs/v0.1/capabilities/${id}.capability.json`,JSON.stringify(m,null,2)+'\n');
}
console.log('Wrote fourteen bounded mobile input contracts.');
