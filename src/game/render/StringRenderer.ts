import { isDebug } from '../debug.js';
import { CHUNK_EDGE_SIZE } from '../util/constants.js';
import type { CellStateProps } from './CellState.js';
import type { Renderer } from './IntermediateRenderer.js';

/**
 * Render chunks as a string, e.g. for terminal or debugging use
 */
export class StringRenderer implements Renderer<string> {
    protected data: string[][];
    readonly emptyChunk: string;

    constructor(rows: number, cols: number) {
        this.data = new Array(rows)
            .fill(0)
            .map(() => new Array(cols).fill(0).map(() => '·'));
        this.emptyChunk = this.finish();
    }

    /**
     * Render an empty cell
     */
    empty(ox: number, oy: number) {
        // ox/oy are relative offsets into a chunk, so the size of the arrays
        // are known at construct time.
        // TODO: probably will change up the render interface, in which case this
        // will no longer be true
        this.data[oy]![ox]! = '·';
    }

    /**
     * Render a cell
     */
    render(ox: number, oy: number, props: CellStateProps) {
        let chr;
        if (props.isRevealed) {
            if (props.mineCount === 0) {
                chr = props.isMine && isDebug() ? '*' : ' ';
            } else {
                chr = props.mineCount.toString();
            }
        } else if (props.isFlagged) {
            chr = 'F';
        } else if (props.isOwnable) {
            chr = '°';
        } else {
            chr = '·';
        }

        this.data[oy]![ox] = chr;
    }

    /**
     * Return the rendered data
     *
     * @returns {string}
     */
    finish(): string {
        return this.data.map(row => row.join('')).join('\n');
    }
}

/**
 * Render the mine layout as a string, e.g. for terminal or debugging use
 */
export class DebugStringRenderer extends StringRenderer {
    render(ox: number, oy: number, props: CellStateProps) {
        if (props.isMine) {
            this.data[oy]![ox] = '*';
        } else if (props.isRevealed && props.mineCount > 0) {
            this.data[oy]![ox] = props.mineCount.toString();
        } else {
            this.data[oy]![ox] = '·';
        }
    }
}

export const stringRenderer = new StringRenderer(
    CHUNK_EDGE_SIZE,
    CHUNK_EDGE_SIZE,
);
export const debugStringRenderer = new DebugStringRenderer(
    CHUNK_EDGE_SIZE,
    CHUNK_EDGE_SIZE,
);
