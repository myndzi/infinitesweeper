export class Player {
    id: string;
    x: number;
    y: number;
    color: string;
    score: number;
    alive: boolean;

    constructor(id: string, x: number, y: number, color: string) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.color = color;
        this.score = 0;
        this.alive = true;
    }

    addScore(points: number) {
        this.score += points;
    }

    die() {
        this.alive = false;
    }

    respawn(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.alive = true;
    }

    toJSON() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            color: this.color,
            score: this.score,
            alive: this.alive,
        };
    }
}
