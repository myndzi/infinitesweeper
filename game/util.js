// @ts-check

// convert [-2^31, 2^31-1] -> [0, 2^32] and back
const BIAS = 0x80000000;

// combine/separate chunk/bitfield portion of a single coordinate
const COORD_SHIFT = 3;
const COORD_MASK = (1 << COORD_SHIFT) - 1;

// combine/separate x/y chunk coords
const CHUNK_SHIFT = 32n - BigInt(COORD_SHIFT);
const CHUNK_MASK = (1n << CHUNK_SHIFT) - 1n;

// bitfield layout
const CHUNK_EXPONENT = COORD_SHIFT * 2; // sqrt(2^CHUNK_EXPONENT) = size of x, y coords in a chunk
const CHUNK_EDGE_SIZE = 1 << COORD_SHIFT;
const NUM_CHUNK_BITS = 1 << CHUNK_EXPONENT;
const BITFIELD_SIZE = Math.ceil(NUM_CHUNK_BITS / 32);
const BITPOS_IDX_SHIFT = 5;
const BITPOS_BITS_MASK = 31;

const bitfield = () => new Uint32Array(BITFIELD_SIZE);

/**
 * Pack an x, y coordinate where x and y are in the range
 * [-2^31, 2^31-1] into two components:
 *
 * - chunkid: a bigint containing the concatenated
 *            chunk coordinates, e.g. xxxyyy
 *
 * - bitpos:  a number representing the index into
 *            a bitfield representing a single chunk
 *
 * @param {number} x
 * @param {number} y
 * @returns {[chunkid: bigint, bitpos: number]}
 */
const pack = (x, y) => {
    const bx = x ^ BIAS;
    const by = y ^ BIAS;

    const cx = bx >>> COORD_SHIFT;
    const cy = by >>> COORD_SHIFT;

    const fx = bx & COORD_MASK;
    const fy = by & COORD_MASK;

    const chunkid = (BigInt(cy) << CHUNK_SHIFT) | BigInt(cx);
    const bitpos = (fx << COORD_SHIFT) | fy;

    return [chunkid, bitpos];
};

/**
 * Unpack a [chunkid, bitpos] pair into their x, y coordinates
 *
 * @param {bigint} chunkid
 * @param {number} bitpos
 * @returns {[x: number, y: number]}
 */
const unpack = (chunkid, bitpos) => {
    const cx = chunkid & CHUNK_MASK;
    const cy = chunkid >> CHUNK_SHIFT;

    const fx = bitpos >> COORD_SHIFT;
    const fy = bitpos & COORD_MASK;

    const bx = (Number(cx) << COORD_SHIFT) | fx;
    const by = (Number(cy) << COORD_SHIFT) | fy;

    return [bx ^ (BIAS >> 0), by ^ (BIAS >> 0)];
};

/**
 * @param {Uint32Array} buf
 * @param {number} pos
 * @returns {boolean}
 */
const bitIsSet = (buf, pos) => {
    if (!Number.isInteger(pos) || pos < 0 || pos >= buf.length << 5) {
        return false;
    }
    const idx = pos >> 5;
    const bit = 1 << (pos - (idx << 5));
    return (buf[idx] & bit) !== 0;
};

/**
 * @param {Uint32Array} buf
 * @param {number} pos
 * @returns {void}
 */
const setBit = (buf, pos) => {
    if (!Number.isInteger(pos) || pos < 0 || pos >= buf.length << 5) {
        return;
    }
    const idx = pos >> 5;
    const bit = 1 << (pos - (idx << 5));
    buf[idx] |= bit;
};

/**
 * @param {Uint32Array} buf
 * @param {number} pos
 * @returns {void}
 */
const clearBit = (buf, pos) => {
    if (!Number.isInteger(pos) || pos < 0 || pos >= buf.length << 5) {
        return;
    }
    const idx = pos >> 5;
    const bit = 1 << (pos - (idx << 5));
    buf[idx] = buf[idx] & ~bit;
};

// shuffle buffer for generating mines in chunks while avoiding repeats
/** @type {number[]} */
const POSITIONS = new Array(NUM_CHUNK_BITS).fill(0).map((_, idx) => idx);

/**
 * @param {unknown[]} arr
 * @param {number} num
 */
const shuffle = (arr, num) => {
    let i = arr.length;
    let j;
    let temp;

    // only randomize as many elements as we actually intend to consume
    let limit = Math.max(0, arr.length - num - 1);

    while (--i > limit) {
        j = Math.floor(Math.random() * (i + 1));
        temp = arr[j];
        arr[j] = arr[i];
        arr[i] = temp;
    }
};

/**
 * @param {number} numMines
 * @returns {Uint32Array}
 */
const genChunkMines = numMines => {
    const buf = new Uint32Array(BITFIELD_SIZE);
    shuffle(POSITIONS, numMines);

    let pos = POSITIONS.length - 1;
    for (let i = 0; pos >= 0 && i < numMines; i++) {
        const bitpos = POSITIONS[pos--];
        const idx = bitpos >> BITPOS_IDX_SHIFT;
        const bit = (1 << (bitpos & BITPOS_BITS_MASK)) >>> 0;
        buf[idx] |= bit;
    }

    return buf;
};

/**
 * Unset all bits in `buf2` from `buf1`
 *
 * @param {Uint32Array} buf1
 * @param {Uint32Array} buf2
 */
const bulkUnset = (buf1, buf2) => {
    for (let i = 0; i < buf1.length; i++) {
        buf1[i] = (buf1[i] & ~buf2[i]) >>> 0;
    }
};

/**
 * @param {Uint32Array} buf
 */
const printChunk = buf => {
    let bit = 0;
    for (let i = 0; i < CHUNK_EDGE_SIZE; i++) {
        let row = '';
        for (let j = 0; j < CHUNK_EDGE_SIZE; j++) {
            row += bitIsSet(buf, bit++) ? 'x' : ' ';
        }
        console.log(row);
    }
};

/**
 * @param {number[]} vals
 */
const printRandBuffer = vals => {
    console.log(
        vals.map(bitpos => {
            const idx = bitpos >> BITPOS_IDX_SHIFT;
            const bit = (1 << (bitpos & BITPOS_BITS_MASK)) >>> 0;
            return `${idx}:${bit.toString(2).padStart(32, '0')}`;
        }),
    );
};

/**
 *
 * @param {bigint} chunkid
 * @param {number} bitpos
 * @param {number} ox
 * @param {number} oy
 * @returns {[chunkid: bigint, bitpos: number]}
 */
const offset = (chunkid, bitpos, ox, oy) => {
    // this could possibly be made more efficient - would
    // require testing and benchmarking, and be complex
    const [x, y] = unpack(chunkid, bitpos);
    return pack(x + ox, y + oy);
};

/**
 * @param {bigint} chunkid
 * @param {number} bitpos
 * @returns {Generator<[chunkid: bigint, bitpos: number], void, unknown>}
 */
function* neighbors(chunkid, bitpos) {
    yield offset(chunkid, bitpos, -1, -1);
    yield offset(chunkid, bitpos, 0, -1);
    yield offset(chunkid, bitpos, +1, -1);

    yield offset(chunkid, bitpos, -1, 0);
    yield offset(chunkid, bitpos, +1, 0);

    yield offset(chunkid, bitpos, -1, +1);
    yield offset(chunkid, bitpos, 0, +1);
    yield offset(chunkid, bitpos, +1, +1);
}

/**
 * @param {number} value
 * @param {number} minInclusive
 * @param {number} maxExclusive
 */
const assertIntRange = (value, minInclusive, maxExclusive) => {
    if (!Number.isInteger(value))
        throw new Error(`Not a finite integer: ${value}`);
    if (value < minInclusive || value >= maxExclusive)
        throw new RangeError(
            `Not between [${minInclusive}, ${maxExclusive}): ${value}`,
        );
};

module.exports = {
    bitfield,
    setBit,
    clearBit,
    bitIsSet,
    bulkUnset,
    neighbors,
    pack,
    unpack,
    genChunkMines,
    printChunk,
    printRandBuffer,
    assertIntRange,
    CONSTANTS: {
        BIAS,
        COORD_SHIFT,
        COORD_MASK,
        CHUNK_SHIFT,
        CHUNK_MASK,
        CHUNK_EXPONENT,
        CHUNK_EDGE_SIZE,
        NUM_CHUNK_BITS,
        BITFIELD_SIZE,
        BITPOS_IDX_SHIFT,
        BITPOS_BITS_MASK,
    },
};
