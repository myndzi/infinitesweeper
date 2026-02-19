import type { Chunk } from '../Chunk.js';
import { isDebug } from '../debug.js';
import { type SyntheticPlayerId, UNDEFINED_PLAYER_ID } from '../PlayerStore.js';
import type { Branded } from '../util/branded.js';
import { CHUNK_EDGE_SIZE } from '../util/constants.js';
import { type PackedBitfieldCoord, pack } from '../util/coords.js';

// avoid dereferencing the property in hot code loops
const packBitpos = pack.bitpos;

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

type UnrevealedCell = {
    isRevealed: false;
    isMine: boolean;
    isFlagged: boolean;
    isOwnable: boolean;
};
type RevealedCell = {
    isRevealed: true;
    isMine: boolean;
    mineCount: number;
    ownerId: number;
    hasNorth: boolean;
    hasSouth: boolean;
    hasEast: boolean;
    hasWest: boolean;
};

export type CellStateProps = UnrevealedCell | RevealedCell;
export type CellStateArray = Branded<Uint32Array, 'CellStateArray'>;
export type CellStateCode = Branded<number, 'CellStateCode'>;

type CellEdges = Branded<number, 'CellEdges'>;

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
export class CellState {
    private _isRevealed: boolean = false;
    private _isFlagged: boolean = false;
    private _isOwnable: boolean = false;
    private _ownerId: SyntheticPlayerId = UNDEFINED_PLAYER_ID;
    private _isMine: boolean = false;
    private _mineCount: number = 0;
    private _edges: CellEdges = 0 as CellEdges;

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
     */
    updateFromCode(code: CellStateCode): void {
        if ((code & REVEALED) !== 0) {
            this._isRevealed = true;
            this._isMine = (code & MINED) !== 0;
            this._mineCount = code & MINE_COUNT_MASK;
            this._edges = (code & EDGE_MASK) as CellEdges;
            this._isFlagged = false;
            this._isOwnable = false;
            this._ownerId = (code >>> OWNERID_SHIFT) as SyntheticPlayerId;
        } else {
            this._isRevealed = false;
            this._isMine = false;
            this._mineCount = 0;
            if (isDebug()) {
                this._isMine = (code & MINED) !== 0;
            }

            this._edges = 0 as CellEdges;
            this._isFlagged = (code & FLAGGED) !== 0;
            this._isOwnable = (code & OWNABLE) !== 0;
            this._ownerId = UNDEFINED_PLAYER_ID;
        }
    }
}

type EachCallback = (
    x: number,
    y: number,
    cells: CellStateArray,
    arg: number,
) => void;

/**
 * Calls the callback once with each neighbor of the input (x, y) coordinate
 */
const eachNeighbor = (
    x: number,
    y: number,
    cells: CellStateArray,
    fn: EachCallback,
    arg: number,
): void => {
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
 * Calls the callback once with each cardinal neighbor of the input (x, y)
 * coordinate (north, south, east, west)
 */
const eachCardinal = (
    x: number,
    y: number,
    cells: CellStateArray,
    fn: EachCallback,
    arg: number,
) => {
    fn(x, y - 1, cells, arg);
    fn(x - 1, y, cells, arg);
    fn(x + 1, y, cells, arg);
    fn(x, y + 1, cells, arg);
};

/**
 * Sets the value at the given position the (x, y) position in the
 * `cells` array, only if (x, y) is within bounds
 */
const setIfInbounds = (
    x: number,
    y: number,
    cells: CellStateArray,
    arg: number,
) => {
    if (x < 0 || x >= CHUNK_EDGE_SIZE || y < 0 || y >= CHUNK_EDGE_SIZE) {
        return;
    }

    // we're using the same math as bit-packing, but for array indexing
    cells[packBitpos(x, y)]! |= arg;
};

/**
 * Increments the value at the given position the (x, y) position
 * in the `cells` array, only if (x, y) is within bounds
 */
const incIfInbounds = (x: number, y: number, cells: CellStateArray) => {
    if (x < 0 || x >= CHUNK_EDGE_SIZE || y < 0 || y >= CHUNK_EDGE_SIZE) {
        return;
    }
    // we're using the same math as bit-packing, but for array indexing
    cells[packBitpos(x, y)]!++;
};

/**
 * Update the RenderedChunk's internal state according to a single
 * source cell. The source cell may live in the chunk being represented
 * by this RenderedChunk instance, or a neighboring chunk.
 */
export const setCellState = (
    cells: CellStateArray,
    forPlayerId: SyntheticPlayerId,
    rx: number,
    ry: number,
    source: Chunk | undefined,
    pos: PackedBitfieldCoord,
) => {
    if (source === undefined) return;

    const isFlagged = source.isFlagged(pos);
    if (isFlagged) {
        setIfInbounds(rx, ry, cells, FLAGGED);
    }

    const isRevealed = source.isRevealed(pos);
    if (isRevealed) {
        setIfInbounds(rx, ry, cells, REVEALED);
    }

    const isMine = source.isMine(pos);
    if (isMine) {
        eachNeighbor(rx, ry, cells, incIfInbounds, 1);

        if (isRevealed || isDebug()) {
            setIfInbounds(rx, ry, cells, MINED);
        }
    }

    const ownerId = source.ownerid(pos);
    if (ownerId !== undefined) {
        setIfInbounds(rx, ry, cells, ownerId << OWNERID_SHIFT);
    }

    if (ownerId === forPlayerId && isRevealed) {
        eachNeighbor(rx, ry, cells, setIfInbounds, OWNABLE);
    }

    // TODO: add owner edge data
};
