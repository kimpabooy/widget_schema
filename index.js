const { processAll } = require("./src/processor");
const MAX_CONCURRENT = 10; // Samtidiga Playwright-processer
// let startTimer = Date.now();

processAll(MAX_CONCURRENT).then(() => {
    // let endTimer = Date.now();
    // let timeTaken = (endTimer - startTimer) / 1000; // Time in seconds
    // console.log(`Schemagenerering klar! Tid: ${timeTaken.toFixed(2)} sekunder`);
}).catch(err => {
    console.error('Fel vid processning:', err);
    process.exit(1);
});