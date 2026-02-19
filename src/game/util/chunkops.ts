import Rand from 'rand-seed';

import {
    BITPOS_IDX_SHIFT,
    BITPOS_BITS_MASK,
    NUM_CHUNK_BITS,
} from './constants.js';
import { bitfield, type Bitfield } from './bitfield.js';

let rng = new Rand();

export const setSeed = (seed: string) => (rng = new Rand(seed));

// shuffle buffer for generating mines in chunks while avoiding repeats
const POSITIONS: number[] = new Array(NUM_CHUNK_BITS)
    .fill(0)
    .map((_, idx) => idx);

const shuffle = (arr: unknown[], num: number) => {
    let i = arr.length;
    let j;
    let temp;

    // only randomize as many elements as we actually intend to consume
    let limit = Math.max(0, arr.length - num - 1);

    while (--i > limit) {
        j = Math.floor(rng.next() * (i + 1));
        temp = arr[j];
        arr[j] = arr[i];
        arr[i] = temp;
    }
};

/**
 * Generate a bitfield with a uniform distribution of mines
 */
export const genChunkMines = (numMines: number): Bitfield => {
    const buf = bitfield();
    shuffle(POSITIONS, numMines);

    let pos = POSITIONS.length - 1;
    for (let i = 0; pos >= 0 && i < numMines; i++) {
        const bitpos = POSITIONS[pos--]!;
        const idx = bitpos >> BITPOS_IDX_SHIFT;
        const bit = (1 << (bitpos & BITPOS_BITS_MASK)) >>> 0;
        buf[idx]! |= bit;
    }

    return buf;
};

// hack for avoiding vscode's logline combining when debugging
let _uniq = 0;

/**
 * Takes a 2d array of chunks rendered as strings and recombines
 * them so that horizontal chunks are joined (e.g. for printing
 * to a terminal)
 */
export const printMultipleChunks = (
    rendered: string[][],
    opts: { sep?: string; uniq?: boolean } = {},
) => {
    const sep = opts.sep ?? '';
    const uniq = opts.uniq ?? false;

    for (let y = 0; y < rendered.length; y++) {
        const chunkrow = rendered[y]!;

        /** @type {string[]} */
        const rows: string[] = [];
        for (let x = 0; x < rendered.length; x++) {
            const strs = chunkrow[x]!.split('\n');

            for (let i = 0; i < strs.length; i++) {
                rows[i] ??= '';
                rows[i] += sep + strs[i];
            }
        }
        for (let row of rows) {
            if (uniq) {
                if ((_uniq = 1 - _uniq) === 1) row += ' ';
            }
            console.log(row);
        }
        if (sep) console.log(sep);
    }
};
