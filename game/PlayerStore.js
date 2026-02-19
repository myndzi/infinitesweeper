// @ts-check

/** @typedef {import('./Player')} Player*/

class PlayerStore {
    /**
     * @private
     * @type {number}
     */
    next = 1;

    /**
     * @private
     * @type {number[]}
     */
    free = [];

    /**
     * @private
     * @type {Map<number, Player>}
     */
    players = new Map();

    /**
     * @private
     * @type {Map<Player, number>}
     */
    ids = new Map();

    /**
     * @param {Player} player
     * @returns {number}
     */
    add(player) {
        let id = this.ids.get(player);
        if (id !== undefined) return id;

        id = this.free.pop() ?? this.next++;

        this.players.set(id, player);
        this.ids.set(player, id);

        return id;
    }

    /**
     * @param {Player} player
     * @returns {number|undefined}
     */
    getId(player) {
        return this.ids.get(player);
    }

    /**
     * @param {Player} player
     * @returns {number}
     */
    expectId(player) {
        const id = this.ids.get(player);
        if (id === undefined) {
            throw new Error(
                `Player ${player.id} unexpectedly not found in PlayerStore`,
            );
        }
        return id;
    }

    /**
     * @param {number} id
     * @returns {Player|undefined}
     */
    get(id) {
        return this.players.get(id);
    }

    /**
     * @param {number|Player} idOrPlayer
     * @returns {boolean}
     */
    del(idOrPlayer) {
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

        const player = /** @type {Player} */ (this.players.get(id));
        this.players.delete(id);
        this.ids.delete(player);

        return true;
    }
}

const playerStore = new PlayerStore();
module.exports = { PlayerStore, playerStore };
