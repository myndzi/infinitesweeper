// combine/separate chunk/bitfield portion of a single coordinate
export const BITPOS_SHIFT = 3;
export const BITPOS_MASK = (1 << BITPOS_SHIFT) - 1;

// combine/separate x/y chunk coords
export const CHUNK_SHIFT = 32n - BigInt(BITPOS_SHIFT);
export const CHUNK_MASK = (1n << CHUNK_SHIFT) - 1n;

// combine/separate chunk coords / bitfield coords
export const PACK_SHIFT = BigInt(BITPOS_SHIFT) << 1n;
export const PACK_MASK = (1n << PACK_SHIFT) - 1n;

// bitfield layout
export const CHUNK_EXPONENT = BITPOS_SHIFT * 2; // sqrt(2^CHUNK_EXPONENT) = size of x, y coords in a chunk
export const CHUNK_EDGE_SIZE = 1 << BITPOS_SHIFT;
export const NUM_CHUNK_BITS = 1 << CHUNK_EXPONENT;

if (NUM_CHUNK_BITS % 32 !== 0) {
    // can adjust a little, but some code / constants need to change if
    // we aren't using Uint32Arrays. we expect bitfields to be "full"
    // without the last element being a partial one
    throw new Error('NUM_CHUNK_BITS must be a multiple of 32');
}

export const BITFIELD_SIZE = Math.ceil(NUM_CHUNK_BITS / 32);
export const BITPOS_IDX_SHIFT = 5;
export const BITPOS_BITS_MASK = 31;
export const BITPOS_ROW_SHIFT = Math.log(CHUNK_EDGE_SIZE) / Math.LN2;
