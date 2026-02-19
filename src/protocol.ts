import type { LegacyChunk, LegacyCoord, LegacyUpdate } from './game/legacy.js';
import type { SerializedPlayer } from './game/Player.js';

export type InitialData = {
    playerId: string;
    player: SerializedPlayer;
    activePlayers: SerializedPlayer[];
};

export type RequestChunks = {
    debug?: boolean;
    debugToken?: string;
    chunkKeys: string[];
};

export type Login = {
    username: string;
    password: string;
};
type AdminMaybe<T = {}> =
    | ({ success: true } & T)
    | { success: false; error?: string };
export type LoginResult = AdminMaybe<{ token: string }>;

export type ActivePlayers = { activePlayers: SerializedPlayer[] };
export type ClearedCells = { playerId: string; cells: LegacyCoord[] };

type Authenticated<T = {}> = T & { token: string };

export type AdminMessage = { title: string; text: string };
export type SetAiPlayers = { count: number };
export type AdminStats = { playerCount: number; aiCount: number };
export type PeriodicGameUpdate = { type?: undefined; updates: LegacyUpdate[] };
export type PeriodicLeaderboardUpdate = {
    id: string;
    score: number;
}[];

export interface ServerToClientEvents {
    init: (data: InitialData) => void;
    playerJoined: (data: SerializedPlayer) => void;
    playerLeft: (data: string) => void;
    gameUpdate: (data: LegacyUpdate | PeriodicGameUpdate) => void;
    chunks: (data: LegacyChunk[]) => void;
    debugInvalid: () => void;
    activePlayers: (data: ActivePlayers) => void;
    error: (data: string) => void;
    cellsCleared: (data: ClearedCells) => void;
    adminLoginResult: (data: LoginResult) => void;
    adminBroadcastResult: (data: AdminMaybe) => void;
    adminMessage: (data: AdminMessage) => void;
    adminSetAIPlayersResult: (data: AdminMaybe<SetAiPlayers>) => void;
    adminStats: (data: AdminStats) => void;
    leaderboard: (data: PeriodicLeaderboardUpdate) => void;
}

export interface ClientToServerEvents {
    initGame: () => void;
    requestChunks: (data: RequestChunks) => void;
    requestActivePlayers: () => void;
    move: (data: LegacyCoord) => void;
    flag: (data: LegacyCoord) => void;
    chord: (data: LegacyCoord) => void;
    debugSpawn: (data: LegacyCoord) => void;
    adminLogin: (data: Login) => void;
    adminBroadcast: (data: Authenticated<AdminMessage>) => void;
    adminSetAIPlayers: (data: Authenticated<SetAiPlayers>) => void;
    requestAdminStats: (data: Authenticated) => void;
}

export interface InterServerEvents {}

export interface SocketData {}
