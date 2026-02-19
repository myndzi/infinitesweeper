// @ts-check

const { BITFIELD_SIZE, CHUNK_EDGE_SIZE } = require('./constants');
const { pack } = require('./coords');

const bitfield = () => new Uint32Array(BITFIELD_SIZE);

/**
 * @param {Uint32Array} buf
 * @returns
 */
const bfstr = buf => {
    let strs = [];
    for (let y = 0; y < CHUNK_EDGE_SIZE; y++) {
        let row = '';
        for (let x = 0; x < CHUNK_EDGE_SIZE; x++) {
            row += bitIsSet(buf, pack.bitpos(x, y)) ? '1' : '0';
        }
        strs.push(row);
    }
    return strs.join('\n');
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

module.exports = {
    bitfield,
    setBit,
    clearBit,
    bitIsSet,
    bfstr,
    bulkUnset,
};
