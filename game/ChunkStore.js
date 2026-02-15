// @ts-check

const ITERATIVE_REVEAL_LIMIT = 10_000;

/** @typedef {import('./Player')} Player */
/** @typedef {import('./PlayerStore')} PlayerStore */

// TODO: never makes sense to have a flag on a revealed cell
// since mine count needs an extra useless bit, we can instead
// just have it be {flagged} or {revealed + count + player}

/**
 * @typedef {Object} UnpackedUnrevealed
 * @property {boolean} isFlagged
 * @property {false} isRevealed
 * @property {undefined} mineCount
 * @property {undefined} player
 */
/**
 * @typedef {Object} UnpackedRevealed
 * @property {boolean} isFlagged
 * @property {true} isRevealed
 * @property {number} mineCount
 * @property {Player} player
 */
/** @typedef {UnpackedUnrevealed|UnpackedRevealed} UnpackedCellCode */

const Chunk = require('./Chunk');
const { getDifficulty } = require('./config');
const {
    pack,
    neighbors,
    genChunkMines: _genChunkMines,
    assertIntRange,
} = require('./util');

class ChunkStore {
    /**
     * @protected
     * @type {Map<bigint, Chunk>}
     */
    chunks = new Map();

    /**
     * @protected
     * @type {PlayerStore}
     */
    players;

    /**
     * @protected
     * @type {(difficulty: number) => Uint32Array}
     */
    genChunkMines;

    /**
     * @param {PlayerStore} playerStore
     * @param {(difficulty: number) => Uint32Array} genChunkMines
     */
    constructor(playerStore, genChunkMines = _genChunkMines) {
        this.players = playerStore;
        this.genChunkMines = genChunkMines;
    }

    /**
     * @protected
     * @param {bigint} chunkid
     * @param {Player} player
     * @returns {Chunk}
     */
    getOrCreateChunk(chunkid, player) {
        let chunk = this.chunks.get(chunkid);

        if (chunk === undefined) {
            const difficulty = getDifficulty(player);
            const mines = this.genChunkMines(difficulty);
            chunk = new Chunk(mines);
            this.chunks.set(chunkid, chunk);
        }
        return chunk;
    }

    /**
     * @param {bigint} chunkid
     * @returns {Chunk|undefined}
     */
    getChunk(chunkid) {
        return this.chunks.get(chunkid);
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {Player} player
     */
    flag(x, y, player) {
        // todo: check whether player is allowed to flag this cell
        const [chunkid, bitpos] = pack(x, y);
        this.getOrCreateChunk(chunkid, player).flag(bitpos);
        // emit change(s)
    }

    /**
     * @param {number} x
     * @param {number} y
     */
    unflag(x, y) {
        // todo: check whether player is allowed to flag this cell
        const [chunkid, bitpos] = pack(x, y);
        const chunk = this.chunks.get(chunkid);
        if (chunk === undefined) return;

        chunk.unflag(bitpos);
        // emit change(s)
    }

    /**
     * @protected
     * @param {bigint} chunkid
     * @param {number} bitpos
     * @param {[chunkid: bigint, bitpos: number][]} stack
     */
    pushUnrevealedNeighbors(chunkid, bitpos, stack) {
        const count = this.countNeighboringMines(chunkid, bitpos);
        if (count > 0) return;

        for (const pos of neighbors(chunkid, bitpos)) {
            const chunk = this.chunks.get(pos[0]);
            if (chunk?.isRevealed(pos[1]) === true) continue;

            // if there is no chunk, or the cell in the chunk
            // is not yet revealed, queue it up
            stack.push(pos);
        }
    }

    /**
     * Reveal the cell at (x, y). If it is empty, reveal all the
     * neighbors. Continue
     *
     * @param {number} x
     * @param {number} y
     * @param {Player} player
     * @param {number} [playerId]
     */
    iterativeReveal(x, y, player, playerId) {
        playerId ??= this.players.getId(player);
        if (playerId === undefined) {
            console.error('Unknown player', player);
            return;
        }

        const [chunkid, bitpos] = pack(x, y);
        const chunk = this.getOrCreateChunk(chunkid, player);

        const isDead = chunk.reveal(bitpos, playerId);
        if (isDead) {
            this.kill(player);
            return;
        }

        /** @type {[chunkid: bigint, bitpos: number][]} */
        const stack = [];

        // fill the stack initially
        this.pushUnrevealedNeighbors(chunkid, bitpos, stack);

        // continue to reveal the neighbors of any revealed cell that has a surrounding
        // mine count of zero
        let i = 0;
        while (stack.length > 0) {
            // bail if we might be going infinite
            if (i++ > ITERATIVE_REVEAL_LIMIT) {
                throw new Error('iterative reveal: reached iteration limit');
            }

            // optimization: could get some performance gain with a double ended queue implementation
            const next = /** @type {[chunkid: bigint, bitpos: number]} */ (
                stack.shift()
            );

            // generate chunks lazily if required
            const chunk = this.getOrCreateChunk(next[0], player);

            // should never be true - we should only be revealing "safe" cells
            const isDead = chunk.reveal(next[1], playerId);
            if (isDead) {
                throw new Error('[BUG] iterative reveal: revealed a mine');
            }

            this.pushUnrevealedNeighbors(next[0], next[1], stack);
        }
    }

    /**
     * @param {Player} player
     */
    kill(player) {
        // kill player, recover cells/chunks
        // emit change(s)
    }

    /**
     * @param {bigint} chunkid
     * @param {number} bitpos
     */
    countNeighboringMines(chunkid, bitpos) {
        // future: this can certainly be optimized for bulk traversal
        let sum = 0;
        for (const pos of neighbors(chunkid, bitpos)) {
            sum += this.chunks.get(pos[0])?.isMine(pos[1]) === true ? 1 : 0;
        }
        return sum;
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {Player} player
     */
    __setMine(x, y, player) {
        const [chunkid, bitpos] = pack(x, y);
        this.getOrCreateChunk(chunkid, player).__setMine(bitpos);
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {Player} player
     * @param {string[]} mines
     */
    __setMinesAt(x, y, player, mines) {
        let oy = 0;
        for (const row of mines) {
            let ox = 0;
            for (const chr of row) {
                if (chr !== ' ') {
                    const [chunkid, bitpos] = pack(x + ox, y + oy);
                    this.getOrCreateChunk(chunkid, player).__setMine(bitpos);
                }

                ox++;
            }
            oy++;
        }
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {Player} player
     */
    __setRevealed(x, y, player) {
        const [chunkid, bitpos] = pack(x, y);
        this.getOrCreateChunk(chunkid, player).reveal(
            bitpos,
            this.players.expectId(player),
        );
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @param {(x: number, y: number, code: number) => void} cb
     */
    render(x, y, w, h, cb) {
        // sane render ranges TBD
        assertIntRange(w, 1, 1000);
        assertIntRange(h, 1, 1000);

        for (let rx = x; rx < x + w; rx++) {
            for (let ry = y; ry < y + h; ry++) {
                const code = this.getCellCode(...pack(rx, ry));
                if (code !== 0) cb(rx, ry, code);
            }
        }
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @returns {string}
     */
    __debugRender(x, y, w, h) {
        // sane render ranges TBD
        assertIntRange(w, 1, 1000);
        assertIntRange(h, 1, 1000);

        /** @type {string[][]} */
        const strs = [];
        let maxRow = 0;
        this.render(x, y, w, h, (x, y, code) => {
            strs[y] ??= [];
            const { isFlagged, isRevealed, mineCount } =
                this.__unpackCellCode(code);

            maxRow = Math.max(x, maxRow);
            if (isRevealed) {
                strs[y][x] = mineCount.toString();
            } else if (isFlagged) {
                strs[y][x] = 'f';
            }
        });

        /** @type {string[]} */
        const rows = [];
        for (let i = 0; i < strs.length; i++) {
            const row = strs[i] ?? [];

            for (let j = 0; j < maxRow; j++) {
                row[j] ??= ' ';
            }
            rows[i] = row.join('');
        }
        return rows.join('\n');
    }

    /**
     * pppp = player number
     * nnnn = mine count
     * r = revealed?
     * f = flagged?
     *
     * ppppnnnnrf
     *
     * @private
     * @param {bigint} chunkid
     * @param {number} bitpos
     * @returns {number}
     */
    getCellCode(chunkid, bitpos) {
        let code = 0;

        const chunk = this.chunks.get(chunkid);

        // uninitialized chunks reveal no information
        if (chunk === undefined) return 0;

        // cell is flagged
        if (chunk.isFlagged(bitpos)) code |= 1;

        // unrevealed cells don't need a count
        if (!chunk.isRevealed(bitpos)) return code;

        // cell is revealed
        code |= 2;

        // count the number of surrounding mines
        const count = this.countNeighboringMines(chunkid, bitpos);
        code |= count << 2;

        // revealed cells have an owner
        const ownerid = chunk.ownerid(bitpos);
        code |= ownerid << 6;

        return code;
    }

    /**
     * @param {number} code
     * @returns {UnpackedCellCode}
     */
    __unpackCellCode(code) {
        const isFlagged = (code & 1) !== 0;
        const isRevealed = (code & 2) !== 0;
        const mineCount = !isRevealed ? undefined : (code >>> 2) & 0b1111;
        const player = !isRevealed ? undefined : this.players.get(code >>> 6);
        return /** @type {UnpackedCellCode} */ ({
            isFlagged,
            isRevealed,
            mineCount,
            player,
        });
    }
}

module.exports = ChunkStore;
