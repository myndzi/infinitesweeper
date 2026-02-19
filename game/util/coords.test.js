// @ts-check
/// <reference types="vitest/globals" />

const { CHUNK_EDGE_SIZE } = require('./constants');
const { unpack, pack, offset, humanCoords, chunkKey } = require('./coords');

it('[pack/unpack].chunk is reversible', () => {
    const xy = unpack.chunk(pack.chunk(CHUNK_EDGE_SIZE * 2, CHUNK_EDGE_SIZE));
    expect(xy).toEqual({ cx: CHUNK_EDGE_SIZE * 2, cy: CHUNK_EDGE_SIZE });
});

it('humanCoords reports chunk offsets rather than absolute offsets', () => {
    const xy = humanCoords(pack(CHUNK_EDGE_SIZE, CHUNK_EDGE_SIZE));
    expect(xy).toMatchObject({ cx: 1, cy: 1 });
});

it('[pack/unpack].bitpos is reversible', () => {
    const xy = unpack.bitpos(pack.bitpos(3, 4));
    expect(xy).toEqual({ bx: 3, by: 4 });
});

describe('pack/unpack', () => {
    it('is reversible', () => {
        const edge_size = CHUNK_EDGE_SIZE;
        // span some chunk boundaries
        for (let x = -edge_size * 2; x < edge_size * 2; x++) {
            for (let y = -edge_size * 2; y < edge_size * 2; y++) {
                const packed = pack(x, y);

                expect(unpack(packed)).toEqual({ absx: x, absy: y });
            }
        }
    });
    it('normalizes into signed 32-bit ints', () => {
        expect(unpack(pack(2 ** 32, 2 ** 32))).toEqual({ absx: 0, absy: 0 });
        expect(unpack(pack(2 ** 32 - 1, 2 ** 32 - 1))).toEqual({
            absx: -1,
            absy: -1,
        });
    });
});

describe('offset.chunkKey', () => {
    // why is this doing my head in. what's the lowest valid int32?!
    const int32min = -(2 ** 31);
    const int32max = 2 ** 31 - 1;

    const { cx: MAX_CHUNK, cy: MIN_CHUNK } = humanCoords(
        pack(int32max, int32min),
    );

    // prettier-ignore
    const tests = [
        // adjusting chunk by 1 produces an unpacked difference of CHUNK_EDGE_SIZE
        {x: 0, y: 0, ox: 1, oy: 0, expected: [1, 0]},
        {x: 0, y: 0, ox: -1, oy: 0, expected: [-1, 0]},
        {x: 0, y: 0, ox: 0, oy: 1, expected: [0, 1]},
        {x: 0, y: 0, ox: 0, oy: -1, expected: [0, -1]},

        // at the uint32 boundaries, values should wrap around and not interfere
        // with each other
        {x: int32max, y: int32max, ox: 1, oy: 0, expected: [MIN_CHUNK, MAX_CHUNK]},
        {x: int32max, y: int32max, ox: 0, oy: 1, expected: [MAX_CHUNK, MIN_CHUNK]},
        {x: int32min, y: int32min, ox: -1, oy: 0, expected: [MAX_CHUNK, MIN_CHUNK]},
        {x: int32min, y: int32min, ox: 0, oy: -1, expected: [MIN_CHUNK, MAX_CHUNK]},
    ]
    it.each(tests)(
        `should adjust the chunk at [$x, $y] by [$ox, $oy]`,
        ({ x, y, ox, oy, expected }) => {
            const key = chunkKey(pack(x, y));
            const next = offset.chunkKey(key, ox, oy);

            const { cx, cy } = humanCoords(next);
            expect([cx, cy]).toEqual(expected);
        },
    );
});
