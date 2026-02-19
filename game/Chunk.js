// @ts-check

/** @typedef {import('./Player')} Player */

const {
    bitfield,
    bitIsSet,
    setBit,
    bulkUnset,
    clearBit,
} = require('./util/bitfield');

class Chunk {
    /**
     * @readonly
     * @type {unknown}
     */
    seed;

    /**
     * @protected
     * @type {Uint32Array}
     */
    mines;

    // future optimization: could use a larger backing store
    // for the buffers and reuse slices of it

    /**
     * @protected
     * @type {Uint32Array}
     */
    flags = bitfield();

    /**
     * @protected
     * @type {Uint32Array}
     */
    revealed = bitfield();

    // TODO: is there ever a case where we care about what cells
    // are revealed without caring about who owns them?
    // perhaps we should just ditch `revealed`?

    /**
     * @protected
     * @type {Map<number, Uint32Array>}
     */
    owned = new Map();

    /**
     * @protected
     * @type {number}
     */
    generation = 0;

    /**
     * @param {Uint32Array} mines
     * @param {unknown} seed
     */
    constructor(mines, seed = 0) {
        this.mines = mines;
        this.seed = seed;
    }

    /**
     * Return true if the cell at `bitpos` is a mine
     *
     * @param {number} bitpos
     * @returns {boolean}
     */
    isMine(bitpos) {
        return bitIsSet(this.mines, bitpos);
    }

    /**
     * Debug/testing : set a mine at `bitpos`
     *
     * @param {number} bitpos
     * @returns {void}
     */
    __setMine(bitpos) {
        setBit(this.mines, bitpos);
    }

    /**
     * Return true if the cell at `bitpos` is revealed
     *
     * @param {number} bitpos
     * @returns {boolean}
     */
    isRevealed(bitpos) {
        return bitIsSet(this.revealed, bitpos);
    }

    /**
     * Return true if the cell at `bitpos` is flagged
     *
     * @param {number} bitpos
     * @returns {boolean}
     */
    isFlagged(bitpos) {
        return bitIsSet(this.flags, bitpos);
    }

    /**
     * Mark the cell at `bitpos` as flagged
     *
     * @param {number} bitpos
     */
    flag(bitpos) {
        setBit(this.flags, bitpos);
        this.generation++;
    }

    /**
     * Mark the cell at `bitpos` as unflagged
     *
     * @param {number} bitpos
     */
    unflag(bitpos) {
        clearBit(this.flags, bitpos);
        this.generation++;
    }

    /**
     * "reveal" a single cell in the chunk and mark it as
     * owned by the given player
     *
     * Return true if the revealed cell was a mine and the
     * player should be killed
     *
     * @param {number} bitpos
     * @param {number} playerId
     * @returns {boolean}
     */
    reveal(bitpos, playerId) {
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
     *
     * @param {number} playerId
     * @returns {boolean}
     */
    kill(playerId) {
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
     *
     * @param {number} bitpos
     * @returns {number|undefined}
     */
    ownerid(bitpos) {
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
    isNewerThan(generation) {
        return this.generation > generation;
    }
}

const EMPTY_CHUNK = new Chunk(bitfield());
module.exports = { Chunk, EMPTY_CHUNK };
