// @ts-check

/** @typedef {import('../Chunk').Chunk} Chunk */

const { isDebug } = require('../config');
const { CHUNK_EDGE_SIZE, BITPOS_SHIFT } = require('../util/constants');
const {
    pack: { bitpos: packBitpos },
} = require('../util/coords');

const MINE_COUNT_MASK = 0b000000001111; // prettier-ignore
const EDGE_NORTH      = 0b000000010000; // prettier-ignore
const EDGE_SOUTH      = 0b000000100000; // prettier-ignore
const EDGE_EAST       = 0b000001000000; // prettier-ignore
const EDGE_WEST       = 0b000010000000; // prettier-ignore
const FLAGGED         = 0b000100000000; // prettier-ignore
const OWNABLE         = 0b001000000000; // prettier-ignore
const REVEALED        = 0b010000000000; // prettier-ignore
const MINED           = 0b100000000000; // prettier-ignore
const OWNERID_SHIFT   = Math.log(MINED) / Math.LN2 + 1; // prettier-ignore
const EDGE_MASK = EDGE_NORTH | EDGE_SOUTH | EDGE_EAST | EDGE_WEST;

/**
 * @typedef {Object} UnrevealedCell
 * @property {false} isRevealed
 * @property {boolean} isMine
 * @property {boolean} isFlagged
 * @property {boolean} isOwnable
 */

/**
 * @typedef {Object} RevealedCell
 * @property {true} isRevealed
 * @property {boolean} isMine
 * @property {number} mineCount
 * @property {number} ownerId
 * @property {boolean} hasNorth
 * @property {boolean} hasSouth
 * @property {boolean} hasEast
 * @property {boolean} hasWest
 */

/** @typedef {UnrevealedCell|RevealedCell} CellStateProps */

/**
 * Helper class to encapsulate more bit-packing work in the
 * render pipeline.
 *
 * The IntermediateRenderer keeps a singleton copy of this
 * class and uses it to temporarily hold all the properties
 * of a cell being rendered.
 *
 * This allows us to represent all the data as simple numbers
 * but access it like an object, avoiding a bunch of GC churn
 *
 * This class should be used only ephemerally to connect the
 * intermediate renderer with a concrete renderer; do not
 * store references to instances of CellState or mutate them
 */
class CellState {
    /**
     * @private
     * @type {boolean}
     */
    _isRevealed = false;

    /**
     * @private
     * @type {boolean}
     */
    _isFlagged = false;

    /**
     * @private
     * @type {boolean}
     */
    _isOwnable = false;

    /**
     * @private
     * @type {number}
     */
    _ownerId = 0;

    /**
     * @private
     * @type {boolean}
     */
    _isMine = false;

    /**
     * @private
     * @type {number}
     */
    _mineCount = 0;

    /**
     * @private
     * @type {number}
     */
    _edges = 0;

    get isRevealed() {
        return this._isRevealed;
    }

    get isMine() {
        return this._isMine;
    }

    get mineCount() {
        return this._mineCount;
    }

    get isFlagged() {
        return this._isFlagged;
    }

    get isOwnable() {
        return this._isOwnable;
    }

    get ownerId() {
        return this._ownerId;
    }

    get hasNorth() {
        return (this._edges & EDGE_NORTH) !== 0;
    }

    get hasSouth() {
        return (this._edges & EDGE_SOUTH) !== 0;
    }
    get hasEast() {
        return (this._edges & EDGE_EAST) !== 0;
    }
    get hasWest() {
        return (this._edges & EDGE_WEST) !== 0;
    }

    /**
     * Update all properties from a cell state code
     *
     * @param {number} code
     */
    updateFromCode(code) {
        if ((code & REVEALED) !== 0) {
            this._isRevealed = true;
            this._isMine = (code & MINED) !== 0;
            this._mineCount = code & MINE_COUNT_MASK;
            this._edges = code & EDGE_MASK;
            this._isFlagged = false;
            this._isOwnable = false;
            this._ownerId = code >>> OWNERID_SHIFT;
        } else {
            this._isRevealed = false;
            this._isMine = false;
            this._mineCount = 0;
            if (isDebug()) {
                this._isMine = (code & MINED) !== 0;
            }

            this._edges = 0;
            this._isFlagged = (code & FLAGGED) !== 0;
            this._isOwnable = (code & OWNABLE) !== 0;
            this._ownerId = 0;
        }
    }
}

/**
 * Calls the callback once with each neighbor of the input (x, y) coordinate
 *
 * @param {number} x
 * @param {number} y
 * @param {Uint32Array} cells
 * @param {(x: number, y: number, cells: Uint32Array, arg: number) => void} fn
 * @param {number} arg
 */
const xy_neighbors = (x, y, cells, fn, arg) => {
    fn(x - 1, y - 1, cells, arg);
    fn(x, y - 1, cells, arg);
    fn(x + 1, y - 1, cells, arg);

    fn(x - 1, y, cells, arg);
    fn(x + 1, y, cells, arg);

    fn(x - 1, y + 1, cells, arg);
    fn(x, y + 1, cells, arg);
    fn(x + 1, y + 1, cells, arg);
};

/**
 * Sets the value at the given position the (x, y) position in the
 * `cells` array, only if (x, y) is within bounds
 *
 * @param {number} x
 * @param {number} y
 * @param {Uint32Array} cells
 * @param {number} arg
 */
const set_if_inbounds = (x, y, cells, arg) => {
    if (x < 0 || x >= CHUNK_EDGE_SIZE || y < 0 || y >= CHUNK_EDGE_SIZE) {
        return;
    }

    // we're using the same math as bit-packing, but for array indexing
    cells[packBitpos(x, y)] |= arg;
};

/**
 * Increments the value at the given position the (x, y) position
 * in the `cells` array, only if (x, y) is within bounds
 *
 * @param {number} x
 * @param {number} y
 * @param {Uint32Array} cells
 */
const inc_if_inbounds = (x, y, cells) => {
    if (x < 0 || x >= CHUNK_EDGE_SIZE || y < 0 || y >= CHUNK_EDGE_SIZE) {
        return;
    }
    // we're using the same math as bit-packing, but for array indexing
    cells[packBitpos(x, y)]++;
};

/**
 * Update the RenderedChunk's internal state according to a single
 * source cell. The source cell may live in the chunk being represented
 * by this RenderedChunk instance, or a neighboring chunk.
 *
 * @param {Uint32Array} cells The buffer to render cell data to
 * @param {number} forPlayerId The player to calculate "ownability" and edge data against
 * @param {number} rx Relative x-offset to the RenderedChunk's own chunk origin (top-left)
 * @param {number} ry Relative y-offset to the RenderedChunk's own chunk origin (top-left)
 * @param {Chunk|undefined} source The Chunk that holds the data for the cell being referenced by the relative offsets
 * @param {number} pos The bitpos in the chunk that holds the data for the cell being referenced by the relative offset
 */
const setCellState = (cells, forPlayerId, rx, ry, source, pos) => {
    if (source === undefined) return;

    const isFlagged = source.isFlagged(pos);
    if (isFlagged) {
        set_if_inbounds(rx, ry, cells, FLAGGED);
    }

    const isRevealed = source.isRevealed(pos);
    if (isRevealed) {
        set_if_inbounds(rx, ry, cells, REVEALED);
    }

    const isMine = source.isMine(pos);
    if (isMine) {
        xy_neighbors(rx, ry, cells, inc_if_inbounds, 1);

        if (isRevealed || isDebug()) {
            set_if_inbounds(rx, ry, cells, MINED);
        }
    }

    const ownerId = source.ownerid(pos);
    if (ownerId !== undefined) {
        set_if_inbounds(rx, ry, cells, ownerId << OWNERID_SHIFT);
    }

    if (ownerId === forPlayerId && isRevealed) {
        xy_neighbors(rx, ry, cells, set_if_inbounds, OWNABLE);
    }

    // TODO: add owner edge data
};

module.exports = { CellState, setCellState };
