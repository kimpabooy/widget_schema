// Get dependencies and config from other files
const { scrapeSingleWidgitPage } = require('./scraper');
const { generateFilename } = require('./utils');
const fs = require('fs');

const rows = require('../config/rows.json');
const settings = require('../config/settings.json');
const baseUrl = "https://widgitonline.com/doc/";

// Main function for processing all schemas
async function processAll() {
    console.log("Startar schemagenerering...");

    for (const row of rows) {
        for (const [day, id] of Object.entries(row.days)) {
            const url = baseUrl + id;
            console.log(`Hämtar ${row.name} - ${day}`);

            // Generate filenames for each variant
            let filenames = [];
            for (let i = 0; i < settings.variants.length; i++) {
                const variant = settings.variants[i];
                const filename = generateFilename(row.name, day, variant);
                filenames.push(filename);
            }

            // Scrape the page and save images
            const images = await scrapeSingleWidgitPage(url, filenames, settings.outputDir);
            for (const img of images) {
                console.log(`Sparade bild till: ${settings.outputDir}/${img}`);
            }
        }
    }
    console.log("Klar!");
}

module.exports = { processAll };
