import {gridPushImplementation} from './modules/grid-push.js';
import {gridSlideMergeImplementation} from './modules/grid-slide-merge.js';
import {puzzleImplementations,puzzleServiceIds} from './modules/puzzle.js';
import {realtimeWorldImplementation,realtimeServiceIds} from './modules/realtime.js';
import {inputControlImplementation,controlServiceIds} from './modules/input-control.js';
import {strategyImplementations,strategyServiceIds} from './modules/strategy.js';
import {bubbleGridImplementation} from './modules/bubble-grid.js';
import {bootstrapImplementation} from './modules/bootstrap.js';
import {defenseImplementation} from './modules/tower-defense.js';
import {productionLineId,productionLineImplementation} from './modules/production-line.js';
import {gridTrailId,gridTrailImplementation} from './modules/grid-trail.js';
import {gridTacticsId,gridTacticsImplementation} from './modules/grid-tactics.js';
import {minesId,disksId,mineBoardImplementation,diskBoardImplementation} from './modules/grid-boards.js';
import {rigid3dImplementation} from './modules/rigid3d.js';
import type {TrustedCapabilityImplementation} from './types.js';
/** Application-owned binding, shared by Node and browser. JSON cannot register code. */
export const trustedModules:Readonly<Record<string,TrustedCapabilityImplementation>>={
 'a2game.puzzle.grid-push':gridPushImplementation,'a2game.puzzle.grid-slide-merge':gridSlideMergeImplementation,
 ...puzzleImplementations,...strategyImplementations,'a2game.realtime.world':realtimeWorldImplementation,
 'a2game.realtime.input-control':inputControlImplementation,'a2game.combat.bubble-grid':bubbleGridImplementation,
 'a2game.core.bootstrap':bootstrapImplementation,
 'a2game.strategy.tower-defense':defenseImplementation,
 [productionLineId]:productionLineImplementation,
 [gridTrailId]:gridTrailImplementation,
 [gridTacticsId]:gridTacticsImplementation,
 [minesId]:mineBoardImplementation,[disksId]:diskBoardImplementation,
 'a2game.physics.rigid3d':rigid3dImplementation,
};
export const trustedServiceIds=[...puzzleServiceIds,...realtimeServiceIds,...strategyServiceIds,...controlServiceIds,'a2game.core.clock'];
