// @ts-check

/** @typedef {import('./Player')} Player */

const { bitfield, bitIsSet, setBit, bulkUnset, clearBit } = require('./util');

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

    /**
     * @protected
     * @type {Map<number, Uint32Array>}
     */
    owned = new Map();

    /**
     * @param {Uint32Array} mines
     * @param {unknown} seed
     */
    constructor(mines, seed = 0) {
        this.mines = mines;
        this.seed = seed;
    }

    /**
     * @param {number} bitpos
     * @returns {boolean}
     */
    isMine(bitpos) {
        return bitIsSet(this.mines, bitpos);
    }

    /**
     * @param {number} bitpos
     * @returns {void}
     */
    __setMine(bitpos) {
        setBit(this.mines, bitpos);
    }

    /**
     * @param {number} bitpos
     * @returns {boolean}
     */
    isRevealed(bitpos) {
        return bitIsSet(this.revealed, bitpos);
    }

    /**
     * @param {number} bitpos
     * @returns {boolean}
     */
    isFlagged(bitpos) {
        return bitIsSet(this.flags, bitpos);
    }

    /**
     * @param {number} bitpos
     */
    flag(bitpos) {
        setBit(this.flags, bitpos);
    }

    /**
     * @param {number} bitpos
     */
    unflag(bitpos) {
        clearBit(this.flags, bitpos);
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

        return this.owned.size === 0;
    }

    /**
     * @param {number} bitpos
     * @returns {number}
     */
    ownerid(bitpos) {
        if (!bitIsSet(this.revealed, bitpos)) return 0;
        for (const [ownerid, bits] of this.owned.entries()) {
            if (bitIsSet(bits, bitpos)) return ownerid;
        }
        return 0;
    }
}

module.exports = Chunk;
