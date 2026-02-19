import type { Branded } from './branded.js';
import { BITFIELD_SIZE, CHUNK_EDGE_SIZE } from './constants.js';
import { pack } from './coords.js';

export type Bitfield = Branded<Uint32Array, 'Bitfield'>;

export const bitfield = () => new Uint32Array(BITFIELD_SIZE) as Bitfield;

export const bfstr = (buf: Bitfield) => {
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

export const bitIsSet = (buf: Bitfield, pos: number): boolean => {
    if (!Number.isInteger(pos) || pos < 0 || pos >= buf.length << 5) {
        return false;
    }
    const idx = pos >> 5;
    const bit = 1 << (pos - (idx << 5));
    return (buf[idx]! & bit) !== 0;
};

export const setBit = (buf: Bitfield, pos: number): void => {
    if (!Number.isInteger(pos) || pos < 0 || pos >= buf.length << 5) {
        return;
    }
    const idx = pos >> 5;
    const bit = 1 << (pos - (idx << 5));
    buf[idx]! |= bit;
};

export const clearBit = (buf: Bitfield, pos: number): void => {
    if (!Number.isInteger(pos) || pos < 0 || pos >= buf.length << 5) {
        return;
    }
    const idx = pos >> 5;
    const bit = 1 << (pos - (idx << 5));
    buf[idx] = buf[idx]! & ~bit;
};

/**
 * Unset all bits in `buf2` from `buf1`
 */
export const bulkUnset = (buf1: Bitfield, buf2: Bitfield) => {
    for (let i = 0; i < buf1.length; i++) {
        buf1[i] = (buf1[i]! & ~buf2[i]!) >>> 0;
    }
};
