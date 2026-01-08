const { processAll } = require("./src/processor");

processAll().catch(err => {
    console.error('Fel vid processning:', err);
    process.exit(1);
});