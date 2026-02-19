import {
    type LegacyCellState,
    type LegacyChunk,
    type LegacyChunkCell,
    type LegacyCoord,
    type MaybeReason,
    splitKey,
} from './legacy.js';

const CHUNK_SIZE = 16;
const MINE_PROBABILITY = 0.19;
const MINE_ASSIGN_RADIUS = 3;

export type SafeZone = {
    x: number;
    y: number;
    radius: number;
};
export type GetChunkOptions = {
    includeMines: boolean;
};

export class Grid {
    chunks: Map<string, LegacyChunk>;
    cellStates: Map<string, LegacyCellState>;
    cellOwners: Map<string, string>;
    cellFlags: Map<string, boolean>;
    cellMines: Map<string, boolean>;
    cellNumbers: Map<string, number>;
    safeZones: SafeZone[];

    constructor() {
        this.chunks = new Map();
        this.cellStates = new Map();
        this.cellOwners = new Map();
        this.cellFlags = new Map();
        this.cellMines = new Map();
        this.cellNumbers = new Map();
        this.safeZones = [];
        console.log('Grid initialized - all data cleared');
    }

    getChunkKey(chunkX: number, chunkY: number) {
        return `${chunkX},${chunkY}`;
    }

    getCellKey(x: number, y: number) {
        return `${x},${y}`;
    }

    worldToChunk(x: number, y: number) {
        return {
            chunkX: Math.floor(x / CHUNK_SIZE),
            chunkY: Math.floor(y / CHUNK_SIZE),
            localX: ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
            localY: ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
        };
    }

    setSafeZones(safeZones: SafeZone[]) {
        this.safeZones = Array.isArray(safeZones) ? safeZones : [];
    }

    isWithinSafeZone(x: number, y: number) {
        for (const zone of this.safeZones) {
            const dx = Math.abs(x - zone.x);
            const dy = Math.abs(y - zone.y);
            if (Math.max(dx, dy) <= zone.radius) {
                return true;
            }
        }
        return false;
    }

    assignMine(x: number, y: number) {
        const cellKey = this.getCellKey(x, y);
        if (this.cellMines.has(cellKey)) {
            return this.cellMines.get(cellKey);
        }

        let isMine = false;
        if (!this.isWithinSafeZone(x, y)) {
            isMine = Math.random() < MINE_PROBABILITY;
        }

        this.cellMines.set(cellKey, isMine);
        return isMine;
    }

    countAdjacentMines(x: number, y: number) {
        let count = 0;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (this.isMine(nx, ny)) {
                    count++;
                }
            }
        }
        return count;
    }

    activateCell(x: number, y: number) {
        const cellKey = this.getCellKey(x, y);
        const isMine = this.assignMine(x, y);
        this.assignMinesInRadius(x, y, MINE_ASSIGN_RADIUS);
        if (!isMine) {
            const adjacentMines = this.countAdjacentMines(x, y);
            this.cellNumbers.set(cellKey, adjacentMines);
            return { isMine: false, adjacentMines };
        }
        return { isMine: true, adjacentMines: null };
    }

    isMine(x: number, y: number) {
        const cellKey = this.getCellKey(x, y);
        return this.cellMines.get(cellKey) || false;
    }

    assignMinesInRadius(x: number, y: number, radius: number) {
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                const nKey = this.getCellKey(nx, ny);
                if (this.cellMines.has(nKey)) continue;
                if (this.cellStates.get(nKey) === 'uncovered') {
                    this.cellMines.set(nKey, false);
                    continue;
                }
                this.assignMine(nx, ny);
            }
        }
    }

    hasAdjacentUncovered(x: number, y: number) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const nKey = this.getCellKey(x + dx, y + dy);
                if (this.cellStates.get(nKey) === 'uncovered') {
                    return true;
                }
            }
        }
        return false;
    }

    hasOtherPlayerNearby(
        x: number,
        y: number,
        playerId: string | null,
        radius: number,
    ) {
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                const nKey = this.getCellKey(x + dx, y + dy);
                const owner = this.cellOwners.get(nKey);
                if (
                    owner &&
                    owner !== playerId &&
                    this.cellStates.get(nKey) === 'uncovered'
                ) {
                    return true;
                }
            }
        }
        return false;
    }

    reserveSafeZone(
        x: number,
        y: number,
        radius: number,
        playerId: string | null = null,
    ) {
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                const nx = x + dx;
                const ny = y + dy;
                const nKey = this.getCellKey(nx, ny);
                if (this.cellStates.get(nKey) === 'uncovered') continue;
                const owner = this.cellOwners.get(nKey);
                if (owner && owner !== playerId) continue;
                this.cellMines.set(nKey, false);
                this.cellNumbers.delete(nKey);
                this.cellFlags.delete(nKey);
                const { chunkX, chunkY } = this.worldToChunk(nx, ny);
                this.chunks.delete(this.getChunkKey(chunkX, chunkY));
            }
        }
    }

    getChunk(
        chunkX: number,
        chunkY: number,
        options: GetChunkOptions | null = null,
    ): LegacyChunk {
        const key = this.getChunkKey(chunkX, chunkY);
        const includeMines = options && options.includeMines;

        if (!includeMines && this.chunks.has(key)) {
            return this.chunks.get(key)!;
        }

        const chunk: LegacyChunk = {
            x: chunkX,
            y: chunkY,
            cells: [],
        };

        const keys = new Set<string>();
        for (const cellKey of this.cellMines.keys()) {
            keys.add(cellKey);
        }
        for (const cellKey of this.cellStates.keys()) {
            keys.add(cellKey);
        }
        for (const cellKey of this.cellFlags.keys()) {
            keys.add(cellKey);
        }

        for (const [cellKey, state] of this.cellStates.entries()) {
            if (state !== 'uncovered') continue;
            const [x, y] = splitKey(cellKey);
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (
                        nx < chunkX * CHUNK_SIZE ||
                        nx >= (chunkX + 1) * CHUNK_SIZE
                    )
                        continue;
                    if (
                        ny < chunkY * CHUNK_SIZE ||
                        ny >= (chunkY + 1) * CHUNK_SIZE
                    )
                        continue;
                    keys.add(this.getCellKey(nx, ny));
                }
            }
        }

        for (const cellKey of keys) {
            const [x, y] = splitKey(cellKey);
            if (x < chunkX * CHUNK_SIZE || x >= (chunkX + 1) * CHUNK_SIZE)
                continue;
            if (y < chunkY * CHUNK_SIZE || y >= (chunkY + 1) * CHUNK_SIZE)
                continue;

            const isUncovered = this.cellStates.get(cellKey) === 'uncovered';
            chunk.cells.push({
                x,
                y,
                isMine: isUncovered
                    ? this.cellMines.get(cellKey) || false
                    : includeMines
                      ? this.cellMines.get(cellKey) || false
                      : false,
                adjacentMines: isUncovered
                    ? this.cellNumbers.has(cellKey)
                        ? this.cellNumbers.get(cellKey)
                        : this.countAdjacentMines(x, y)
                    : null,
                state: this.cellStates.get(cellKey) || 'covered',
                owner: this.cellOwners.get(cellKey) || null,
                flag: this.cellFlags.get(cellKey) || false,
            });
        }
        return chunk;
    }

    getCell(x: number, y: number) {
        const cellKey = this.getCellKey(x, y);
        return {
            x,
            y,
            isMine: this.cellMines.get(cellKey) || false,
            adjacentMines: this.cellNumbers.has(cellKey)
                ? this.cellNumbers.get(cellKey)
                : null,
            state: this.cellStates.get(cellKey) || 'covered',
            owner: this.cellOwners.get(cellKey) || null,
            flag: this.cellFlags.get(cellKey) || false,
        };
    }

    uncoverCell(
        x: number,
        y: number,
        playerId: string,
    ): MaybeReason<{ isMine: boolean; uncoveredCells: LegacyChunkCell[] }> {
        const cellKey = this.getCellKey(x, y);
        const currentState = this.cellStates.get(cellKey);

        if (currentState === 'uncovered') {
            return { success: false, reason: 'already_uncovered' };
        }

        if (this.cellFlags.get(cellKey)) {
            return { success: false, reason: 'flagged' };
        }

        const activation = this.activateCell(x, y);
        const isMine = activation.isMine;

        this.cellStates.set(cellKey, 'uncovered');
        this.cellOwners.set(cellKey, playerId);

        const chunksToInvalidate = new Set<string>();
        const { chunkX, chunkY } = this.worldToChunk(x, y);
        chunksToInvalidate.add(this.getChunkKey(chunkX, chunkY));

        for (let dx = -MINE_ASSIGN_RADIUS; dx <= MINE_ASSIGN_RADIUS; dx++) {
            for (let dy = -MINE_ASSIGN_RADIUS; dy <= MINE_ASSIGN_RADIUS; dy++) {
                const { chunkX: nChunkX, chunkY: nChunkY } = this.worldToChunk(
                    x + dx,
                    y + dy,
                );
                chunksToInvalidate.add(this.getChunkKey(nChunkX, nChunkY));
            }
        }

        const uncoveredCells: LegacyChunkCell[] = [
            { x, y, isMine, adjacentMines: activation.adjacentMines },
        ];

        if (!isMine && activation.adjacentMines === 0) {
            const toProcess = [{ x, y }];
            const processed = new Set([cellKey]);

            while (toProcess.length > 0) {
                const current = toProcess.shift()!;

                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;

                        const nx = current.x + dx;
                        const ny = current.y + dy;
                        const nKey = this.getCellKey(nx, ny);

                        if (processed.has(nKey)) continue;
                        processed.add(nKey);

                        if (this.cellStates.get(nKey) === 'uncovered') continue;
                        if (this.cellFlags.get(nKey)) continue;
                        const neighborActivation = this.activateCell(nx, ny);
                        if (neighborActivation.isMine) continue;
                        this.cellStates.set(nKey, 'uncovered');
                        this.cellOwners.set(nKey, playerId);

                        uncoveredCells.push({
                            x: nx,
                            y: ny,
                            isMine: false,
                            adjacentMines: neighborActivation.adjacentMines,
                        });

                        const { chunkX: nChunkX, chunkY: nChunkY } =
                            this.worldToChunk(nx, ny);
                        chunksToInvalidate.add(
                            this.getChunkKey(nChunkX, nChunkY),
                        );
                        for (
                            let ix = -MINE_ASSIGN_RADIUS;
                            ix <= MINE_ASSIGN_RADIUS;
                            ix++
                        ) {
                            for (
                                let iy = -MINE_ASSIGN_RADIUS;
                                iy <= MINE_ASSIGN_RADIUS;
                                iy++
                            ) {
                                const { chunkX: aChunkX, chunkY: aChunkY } =
                                    this.worldToChunk(nx + ix, ny + iy);
                                chunksToInvalidate.add(
                                    this.getChunkKey(aChunkX, aChunkY),
                                );
                            }
                        }

                        if (neighborActivation.adjacentMines === 0) {
                            toProcess.push({ x: nx, y: ny });
                        }
                    }
                }
            }
        }

        for (const chunkKey of chunksToInvalidate) {
            this.chunks.delete(chunkKey);
        }

        return { success: true, isMine, uncoveredCells };
    }

    toggleFlag(
        x: number,
        y: number,
        playerId: string,
    ): MaybeReason<{ flagged: boolean }> {
        const cellKey = this.getCellKey(x, y);

        if (this.cellStates.get(cellKey) === 'uncovered') {
            return { success: false, reason: 'already_uncovered' };
        }

        const currentFlag = this.cellFlags.get(cellKey);
        this.cellFlags.set(cellKey, !currentFlag);

        const { chunkX, chunkY } = this.worldToChunk(x, y);
        this.chunks.delete(this.getChunkKey(chunkX, chunkY));

        return { success: true, flagged: !currentFlag };
    }

    getPlayerCells(playerId: string) {
        const cells: LegacyCoord[] = [];
        for (const [key, owner] of this.cellOwners.entries()) {
            if (owner === playerId) {
                const [x, y] = splitKey(key);
                cells.push({ x, y });
            }
        }
        return cells;
    }

    clearPlayerCells(playerId: string, immediate = false) {
        const cellsToReset: LegacyCoord[] = [];
        const flagsToRemove: LegacyCoord[] = [];

        for (const [key, owner] of this.cellOwners.entries()) {
            if (owner === playerId) {
                const [x, y] = splitKey(key);
                cellsToReset.push({ x, y });

                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const adjKey = this.getCellKey(x + dx, y + dy);
                        if (this.cellFlags.get(adjKey)) {
                            const [fx, fy] = splitKey(adjKey);
                            flagsToRemove.push({ x: fx, y: fy });
                        }
                    }
                }
            }
        }

        for (const flag of flagsToRemove) {
            const flagKey = this.getCellKey(flag.x, flag.y);
            this.cellFlags.delete(flagKey);
            const { chunkX, chunkY } = this.worldToChunk(flag.x, flag.y);
            this.chunks.delete(this.getChunkKey(chunkX, chunkY));
        }

        return { cellsToReset, flagsToRemove };
    }

    recoverCell(x: number, y: number, playerId: string | null = null) {
        const cellKey = this.getCellKey(x, y);
        this.cellOwners.delete(cellKey);
        this.cellStates.delete(cellKey);
        this.cellFlags.delete(cellKey);
        this.cellMines.delete(cellKey);
        this.cellNumbers.delete(cellKey);

        const { chunkX, chunkY } = this.worldToChunk(x, y);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const neighborKey = this.getChunkKey(chunkX + dx, chunkY + dy);
                this.chunks.delete(neighborKey);
            }
        }

        for (let dx = -MINE_ASSIGN_RADIUS; dx <= MINE_ASSIGN_RADIUS; dx++) {
            for (let dy = -MINE_ASSIGN_RADIUS; dy <= MINE_ASSIGN_RADIUS; dy++) {
                const nx = x + dx;
                const ny = y + dy;
                const nKey = this.getCellKey(nx, ny);
                if (this.cellStates.get(nKey) === 'uncovered') continue;
                if (this.cellOwners.get(nKey)) continue;
                if (this.hasAdjacentUncovered(nx, ny)) continue;
                if (
                    this.hasOtherPlayerNearby(
                        nx,
                        ny,
                        playerId || null,
                        MINE_ASSIGN_RADIUS,
                    )
                )
                    continue;
                this.cellMines.delete(nKey);
                this.cellNumbers.delete(nKey);
                this.cellFlags.delete(nKey);
            }
        }

        return true;
    }
}
