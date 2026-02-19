import type { Chunk } from '../Chunk.js';
import type {
    CellStateArray,
    CellStateCode,
    CellStateProps,
} from './CellState.js';

import type { SyntheticPlayerId } from '../PlayerStore.js';
import { CHUNK_EDGE_SIZE, NUM_CHUNK_BITS } from '../util/constants.js';
import { pack } from '../util/coords.js';
import { CellState, setCellState as set } from './CellState.js';

export interface Renderer<T> {
    /**
     * Render a cell
     * `ox` and `oy` are relative to the chunk
     */
    render(ox: number, oy: number, props: CellStateProps): void;
    /**
     * Report an empty cell
     * `ox` and `oy` are relative to the chunk
     */
    empty(ox: number, oy: number): void;
    /**
     * Return the rendered data
     */
    finish(): T;
    /**
     * A fully-empty chunk
     */
    readonly emptyChunk: T;
}

// avoid dereferencing property in hot loops
const { bitpos: packBitpos } = pack;

const ROWEND = CHUNK_EDGE_SIZE - 1;
const MAX = CHUNK_EDGE_SIZE;

/**
 * Given a chunk and its neighbors, calculate the state of the
 * cells in the target chunk.
 *
 * Synchronous and ephemeral use only: the class is written
 * to be GC-light by using mutation instead of creating and
 * destroying data.
 */
export class IntermediateRenderer {
    /**
     * The id of the player this chunk is being rendered for.
     * Used to determine which cells are ownable/interactable
     */
    protected forPlayerId: SyntheticPlayerId;

    /**
     * A TypedArray that contains one element for each bit
     * in a Chunk's bitfield. Each element contains a bit-packed
     * value that includes (almost) all the information needed to
     * render the chunk visually.
     *
     * Color information for edges between players is not kept,
     * but which edges to draw is.
     */
    protected cells: CellStateArray = new Uint32Array(
        NUM_CHUNK_BITS,
    ) as CellStateArray;

    /**
     * A CellState instance to be reused for rendering
     */
    protected cellState: CellState = new CellState();

    /**
     * Construct a new IntermediateRenderer
     *
     * `playerId` is the synthetic (low-numeric) id of the player
     * being rendered; this is required to calculate which cells
     * may be owned (clicked) by a player
     */
    constructor(playerId: SyntheticPlayerId) {
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
     */
    updateFrom(
        chunk: Chunk,
        nw: Chunk | undefined,
        n: Chunk | undefined,
        ne: Chunk | undefined,
        w: Chunk | undefined,
        e: Chunk | undefined,
        sw: Chunk | undefined,
        s: Chunk | undefined,
        se: Chunk | undefined,
    ): void {
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
     */
    update(renderer: Renderer<unknown>) {
        const cells = this.cells;
        const state = this.cellState;

        for (let oy = 0; oy < CHUNK_EDGE_SIZE; oy++) {
            for (let ox = 0; ox < CHUNK_EDGE_SIZE; ox++) {
                const code = cells[packBitpos(ox, oy)];

                if (code === 0) {
                    renderer.empty(ox, oy);
                    continue;
                }

                state.updateFromCode(code as CellStateCode);
                renderer.render(ox, oy, /** @type {CellStateProps} */ state);
            }
        }
    }
}
