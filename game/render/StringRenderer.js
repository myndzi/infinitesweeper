// @ts-check

const { isDebug } = require('../config');
const { CHUNK_EDGE_SIZE } = require('../util/constants');

/**
 * Render chunks as a string, e.g. for terminal or debugging use
 *
 * @typedef {import('./IntermediateRenderer').Renderer<string>} Interface
 * @implements {Interface}
 */
class StringRenderer {
    /**
     * @protected
     * @type {string[][]}
     */
    data;

    /**
     * @readonly
     * @type {string}
     */
    emptyChunk;

    /**
     * @param {number} rows
     * @param {number} cols
     */
    constructor(rows, cols) {
        this.data = new Array(rows)
            .fill(0)
            .map(() => new Array(cols).fill(0).map(() => '·'));
        this.emptyChunk = this.finish();
    }

    /**
     * Render an empty cell
     *
     * @param {number} ox
     * @param {number} oy
     */
    empty(ox, oy) {
        this.data[oy][ox] = '·';
    }

    /**
     * Render a cell
     *
     * @param {number} ox
     * @param {number} oy
     * @param {import('./CellState').CellStateProps} props
     */
    render(ox, oy, props) {
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

        this.data[oy][ox] = chr;
    }

    /**
     * Return the rendered data
     *
     * @returns {string}
     */
    finish() {
        return this.data.map(row => row.join('')).join('\n');
    }
}

/**
 * Render the mine layout as a string, e.g. for terminal or debugging use
 */
class DebugStringRenderer extends StringRenderer {
    /**
     * @param {number} ox
     * @param {number} oy
     * @param {import('./CellState').CellStateProps} props
     */
    render(ox, oy, props) {
        if (props.isMine) {
            this.data[oy][ox] = '*';
        } else if (props.isRevealed && props.mineCount > 0) {
            this.data[oy][ox] = props.mineCount.toString();
        } else {
            this.data[oy][ox] = '·';
        }
    }
}

const stringRenderer = new StringRenderer(CHUNK_EDGE_SIZE, CHUNK_EDGE_SIZE);
const debugStringRenderer = new DebugStringRenderer(
    CHUNK_EDGE_SIZE,
    CHUNK_EDGE_SIZE,
);

module.exports = {
    StringRenderer,
    stringRenderer,
    DebugStringRenderer,
    debugStringRenderer,
};
