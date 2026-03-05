const { processAll } = require("./src/processor");
// let startTimer = Date.now();

processAll().then(() => {
    // let endTimer = Date.now();
    // let timeTaken = (endTimer - startTimer) / 1000; // Time in seconds
    // console.log(`Schemagenerering klar! Tid: ${timeTaken.toFixed(2)} sekunder`);
}).catch(err => {
    console.error('Fel vid processning:', err);
    process.exit(1);
});