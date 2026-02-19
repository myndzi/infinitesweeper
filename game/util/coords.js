// @ts-check

const {
    BITPOS_SHIFT,
    BITPOS_MASK,
    CHUNK_SHIFT,
    CHUNK_MASK,
    PACK_SHIFT,
    PACK_MASK,
    CHUNK_EDGE_SIZE,
} = require('./constants');

/**
 * Pack chunk coordinates together
 *
 * @param {number} cx
 * @param {number} cy
 * @returns {bigint}
 */
const packChunk = (cx, cy) => (BigInt(cy) << CHUNK_SHIFT) | BigInt(cx);

/**
 * Unpack chunk coordinates
 *
 * @param {bigint} packedChunk
 * @returns {{cx: number, cy: number}}
 */
const unpackChunk = packedChunk => ({
    cx: Number(packedChunk & CHUNK_MASK),
    cy: Number(packedChunk >> CHUNK_SHIFT),
});

/**
 * Pack bitfield coordinates together
 *
 * @param {number} bx
 * @param {number} by
 * @returns {number}
 */
const packBitpos = (bx, by) => (by << BITPOS_SHIFT) | bx;

/**
 * Unpack bitfield coordinates
 *
 * @param {number} packedBitfield
 * @returns {{bx: number, by: number}}
 */
const unpackBitpos = packedBitfield => ({
    bx: packedBitfield & BITPOS_MASK,
    by: packedBitfield >> BITPOS_SHIFT,
});

/**
 * Pack the given cell coordinates into a bigint
 *
 * Packed coordinates consist of a chunk coordinate and a
 * bitfield position within that chunk and encoded with the layout:
 *
 * Absolute coordinates XXXXxx, YYYYyy are combined into a single
 * value with the layout: `YYYYXXXXyyxx`
 *
 * The capital letters represent the chunk component, and the
 * lowercase letters represent the bitfield position component.
 *
 * Values out of range will discard their high bits, causing
 * the values to "wrap around"
 *
 * @param {number} absx
 * @param {number} absy
 * @returns {bigint}
 */
const pack = (absx, absy) => {
    const chunkpos = packChunk(absx >>> BITPOS_SHIFT, absy >>> BITPOS_SHIFT);
    const bitpos = packBitpos(absx & BITPOS_MASK, absy & BITPOS_MASK);

    return (chunkpos << PACK_SHIFT) | BigInt(bitpos);
};

/**
 * Pack the given cell coordinates and return the two components
 * separately.
 *
 * @param {number} absx
 * @param {number} absy
 * @returns {[chunkkey: bigint, bitpos: number]}
 */
pack.split = (absx, absy) => {
    const chunkpos = packChunk(absx >>> BITPOS_SHIFT, absy >>> BITPOS_SHIFT);
    const bitpos = packBitpos(absx & BITPOS_MASK, absy & BITPOS_MASK);
    return [chunkpos << PACK_SHIFT, bitpos];
};

/**
 * Return a packed coordinate representing a chunk key
 * for the given _chunk_ coordinates.
 *
 * Example: (10,10) might be chunk (1, 1) bitfield (2, 2)
 *
 * pack.chunkKey(1, 1) === chunkKey(pack(10, 10))
 *
 * @param {number} cx
 * @param {number} cy
 * @returns {bigint}
 */
pack.chunkKey = (cx, cy) =>
    packChunk(cx >>> BITPOS_SHIFT, cy >>> BITPOS_SHIFT) << PACK_SHIFT;
pack.chunk = packChunk;
pack.bitpos = packBitpos;

/**
 * Unpack a packed coordinate into absolute coordinates
 *
 * @param {bigint} packed
 * @returns {{absx: number, absy: number}}
 */
const unpack = packed => {
    const { bx, by } = unpackBitpos(Number(packed & PACK_MASK));
    const { cx, cy } = unpackChunk(packed >> PACK_SHIFT);

    const absx = ((cx << BITPOS_SHIFT) | bx) >> 0;
    const absy = ((cy << BITPOS_SHIFT) | by) >> 0;

    return { absx, absy };
};
unpack.chunk = unpackChunk;
unpack.bitpos = unpackBitpos;

const PACK_INVERSE_MASK = 0xffffffffffffffffn ^ PACK_MASK;

/**
 * Return the chunk coordinate portion of a packed coordinate,
 * suitable for use as a Map index.
 *
 * The low bits (bitfield position) are set to 0, but the value
 * is not shifted to normalize it.
 *
 * @param {bigint} packed
 * @returns {bigint}
 */
const chunkKey = packed => packed & PACK_INVERSE_MASK;

/**
 * Return the bitfield position of a packed coordinate,
 * suitable for use in updating bitfields.
 *
 * @param {bigint} packed
 * @returns {number}
 */
const bitpos = packed => Number(packed & PACK_MASK) >>> 0;

/**
 * Split a packed coordinate into the chunk key and
 * bitfield position portions, and return them both.
 *
 * @param {bigint} packed
 * @returns {[chunkKey: bigint, bitpos: number]}
 */
const split = packed => [
    packed & PACK_INVERSE_MASK,
    Number(packed & PACK_MASK) >>> 0,
];

/**
 * Unpack a packed coordinate into a chunk (x, y) and a bitfield
 * (x, y) value, suitable for debugging and display.
 *
 * @param {bigint} packed
 * @returns {{cx: number, cy: number, bx: number, by: number}}
 */
const humanCoords = packed => {
    const { absx, absy } = unpack(packed);
    return {
        cx: absx >> BITPOS_SHIFT,
        cy: absy >> BITPOS_SHIFT,
        bx: (absx >>> 0) & BITPOS_MASK,
        by: (absy >>> 0) & BITPOS_MASK,
    };
};

/**
 * Given a packed coordinate, return a new packed coordinate
 * with the given cell offsets applied.
 *
 * @param {bigint} packed
 * @param {number} ox
 * @param {number} oy
 * @returns {bigint}
 */
const offset = (packed, ox, oy) => {
    // this could possibly be made more efficient - would
    // require testing and benchmarking, and be complex
    const { absx, absy } = unpack(packed);
    return pack(absx + ox, absy + oy);
};

/**
 * Given a packed coordinate, return a new packed coordinate
 * with the given chunk offsets applied.
 *
 * The input coordinate is assumed to be a chunk key, which
 * is a packed coordinate with the bitfield position set to
 * 0.
 *
 * @param {bigint} key
 * @param {number} ox
 * @param {number} oy
 * @returns {bigint}
 */
offset.chunkKey = (key, ox, oy) => {
    const { absx, absy } = unpack(key);
    return pack(absx + ox * CHUNK_EDGE_SIZE, absy + oy * CHUNK_EDGE_SIZE);
};

/**
 * Given a packed cell coordinate, yield packed
 * coordinates for the 8 neighboring cells
 *
 * @param {bigint} packed
 * @returns {Generator<bigint, void, unknown>}
 */
function* neighbors(packed) {
    yield offset(packed, -1, -1);
    yield offset(packed, 0, -1);
    yield offset(packed, +1, -1);

    yield offset(packed, -1, 0);
    yield offset(packed, +1, 0);

    yield offset(packed, -1, +1);
    yield offset(packed, 0, +1);
    yield offset(packed, +1, +1);
}

module.exports = {
    chunkKey,
    bitpos,

    pack,
    unpack,
    split,
    humanCoords,

    neighbors,
    offset,
};
