
const settings = require('../config/settings.json');

function generateFilename(row, day, variant) {
    return settings.baseFilename
        .replace('{row}', row)
        .replace('{day}', day)
        .replace('{variant}', variant);
}

module.exports = { generateFilename };