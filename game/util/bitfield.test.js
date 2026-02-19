// @ts-check
/// <reference types="vitest/globals" />

const { bitfield, setBit, bfstr, bitIsSet, clearBit } = require('./bitfield');
const { NUM_CHUNK_BITS } = require('./constants');
const { pack } = require('./coords');

describe('bitfields', () => {
    it("puts the bit where it's expected", () => {
        let bf = bitfield();
        setBit(bf, pack.bitpos(0, 0));
        expect(bf[0] & 1).not.toEqual(0);
        expect(bfstr(bf)).toMatchInlineSnapshot(`
          "10000000
          00000000
          00000000
          00000000
          00000000
          00000000
          00000000
          00000000"
        `);

        bf = bitfield();
        setBit(bf, pack.bitpos(7, 7));
        expect(bf[1] & 0x80000000).not.toEqual(0);
        expect(bfstr(bf)).toMatchInlineSnapshot(`
          "00000000
          00000000
          00000000
          00000000
          00000000
          00000000
          00000000
          00000001"
        `);
    });

    const positions = new Array(NUM_CHUNK_BITS).fill(0).map((_, idx) => idx);
    it.each(positions)('$0: set/test/clear/test', i => {
        const bits = bitfield();
        expect(bitIsSet(bits, i)).toEqual(false);
        setBit(bits, i);
        expect(bitIsSet(bits, i)).toEqual(true);
        clearBit(bits, i);
        expect(bitIsSet(bits, i)).toEqual(false);
    });
});
