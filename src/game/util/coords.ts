import type { Branded } from './branded.js';
import {
    BITPOS_MASK,
    BITPOS_SHIFT,
    CHUNK_EDGE_SIZE,
    CHUNK_MASK,
    CHUNK_SHIFT,
    PACK_MASK,
    PACK_SHIFT,
} from './constants.js';

// branded types to help keep everything straight and avoid errors

/** Chunk X coordinate, scaled (0, 1, 2...) */
export type ChunkX = Branded<number, 'ChunkX'>;
export const chunkX = (v: number) => v as ChunkX;

/** Chunk Y coordinate, scaled (0, 1, 2...) */
export type ChunkY = Branded<number, 'ChunkY'>;
export const chunkY = (v: number) => v as ChunkX;

export type PackedChunkCoord = Branded<bigint, 'PackedChunkCoord'>;

/** Chunk X coordinate, unscaled (0, 8, 16...) */
type ChunkXUnscaled = Branded<number, 'ChunkXUnscaled'>;

/** Chunk Y coordinate, unscaled (0, 8, 16...) */
type ChunkYUnscaled = Branded<number, 'ChunkYUnscaled'>;

/** Bitfield X coordinate */
export type BitfieldX = Branded<number, 'BitfieldX'>;
export const bitfieldX = (v: number) => v as BitfieldX;

/** Bitfield Y coordinate */
export type BitfieldY = Branded<number, 'BitfieldY'>;
export const bitfieldY = (v: number) => v as BitfieldY;

/** Packed coordinate with the bitfield coords cleared */
export type ChunkKey = Branded<bigint, 'ChunkKey'>;

/** Absolute cell coordinate, packed */
export type PackedCellCoord = Branded<bigint, 'PackedCellCoord'>;

export type PackedBitfieldCoord = Branded<number, 'PackedBitfieldCoord'>;

export type ChunkCoords = { cx: ChunkX; cy: ChunkY };
export type BitfieldCoords = { bx: BitfieldX; by: BitfieldY };

/**
 * Pack chunk coordinates together
 */
const packChunk = (cx: ChunkX, cy: ChunkY) =>
    ((BigInt(cy) << CHUNK_SHIFT) | BigInt(cx)) as PackedChunkCoord;

/**
 * Unpack chunk coordinates
 */
const unpackChunk = (packedChunk: PackedChunkCoord) =>
    ({
        cx: Number(packedChunk & CHUNK_MASK),
        cy: Number(packedChunk >> CHUNK_SHIFT),
    }) as ChunkCoords;

/**
 * Pack bitfield coordinates together
 */
const packBitpos = (bx: BitfieldX, by: BitfieldY) =>
    ((by << BITPOS_SHIFT) | bx) as PackedBitfieldCoord;

/**
 * Unpack bitfield coordinates
 *
 * @param {number} packedBitfield
 * @returns {{bx: number, by: number}}
 */
const unpackBitpos = (packed: PackedBitfieldCoord) =>
    ({
        bx: packed & BITPOS_MASK,
        by: packed >> BITPOS_SHIFT,
    }) as BitfieldCoords;

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
 */
export const pack = (absx: number, absy: number) => {
    const chunkpos = packChunk(
        (absx >>> BITPOS_SHIFT) as ChunkX,
        (absy >>> BITPOS_SHIFT) as ChunkY,
    );
    const bitpos = packBitpos(
        (absx & BITPOS_MASK) as BitfieldX,
        (absy & BITPOS_MASK) as BitfieldY,
    );

    return ((chunkpos << PACK_SHIFT) | BigInt(bitpos)) as PackedCellCoord;
};

/**
 * Pack the given cell coordinates and return the two components
 * separately.
 */
pack.split = (absx: number, absy: number) => {
    const chunkpos = packChunk(
        (absx >>> BITPOS_SHIFT) as ChunkX,
        (absy >>> BITPOS_SHIFT) as ChunkY,
    );
    const bitpos = packBitpos(
        (absx & BITPOS_MASK) as BitfieldX,
        (absy & BITPOS_MASK) as BitfieldY,
    );
    return [chunkpos << PACK_SHIFT, bitpos] as [ChunkKey, PackedBitfieldCoord];
};

/**
 * Return a packed coordinate representing a chunk key
 * for the given _chunk_ coordinates.
 *
 * Example: (10,10) might be chunk (1, 1) bitfield (2, 2)
 *
 * pack.chunkKey(1, 1) === chunkKey(pack(10, 10))
 */
pack.chunkKey = (cx: number, cy: number) =>
    (packChunk(
        (cx >>> BITPOS_SHIFT) as ChunkX,
        (cy >>> BITPOS_SHIFT) as ChunkY,
    ) << PACK_SHIFT) as ChunkKey;

pack.chunk = packChunk as (cx: number, cy: number) => PackedChunkCoord;
pack.bitpos = packBitpos as (bx: number, by: number) => PackedBitfieldCoord;

/**
 * Unpack a packed coordinate into absolute coordinates
 */
export const unpack = (
    packed: PackedCellCoord,
): { absx: number; absy: number } => {
    const { bx, by } = unpackBitpos(
        Number(packed & PACK_MASK) as PackedBitfieldCoord,
    );
    const { cx, cy } = unpackChunk((packed >> PACK_SHIFT) as PackedChunkCoord);

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
 */
export const chunkKey = (packed: PackedCellCoord) =>
    (packed & PACK_INVERSE_MASK) as ChunkKey;

/**
 * Return the bitfield position of a packed coordinate,
 * suitable for use in updating bitfields.
 */
export const bitpos = (packed: PackedCellCoord) =>
    (Number(packed & PACK_MASK) >>> 0) as PackedBitfieldCoord;

/**
 * Split a packed coordinate into the chunk key and
 * bitfield position portions, and return them both.
 */
export const split = (packed: PackedCellCoord) =>
    [packed & PACK_INVERSE_MASK, Number(packed & PACK_MASK) >>> 0] as [
        ChunkKey,
        PackedBitfieldCoord,
    ];

/**
 * Unpack a packed coordinate into a chunk (x, y) and a bitfield
 * (x, y) value, suitable for debugging and display.
 */
export const humanCoords = (
    packed: PackedCellCoord | ChunkKey,
): ChunkCoords & BitfieldCoords => {
    const { absx, absy } = unpack(packed as PackedCellCoord);
    return {
        cx: (absx >> BITPOS_SHIFT) as ChunkX,
        cy: (absy >> BITPOS_SHIFT) as ChunkY,
        bx: ((absx >>> 0) & BITPOS_MASK) as BitfieldX,
        by: ((absy >>> 0) & BITPOS_MASK) as BitfieldY,
    };
};

/**
 * Given a packed coordinate, return a new packed coordinate
 * with the given cell offsets applied.
 */
export const offset = (
    packed: PackedCellCoord,
    ox: number,
    oy: number,
): PackedCellCoord => {
    // this could possibly be made more efficient - would
    // require testing and benchmarking, and be complex
    const { absx, absy } = unpack(packed);
    return pack(absx + ox, absy + oy);
};

/**
 * Given a chunk key, return a new chunk key with the given
 * chunk offsets applied.
 */
offset.chunkKey = (key: ChunkKey, ox: number, oy: number): ChunkKey => {
    const { absx, absy } = unpack((key & PACK_INVERSE_MASK) as PackedCellCoord);
    return pack(
        absx + ox * CHUNK_EDGE_SIZE,
        absy + oy * CHUNK_EDGE_SIZE,
    ) as unknown as ChunkKey;
};

/**
 * Given a packed cell coordinate, yield packed
 * coordinates for the 8 neighboring cells
 */
export function* neighbors(packed: PackedCellCoord) {
    yield offset(packed, -1, -1);
    yield offset(packed, 0, -1);
    yield offset(packed, +1, -1);

    yield offset(packed, -1, 0);
    yield offset(packed, +1, 0);

    yield offset(packed, -1, +1);
    yield offset(packed, 0, +1);
    yield offset(packed, +1, +1);
}
