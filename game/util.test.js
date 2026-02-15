// @ts-check
/// <reference types="vitest/globals" />

const {
    CONSTANTS,
    pack,
    unpack,
    bitfield,
    bitIsSet,
    setBit,
    clearBit,
} = require('./util');

describe('pack/unpack', () => {
    it('is reversible', () => {
        const edge_size = CONSTANTS.CHUNK_EDGE_SIZE;
        // span some chunk boundaries
        for (let x = -edge_size * 2; x < edge_size * 2; x++) {
            for (let y = -edge_size * 2; y < edge_size * 2; y++) {
                const [chunkid, bitpos] = pack(x, y);
                expect(unpack(chunkid, bitpos)).toEqual([x, y]);
            }
        }
    });

    it('splits data correctly', () => {
        const edge_size = CONSTANTS.CHUNK_EDGE_SIZE;
        // span some chunk boundaries
        for (let x = -edge_size * 2; x < edge_size * 2; x++) {
            for (let y = -edge_size * 2; y < edge_size * 2; y++) {
                const [chunkid, bitpos] = pack(x, y);
                expect(chunkid).toBeTypeOf('bigint');
                expect(bitpos).toBeTypeOf('number');
                expect(bitpos).toBeGreaterThanOrEqual(0);
                expect(bitpos).toBeLessThan(32 * CONSTANTS.BITFIELD_SIZE);
            }
        }
    });
});

describe('bitfield ops', () => {
    const positions = new Array(CONSTANTS.NUM_CHUNK_BITS)
        .fill(0)
        .map((_, idx) => idx);
    it.each(positions)('$0: set/test/clear/test', i => {
        const bits = bitfield();
        expect(bitIsSet(bits, i)).toEqual(false);
        setBit(bits, i);
        expect(bitIsSet(bits, i)).toEqual(true);
        clearBit(bits, i);
        expect(bitIsSet(bits, i)).toEqual(false);
    });
});
