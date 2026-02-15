// @ts-check

/** @typedef {import('./Player')} Player */

const STARTING_MINE_DENSITY = 10;

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

module.exports = {
    getDifficulty,
};
