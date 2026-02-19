// @ts-check
/// <reference types="vitest/globals" />

const Player = require('./Player');
const { ChunkStore } = require('./ChunkStore');
const { PlayerStore } = require('./PlayerStore');
const { CHUNK_EDGE_SIZE, BITFIELD_SIZE } = require('./util/constants');
const { unpack, neighbors, pack } = require('./util/coords');

/**
 * @param {number} expected
 * @param {ChunkStore} chunkStore
 * @param {bigint} packed
 */
const assertCount = (expected, chunkStore, packed) => {
    const count = chunkStore.countNeighboringMines(packed, mockPlayer);
    expect(count).toEqual(expected);
};

/**
 * @param {ChunkStore} chunkStore
 * @param {number} x
 * @param {number} y
 */
const assertSeen = (chunkStore, x, y) => {
    const packed = pack(x, y);
    for (const pos of neighbors(packed)) {
        assertCount(1, chunkStore, pos);
    }
};

/**
 * @param {number} difficulty
 * @returns {Uint32Array}
 */
const emptyChunkMines = difficulty => new Uint32Array(BITFIELD_SIZE);

const mockPlayer = new Player('foo', 0, 0, '#ffffff');
const playerStore = new PlayerStore();
playerStore.add(mockPlayer);

const newChunkStore = () => new ChunkStore(playerStore, emptyChunkMines);

describe('ChunkStore', () => {
    /** @type {[x: number, y: number][]} */
    const coords = [];
    const edge_size = CHUNK_EDGE_SIZE;
    for (let x = 0; x < edge_size; x++) {
        for (let y = 0; y < edge_size; y++) {
            coords.push([x, y]);
        }
    }

    // ensure mines are countable from all neighbors of every position in a chunk
    it.each(coords)('counts mines [$0, $1]', (x, y) => {
        const store = newChunkStore();
        store.__setMine(x, y, mockPlayer);
        assertSeen(store, x, y);
    });

    // describe('render', () => {
    //     it('calls back only with cells that have data', () => {
    //         const store = newChunkStore();
    //         let calls = 0;
    //         store.render(-10, -10, 20, 20, () => {
    //             calls++;
    //         });
    //         expect(calls).toEqual(0);
    //     });

    //     it('does not include extra info if cell is not revealed', () => {
    //         const store = newChunkStore();
    //         store.flag(0, 0, mockPlayer);

    //         store.render(-10, -10, 20, 20, (x, y, code) => {
    //             expect(x).toEqual(0);
    //             expect(y).toEqual(0);
    //             expect(store.__unpackCellCode(code)).toEqual({
    //                 isFlagged: true,
    //                 isRevealed: false,
    //                 mineCount: undefined,
    //                 player: undefined,
    //             });
    //         });
    //     });

    //     it('includes flag presence whether the cell is revealed or not', () => {
    //         // TODO: clean this up, change test title

    //         const store = newChunkStore();
    //         store.flag(1, 1, mockPlayer);
    //         store.flag(0, 0, mockPlayer);
    //         store.__setMine(1, 1, mockPlayer);
    //         store.__setRevealed(0, 0, mockPlayer);

    //         /** @type {[x: number, y: number, code: import('./ChunkStore').UnpackedCellCode][]} */
    //         const codes = [];
    //         store.render(-10, -10, 20, 20, (x, y, code) => {
    //             codes.push([x, y, store.__unpackCellCode(code)]);
    //         });

    //         // prettier-ignore
    //         expect(codes).toEqual([
    //             [0, 0, {isFlagged: true, isRevealed: true, mineCount: 1, player: mockPlayer}],
    //             [1, 1, {isFlagged: true, isRevealed: false, mineCount: undefined, player: undefined}],
    //         ]);
    //     });

    //     it('includes mine count and owner when cell is revealed', () => {
    //         const store = newChunkStore();
    //         store.__setMine(1, 1, mockPlayer);
    //         store.__setRevealed(0, 0, mockPlayer);

    //         store.render(-10, -10, 20, 20, (x, y, code) => {
    //             expect(x).toEqual(0);
    //             expect(y).toEqual(0);
    //             expect(store.__unpackCellCode(code)).toEqual({
    //                 isFlagged: false,
    //                 isRevealed: true,
    //                 mineCount: 1,
    //                 player: mockPlayer,
    //             });
    //         });
    //     });
    // });

    describe('iterativeReveal', () => {
        // it.each([
        //     [0, 0],
        //     // should work the same when crossing a chunk boundary
        //     [CHUNK_EDGE_SIZE - 2, CHUNK_EDGE_SIZE - 2],
        // ])('reveals neighbors with a mine count of 0', (absx, absy) => {
        //     const store = newChunkStore();
        //     // prettier-ignore
        //     store.__setMinesAt(absx, absy, mockPlayer, [
        //         'xxxxx',
        //         'x   x',
        //         'x   x',
        //         'x   x',
        //         'xxxxx'
        //     ]);
        //     store.flag(absx, absy, mockPlayer);
        //     store.iterativeReveal(absx + 2, absy + 2, mockPlayer);
        //     const str = store.__debugRender(absx, absy, 10, 10);
        //     // prettier-ignore
        //     // expect(str).toMatchInlineSnapshot(`
        //     expect(str.split('\n').map(v => v.trim()).filter(v => !!v)).toEqual([
        //         'f',
        //         '535',
        //         '303',
        //         '535',
        //     ]);
        // });

        it('aborts at max iteration limit', () => {
            const store = newChunkStore();
            expect(() => {
                store.iterativeReveal(0, 0, mockPlayer);
            }).toThrow(/reached iteration limit/);
        });
    });
});
