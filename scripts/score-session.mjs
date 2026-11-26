import { HeadlessRuntime, readPointer, replayNormalizedInputTrace } from '../dist/index.js';
import { makeRegistry } from './registry.mjs';

/** Verify an author-supplied normal death and score using an admitted game's normalized input. */
export function verifyScoreSession(game, trace, { scorePath, expectedScore, actorId }) {
  if (typeof scorePath !== 'string' || !scorePath.startsWith('/') ||
      !Number.isSafeInteger(expectedScore) || expectedScore < 0 ||
      typeof actorId !== 'string' || !actorId) {
    throw Error('A2G_E_SCORE_SESSION: invalid expected result');
  }
  const registry = makeRegistry();
  const runtime = new HeadlessRuntime(game, registry);
  const fresh = new HeadlessRuntime(game, registry);
  try {
    const replay = replayNormalizedInputTrace(runtime, trace);
    const final = runtime.observe();
    const score = readPointer(final.state, scorePath);
    const died = final.events.some(event => event.type === 'combat.death' && event.payload.id === actorId);
    if (replay.finalStatus !== 'lost' || !died || score !== expectedScore) {
      throw Error(`A2G_E_SCORE_SESSION: expected actor death and score ${expectedScore}, observed ${replay.finalStatus}, death=${died}, score=${score}`);
    }
    fresh.start();
    runtime.restart();
    const restarted = runtime.observe();
    if (restarted.tickIndex !== 0 || restarted.exactHash !== fresh.observe().exactHash) {
      throw Error('A2G_E_SCORE_SESSION: restart differs from a fresh session');
    }
    return { status: 'PASS', ...replay, score, restartHash: restarted.exactHash };
  } finally {
    fresh.dispose();
    runtime.dispose();
  }
}
