import { STARTING_MINE_DENSITY } from './config.js';
import type { Player } from './Player.js';
import type { SyntheticPlayerId } from './PlayerStore.js';
import type { PackedCellCoord } from './util/coords.js';

/**
 * Return the target number of mines to be generated
 * in a chunk given the player that created it.
 *
 * Currently static; future: increase density as
 * player score increases?
 */
export const getDifficulty = (player: Player): number => {
    return STARTING_MINE_DENSITY;
};

let IS_DEBUG_MODE = process.env.DEBUG === 'true';
export const isDebug = () => IS_DEBUG_MODE;
export const setDebug = (value: boolean) => (IS_DEBUG_MODE = value);

export type TraceCallback = (
    packed: PackedCellCoord,
    playerId: SyntheticPlayerId,
) => void;
const noop = () => {};

let trace: TraceCallback = noop;
export const ifTrace = (
    packed: PackedCellCoord,
    playerId: SyntheticPlayerId,
) => {
    if (trace === noop) return;
    trace(packed, playerId);
};

export const setTrace = (cb: TraceCallback) => {
    trace = cb;
};

export const clearTrace = () => {
    trace = noop;
};
