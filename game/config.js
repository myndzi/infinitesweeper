// @ts-check

/** @typedef {import('./Player')} Player */

const STARTING_MINE_DENSITY = 12;

/**
 * Return the target number of mines to be generated
 * in a chunk given the player that created it.
 *
 * Currently static; future: increase density as
 * player score increases?
 *
 * @param {Player} player
 * @returns {number}
 */
const getDifficulty = player => {
    return STARTING_MINE_DENSITY;
};

let IS_DEBUG_MODE = process.env.DEBUG === 'true';
const isDebug = () => IS_DEBUG_MODE;
/** @param {boolean} value */
const setDebug = value => (IS_DEBUG_MODE = value);

const noop = () => {};
let IS_TRACE = false;

/** @type {(packed: bigint, playerId: number) => void} */
let trace = noop;

/**
 * @param {bigint} packed
 * @param {number} playerId
 */
const ifTrace = (packed, playerId) => {
    if (!IS_TRACE) return;
    trace(packed, playerId);
};

/** @param {(packed: bigint, playerId: number) => void} cb */
const setTrace = cb => {
    IS_TRACE = true;
    trace = cb;
};

const clearTrace = () => {
    IS_TRACE = false;
    trace = noop;
};

module.exports = {
    getDifficulty,
    isDebug,
    setDebug,
    ifTrace,
    setTrace,
    clearTrace,
};
