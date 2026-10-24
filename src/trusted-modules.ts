import {gridPushImplementation} from './modules/grid-push.js';
import {gridSlideMergeImplementation} from './modules/grid-slide-merge.js';
import {puzzleImplementations,puzzleServiceIds} from './modules/puzzle.js';
import {realtimeWorldImplementation,realtimeServiceIds} from './modules/realtime.js';
import {inputControlImplementation,controlServiceIds} from './modules/input-control.js';
import {strategyImplementations,strategyServiceIds} from './modules/strategy.js';
import {bubbleGridImplementation} from './modules/bubble-grid.js';
import {bootstrapImplementation} from './modules/bootstrap.js';
import type {TrustedCapabilityImplementation} from './types.js';
/** Application-owned binding, shared by Node and browser. JSON cannot register code. */
export const trustedModules:Readonly<Record<string,TrustedCapabilityImplementation>>={
 'a2game.puzzle.grid-push':gridPushImplementation,'a2game.puzzle.grid-slide-merge':gridSlideMergeImplementation,
 ...puzzleImplementations,...strategyImplementations,'a2game.realtime.world':realtimeWorldImplementation,
 'a2game.realtime.input-control':inputControlImplementation,'a2game.combat.bubble-grid':bubbleGridImplementation,
 'a2game.core.bootstrap':bootstrapImplementation,
};
export const trustedServiceIds=[...puzzleServiceIds,...realtimeServiceIds,...strategyServiceIds,...controlServiceIds,'a2game.core.clock'];
