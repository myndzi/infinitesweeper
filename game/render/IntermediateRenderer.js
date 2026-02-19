// @ts-check

/** @typedef {import('../Chunk').Chunk} Chunk */
/** @typedef {import('./CellState').CellStateProps} CellStateProps */

/**
 * Renderer interface
 *
 * @template T
 * @typedef {Object} Renderer
 * @property {(ox: number, oy: number, props: CellStateProps) => void} render Render a cell
 * @property {(ox: number, oy: number) => void} empty Render (or ignore!) an empty cell
 * @property {() => T} finish Return the rendered data
 * @property {Readonly<T>} emptyChunk
 */

const { CHUNK_EDGE_SIZE, NUM_CHUNK_BITS } = require('../util/constants');
const {
    pack: { bitpos: packBitpos },
} = require('../util/coords');
const { CellState, setCellState: set } = require('./CellState');

const ROWEND = CHUNK_EDGE_SIZE - 1;
const MAX = CHUNK_EDGE_SIZE;

/**
 * Given a chunk and its neighbors, calculate the state of the
 * cells in the target chunk.
 *
 * Synchronous and ephemeral use only: the class is written
 * to be GC-light by using mutation instead of creating and
 * destroying data.
 *
 *
 */
class IntermediateRenderer {
    /**
     * The id of the player this chunk is being rendered for.
     * Used to determine which cells are ownable/interactable
     *
     * @private
     * @type {number}
     */
    forPlayerId;

    /**
     * A TypedArray that contains one element for each bit
     * in a Chunk's bitfield. Each element contains a bit-packed
     * value that includes (almost) all the information needed to
     * render the chunk visually.
     *
     * Color information for edges between players is not kept,
     * but which edges to draw is.
     *
     * @private
     * @type {Uint32Array}
     */
    cells = new Uint32Array(NUM_CHUNK_BITS);

    /** @type {import('./CellState').CellState} */
    cellState = new CellState();

    /**
     * Construct a new IntermediateRenderer
     *
     * `playerId` is the synthetic (low-numeric) id of the player
     * being rendered; this is required to calculate which cells
     * may be owned (clicked) by a player
     *
     * @param {number} playerId
     */
    constructor(playerId) {
        this.forPlayerId = playerId;
    }

    /**
     * Given a target chunk, and the chunks surrounding it,
     * enumerate the cells (in reading order: left-to-right,
     * top-to-bottom) immediately surrounding the target chunk,
     * as well as its own contents. Update the render state of
     * each cell accordingly.
     *
     * If a chunk is 4x4, the x and y coordinates span the range
     * [0, 3]. The coordinates emitted by this method would span
     * the range [-1, 4].
     *
     * The rendered cells represent only the target chunk's
     * contents, but some of those contents are affected by
     * the immediate neighbors.
     *
     * @param {Chunk} chunk
     * @param {Chunk|undefined} nw
     * @param {Chunk|undefined} n
     * @param {Chunk|undefined} ne
     * @param {Chunk|undefined} w
     * @param {Chunk|undefined} e
     * @param {Chunk|undefined} sw
     * @param {Chunk|undefined} s
     * @param {Chunk|undefined} se
     * @returns {void}
     */
    updateFrom(chunk, nw, n, ne, w, e, sw, s, se) {
        this.cells.fill(0);
        const { cells, forPlayerId } = this;

        set(cells, forPlayerId, -1, -1, nw, packBitpos(ROWEND, ROWEND));
        for (let x = 0; x < MAX; x++) {
            set(cells, forPlayerId, x, -1, n, packBitpos(x, ROWEND));
        }
        set(cells, forPlayerId, MAX, -1, ne, packBitpos(0, ROWEND));

        for (let y = 0; y < MAX; y++) {
            set(cells, forPlayerId, -1, y, w, packBitpos(ROWEND, y));

            for (let x = 0; x < MAX; x++) {
                set(cells, forPlayerId, x, y, chunk, packBitpos(x, y));
            }

            set(cells, forPlayerId, MAX, y, e, packBitpos(0, y));
        }

        set(cells, forPlayerId, -1, MAX, sw, packBitpos(ROWEND, 0));
        for (let x = 0; x < MAX; x++) {
            set(cells, forPlayerId, x, MAX, s, packBitpos(x, 0));
        }
        set(cells, forPlayerId, MAX, MAX, se, packBitpos(0, 0));
    }

    /**
     * Call the target renderer with each coordinate and a CellState
     * instance. The CellState instance is reused: do not mutate or
     * hold a reference
     *
     * @param {Renderer<any>} renderer
     */
    update(renderer) {
        const cells = this.cells;
        const state = this.cellState;

        for (let oy = 0; oy < CHUNK_EDGE_SIZE; oy++) {
            for (let ox = 0; ox < CHUNK_EDGE_SIZE; ox++) {
                const code = cells[packBitpos(ox, oy)];

                if (code === 0) {
                    renderer.empty(ox, oy);
                    continue;
                }

                state.updateFromCode(code);
                renderer.render(ox, oy, /** @type {CellStateProps} */ (state));
            }
        }
    }
}

module.exports = { IntermediateRenderer };
