import type { Player } from './Player.js';
import type { Branded } from './util/branded.js';

/**
 * An integer used to represent ownership in the game state.
 * Assigned values are kept as low as possible and reused
 * after released: there are approximately 20 bits available
 * (see render/CellState) to represent player ownership of
 * cells.
 *
 * `0` is never assigned and can be used to represent
 * undefined / no player id
 */
export type SyntheticPlayerId = Branded<number, 'SyntheticPlayerId'>;
export const UNDEFINED_PLAYER_ID = 0 as SyntheticPlayerId;

export class PlayerStore {
    private next: SyntheticPlayerId = 1 as SyntheticPlayerId;
    private free: SyntheticPlayerId[] = [];
    private players: Map<SyntheticPlayerId, Player> = new Map();
    private ids: Map<Player, SyntheticPlayerId> = new Map();

    add(player: Player): SyntheticPlayerId {
        let id = this.ids.get(player);
        if (id !== undefined) return id;

        id = (this.free.pop() ?? this.next++) as SyntheticPlayerId;

        this.players.set(id, player);
        this.ids.set(player, id);

        return id;
    }

    getId(player: Player): SyntheticPlayerId | undefined {
        return this.ids.get(player);
    }

    expectId(player: Player): SyntheticPlayerId {
        const id = this.ids.get(player);
        if (id === undefined) {
            throw new Error(
                `Player ${player.id} unexpectedly not found in PlayerStore`,
            );
        }
        return id;
    }

    get(id: SyntheticPlayerId): Player | undefined {
        return this.players.get(id);
    }

    del(idOrPlayer: SyntheticPlayerId | Player): boolean {
        const id =
            typeof idOrPlayer === 'number'
                ? idOrPlayer
                : this.ids.get(idOrPlayer);

        if (id === undefined || !this.players.has(id)) return false;

        // avoid free list if possible
        if (id === this.next - 1) {
            this.next--;
        } else {
            this.free.push(id);
            // arrange free list to recover id space when possible
            this.free.sort((a, b) => a - b);
        }

        const player = this.players.get(id)!;
        this.players.delete(id);
        this.ids.delete(player);

        return true;
    }
}

export const playerStore = new PlayerStore();
