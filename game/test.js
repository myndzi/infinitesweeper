// @ts-check

const Player = require('./Player');
const { chunkStore } = require('./ChunkStore');
const { playerStore } = require('./PlayerStore');

const { IntermediateRenderer } = require('./render/IntermediateRenderer');
const {
    stringRenderer,
    debugStringRenderer,
} = require('./render/StringRenderer');
const { setSeed, printMultipleChunks } = require('./util/chunkops');
const { setTrace } = require('./config');
const { humanCoords } = require('./util/coords');

const player = new Player('foo', 0, 0, '#ffffff');
const playerId = playerStore.add(player);

const ir = new IntermediateRenderer(playerId);

const seed = Math.random();
// const seed = 0.2558894648858858; //Math.random();
setSeed(seed.toString(36));

chunkStore.createSpawnChunk(0, 0);

// setTrace(packed => {
//     const { cx, cy, bx, by } = humanCoords(packed);
//     console.log('revealing', [cx, cy], [bx, by]);
//     printMultipleChunks(
//         chunkStore.renderWith(ir, stringRenderer, -7, -7, 24, 24),
//         { uniq: true },
//     );
//     console.log();
// });
// for (let i = 0; i < 1000; i++) {
chunkStore.iterativeReveal(3, 3, player);

printMultipleChunks(chunkStore.renderWith(ir, stringRenderer, -7, -7, 24, 24));
// printMultipleChunks(
//     chunkStore.renderWith(ir, debugStringRenderer, -7, -7, 24, 24),
//     ' ',
// );

console.log(seed);
// }
