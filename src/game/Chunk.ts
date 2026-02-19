import type { SyntheticPlayerId } from './PlayerStore.js';
import type { PackedBitfieldCoord } from './util/coords.js';

import {
    bitfield,
    bitIsSet,
    setBit,
    bulkUnset,
    clearBit,
    type Bitfield,
} from './util/bitfield.js';

export class Chunk {
    readonly seed: unknown;

    // TODO: future optimization: could use a larger backing store
    // for the buffers and reuse slices of it
    protected mines: Bitfield;
    protected flags: Bitfield = bitfield();
    protected revealed: Bitfield = bitfield();

    // TODO: is there ever a case where we care about what cells
    // are revealed without caring about who owns them?
    // perhaps we should just ditch `revealed`?

    protected owned: Map<SyntheticPlayerId, Bitfield> = new Map();
    protected generation: number = 0;

    constructor(mines: Bitfield, seed: unknown = 0) {
        this.mines = mines;
        this.seed = seed;
    }

    /**
     * Return true if the cell at `bitpos` is a mine
     */
    isMine(bitpos: PackedBitfieldCoord): boolean {
        return bitIsSet(this.mines, bitpos);
    }

    /**
     * Debug/testing : set a mine at `bitpos`
     */
    __setMine(bitpos: PackedBitfieldCoord): void {
        setBit(this.mines, bitpos);
    }

    /**
     * Return true if the cell at `bitpos` is revealed
     */
    isRevealed(bitpos: PackedBitfieldCoord): boolean {
        return bitIsSet(this.revealed, bitpos);
    }

    /**
     * Return true if the cell at `bitpos` is flagged
     */
    isFlagged(bitpos: PackedBitfieldCoord): boolean {
        return bitIsSet(this.flags, bitpos);
    }

    /**
     * Mark the cell at `bitpos` as flagged
     */
    flag(bitpos: PackedBitfieldCoord) {
        setBit(this.flags, bitpos);
        this.generation++;
    }

    /**
     * Mark the cell at `bitpos` as unflagged
     */
    unflag(bitpos: PackedBitfieldCoord) {
        clearBit(this.flags, bitpos);
        this.generation++;
    }

    /**
     * "reveal" a single cell in the chunk and mark it as
     * owned by the given player
     *
     * Return true if the revealed cell was a mine and the
     * player should be killed
     */
    reveal(bitpos: PackedBitfieldCoord, playerId: SyntheticPlayerId): boolean {
        // this method just updates the state, but does not perform
        // the recursive revealing logic. future optimization: incorporate
        // a more efficient "reveal" algorithm at this level

        const dead = bitIsSet(this.mines, bitpos);

        setBit(this.revealed, bitpos);

        let owned = this.owned.get(playerId);
        if (owned === undefined) {
            owned = bitfield();
            this.owned.set(playerId, owned);
        }
        setBit(owned, bitpos);

        this.generation++;

        return dead;
    }

    /**
     * "unreveal" all cells owned by playerId, and remove
     * the player from the ownership list.
     *
     * Return true if the chunk should be destroyed entirely
     * (== no remaining players own cells in this chunk)
     */
    kill(playerId: SyntheticPlayerId): boolean {
        // ... do we just keep the same mine layout when a player dies?
        // i think so, chunks are currently pretty small. plus, what would
        // you do to the other active player(s) in the chunk?
        //
        // it'd be technically possible to rearrange the unrevealed mines
        // but that'd be jank and complicated

        const owned = this.owned.get(playerId);
        if (owned === undefined) return false;

        bulkUnset(this.revealed, owned);
        this.owned.delete(playerId);

        this.generation++;

        return this.owned.size === 0;
    }

    /**
     * If the cell at `bitpos` is owned, return the player id; else, undefined
     */
    ownerid(bitpos: PackedBitfieldCoord): SyntheticPlayerId | undefined {
        if (!bitIsSet(this.revealed, bitpos)) return undefined;

        for (const [ownerid, bits] of this.owned.entries()) {
            if (bitIsSet(bits, bitpos)) return ownerid;
        }
        return undefined;
    }

    /**
     * Return true if this chunk has changed since the passed-in value
     *
     * @param {number} generation
     * @returns {boolean}
     */
    isNewerThan(generation: number): boolean {
        return this.generation > generation;
    }
}

export const EMPTY_CHUNK = new Chunk(bitfield());
