// @ts-check

const ITERATIVE_REVEAL_LIMIT = 10_000;

/** @typedef {import('./Player')} Player */
/** @typedef {import('./PlayerStore').PlayerStore} PlayerStore */
/** @typedef {import('./render/IntermediateRenderer').IntermediateRenderer} IntermediateRenderer */

const { Chunk } = require('./Chunk');
const { playerStore } = require('./PlayerStore');
const { getDifficulty, ifTrace } = require('./config');
const { bitfield } = require('./util/bitfield');
const { genChunkMines: _genChunkMines } = require('./util/chunkops');
const { BITPOS_SHIFT } = require('./util/constants');
const {
    neighbors,
    chunkKey,
    bitpos,
    split,
    pack,
    offset: { chunkKey: offsetChunkKey },
} = require('./util/coords');

const { chunkKey: packChunkKey, split: packSplit } = pack;

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
     * Create a chunk at the chunk coordinates represented by `key`
     *
     * @protected
     * @param {bigint} key
     * @param {Player} player Player to create the chunk with
     * @returns {Chunk}
     */
    createChunk(key, player) {
        const difficulty = getDifficulty(player);
        const mines = this.genChunkMines(difficulty);
        const chunk = new Chunk(mines);
        this.chunks.set(key, chunk);
        return chunk;
    }

    /**
     * Return the chunk at the chunk coordinates represented by `key`
     * or create a new one
     *
     * @protected
     * @param {bigint} key
     * @param {Player} player Player to create the chunk with
     * @returns {Chunk}
     */
    getOrCreateChunk(key, player) {
        return this.chunks.get(key) ?? this.createChunk(key, player);
    }

    /**
     * Return the chunk at the chunk coordinates represented by `key`
     * or undefined
     *
     * @param {bigint} chunkid
     * @returns {Chunk|undefined}
     */
    getChunk(chunkid) {
        return this.chunks.get(chunkid);
    }

    /**
     * Return the chunk at the chunk coordinates represented by `key`
     * or throw an error
     *
     * @param {bigint} chunkid
     * @returns {Chunk}
     * @throws {Error}
     */
    expectChunk(chunkid) {
        const chunk = this.chunks.get(chunkid);
        if (chunk === undefined) {
            throw new Error(`Missing expected chunk ${chunkid}`);
        }
        return chunk;
    }

    /**
     * Set a flag at the target coordinates
     *
     * @param {number} x
     * @param {number} y
     * @param {Player} player Player to create the chunk with
     */
    flag(x, y, player) {
        // TODO: check whether player is allowed to flag this cell
        const [chunkid, bitpos] = packSplit(x, y);
        this.getOrCreateChunk(chunkid, player).flag(bitpos);
        // emit change(s)
    }

    /**
     * Remove a flag at the target coordinates
     *
     * @param {number} x
     * @param {number} y
     */
    unflag(x, y) {
        // TODO: check whether player is allowed to flag this cell
        const [chunkid, bitpos] = packSplit(x, y);
        const chunk = this.chunks.get(chunkid);
        if (chunk === undefined) return;

        chunk.unflag(bitpos);
        // emit change(s)
    }

    /**
     * Create an empty chunk at the target coordinates
     *
     * TODO: integrate with createChunk
     *
     * @param {number} x
     * @param {number} y
     */
    createSpawnChunk(x, y) {
        const [key] = packSplit(x, y);
        const chunk = new Chunk(bitfield());
        this.chunks.set(key, chunk);
    }

    /**
     * Reveal the cell at (x, y). If it is empty, reveal all the
     * neighbors
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

        const initial = pack(x, y);

        /** @type {bigint[]} */
        const stack = [initial];

        // especially for large open areas, we're
        // going through some work redundantly by adding all 8 neighbors
        // of each cell to the stack to evaluate. instead, keep a set of
        // all the cells we've already dealt with to avoid processing a cell
        // up to 8 times (for each of its neighbors)
        /** @type {Set<bigint>} */
        const seen = new Set();

        // continue to reveal the neighbors of any revealed cell that has a surrounding
        // mine count of zero
        for (let i = 0; i < ITERATIVE_REVEAL_LIMIT; i++) {
            // we're done
            if (stack.length === 0) return;

            // optimization: could get some performance gain with a double ended queue implementation
            const next = /** @type {bigint } */ (stack.shift());

            const key = chunkKey(next);
            const pos = bitpos(next);

            // ensure the chunk exists
            const chunk = this.getOrCreateChunk(key, player);

            // if it's already been revealed, nothing to do
            if (chunk.isRevealed(pos)) continue;

            // if it's queued, it should be marked as revealed
            const isDead = chunk.reveal(pos, playerId);

            ifTrace(next, playerId);

            if (isDead) {
                this.kill(player);

                if (next !== initial) {
                    // if it's not the initiating reveal, this is a bug
                    throw new Error('[BUG] iterative reveal: revealed a mine');
                }
            }

            // countNeighboringMines will lazily create other referenced chunks
            // as needed before counting the mines
            const count = this.countNeighboringMines(next, player);

            // if the count is nonzero, it's unsafe to reveal the neighbors
            if (count > 0) continue;

            // if we get here, there should be no surrounding mines. queue up
            // the neighbors to do it all again
            for (const pos of neighbors(next)) {
                if (seen.has(pos)) continue;
                stack.push(pos);
                seen.add(pos);
            }
        }

        throw new Error('iterative reveal: reached iteration limit');
    }

    /**
     * Kill the target player and reclaim their owned cells
     *
     * @param {Player} player
     */
    kill(player) {
        // kill player, recover cells/chunks
        // emit change(s)
    }

    /**
     * Count the mines surrounding the target coordinate
     *
     * @param {bigint} packed
     * @param {Player} player
     */
    countNeighboringMines(packed, player) {
        // it doesn't make sense to reuse RenderedChunk just for this
        // purpose, but we can likely extract the helper functions
        // and use them to count neighbors here.

        let sum = 0;
        for (const neighbor of neighbors(packed)) {
            const [key, pos] = split(neighbor);
            const chunk = this.getOrCreateChunk(key, player);
            if (chunk.isMine(pos)) sum++;
        }
        return sum;
    }

    /**
     * Debug/test : create a mine at the target coordinate
     *
     * @param {number} x
     * @param {number} y
     * @param {Player} player
     */
    __setMine(x, y, player) {
        const [chunkid, bitpos] = packSplit(x, y);
        this.getOrCreateChunk(chunkid, player).__setMine(bitpos);
    }

    /**
     * Debug/test : create a mine at the target coordinate
     *
     * Creates mines from a passed-in string array
     *
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
                    const [chunkid, bitpos] = packSplit(x + ox, y + oy);
                    this.getOrCreateChunk(chunkid, player).__setMine(bitpos);
                }

                ox++;
            }
            oy++;
        }
    }

    /**
     * Debug / test : set the target coordinate as revealed by `player`
     *
     * @param {number} x
     * @param {number} y
     * @param {Player} player
     */
    __setRevealed(x, y, player) {
        const [chunkid, bitpos] = packSplit(x, y);
        this.getOrCreateChunk(chunkid, player).reveal(
            bitpos,
            this.players.expectId(player),
        );
    }

    /**
     * Render the chunks in the specified viewport using the given
     * renderers
     *
     * @template T
     * @param {import('./render/IntermediateRenderer').IntermediateRenderer} ir
     * @param {import('./render/IntermediateRenderer').Renderer<T>} renderer
     * @param {number} absx
     * @param {number} absy
     * @param {number} w
     * @param {number} h
     * @returns {T[][]}
     */
    renderWith(ir, renderer, absx, absy, w, h) {
        // TODO: eliminate the 2d array. instead, let this method
        // be responsible for converting "chunks" back into actual x,y
        // coordinates and calling ... the renderer? some callback?
        // at every stage
        //
        // we might need to keep a row buffer so that we can
        // emit chunks in a sane reading order, but it's not
        // strictly necessary

        /** @type {T[][]} */
        const rendered = [];
        // round up?
        const cols = w >>> BITPOS_SHIFT;
        const rows = h >>> BITPOS_SHIFT;

        const topleftChunk = packChunkKey(absx, absy);

        for (let oy = 0; oy < rows; oy++) {
            for (let ox = 0; ox < cols; ox++) {
                rendered[oy] ??= [];
                rendered[oy][ox] = this.renderChunk(
                    ir,
                    renderer,
                    offsetChunkKey(topleftChunk, ox, oy),
                );
            }
        }

        return rendered;
    }

    /**
     * Render a chunk using the given renderers
     *
     * @private
     * @template T
     * @param {import('./render/IntermediateRenderer').IntermediateRenderer} ir
     * @param {import('./render/IntermediateRenderer').Renderer<T>} renderer
     * @param {bigint} key
     * @returns {T}
     */
    renderChunk(ir, renderer, key) {
        const chunk = this.getChunk(key);

        if (chunk === undefined) return renderer.emptyChunk;

        const nw = this.getChunk(offsetChunkKey(key, -1, -1));
        const n = this.getChunk(offsetChunkKey(key, 0, -1));
        const ne = this.getChunk(offsetChunkKey(key, +1, -1));

        const w = this.getChunk(offsetChunkKey(key, -1, 0));
        const e = this.getChunk(offsetChunkKey(key, +1, 0));

        const sw = this.getChunk(offsetChunkKey(key, -1, +1));
        const s = this.getChunk(offsetChunkKey(key, 0, +1));
        const se = this.getChunk(offsetChunkKey(key, +1, +1));

        ir.updateFrom(chunk, nw, n, ne, w, e, sw, s, se);
        ir.update(renderer); // at x,y?

        return renderer.finish();
    }
}

const chunkStore = new ChunkStore(playerStore, _genChunkMines);
module.exports = { ChunkStore, chunkStore };
