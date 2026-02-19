export type LegacyCellState = 'covered' | 'uncovered';
export type LegacyChunkCell = {
    x: number;
    y: number;
    isMine: boolean;
    adjacentMines?: number | null | undefined;
    state?: LegacyCellState | undefined;
    owner?: string | null | undefined;
    flag?: boolean | undefined;
};
export type LegacyPlayerData = {
    player: {
        id: string;
        x: number;
        y: number;
        color: string;
        score: number;
        alive: boolean;
    };
    uncoveredCells: LegacyChunkCell[];
};
export type LegacyCoord = { x: number; y: number };
export type LegacyPlayerCoord = LegacyCoord & { playerId: string };
export type LegacyFlagged = LegacyCoord & { flagged: true };
export type LegacyChunk = LegacyCoord & { cells: LegacyChunkCell[] };

export namespace Update {
    export type Move = {
        type: 'move';
        playerId: string;
        uncoveredCells: LegacyChunkCell[];
        score: number;
    };
    export type Flag = {
        type: 'flag';
        playerId: string;
        x: number;
        y: number;
        flagged: boolean;
        uncoveredCells?: undefined;
    };
    export type Autoflag = {
        type: 'autoFlag';
        playerId: string;
        flags: LegacyFlagged[];
        uncoveredCells?: undefined;
    };
    export type Spawn = {
        type: 'spawn';
        playerId: string;
        uncoveredCells: LegacyChunkCell[];
        score?: undefined;
    };
    export type Respawn = {
        type: 'respawn';
        playerId: string;
        x: number;
        y: number;
        uncoveredCells: LegacyChunkCell[] | undefined;
    };
    export type Death = {
        type: 'death';
        playerId: string;
        mineCell: LegacyCoord;
        playerCells: LegacyCoord[];
        uncoveredCells: LegacyChunkCell[];
        score: number;
        finalScore: number;
    };
    export type NoMoves = {
        type: 'noMoves';
        playerId: string;
        playerCells?: LegacyCoord[];
        uncoveredCells: LegacyChunkCell[];
        score: number;
        finalScore: number;
    };
}

export type LegacyUpdate =
    | Update.Move
    | Update.Flag
    | Update.Autoflag
    | Update.Spawn
    | Update.Respawn
    | Update.Death
    | Update.NoMoves;

export const splitKey = (v: string) =>
    v.split(',').map(Number) as [number, number];

export type LegacyAction = {
    type: 'move' | 'flag' | 'chord';
    x: number;
    y: number;
    isGuess: boolean;
    focusMove: boolean;
};

export type Maybe<T> =
    | {
          success: false;
          error: string;
      }
    | {
          success: true;
          update: T;
      };

type AllUndefined<T> = { [K in keyof T]?: undefined };
export type MaybeReason<T> =
    | ({
          success: false;
          reason: string;
      } & AllUndefined<T>)
    | ({
          success: true;
      } & T);

export const pickRandom = <T>(arr: T[]): T | undefined =>
    arr[Math.floor(Math.random() * arr.length)];
export const expectRandom = <T>(arr: T[]): T => {
    if (arr.length === 0) throw new Error(`expectRandom called on empty array`);
    return arr[Math.floor(Math.random() * arr.length)]!;
};
