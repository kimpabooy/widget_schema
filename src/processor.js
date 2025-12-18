// Get dependencies and config from other files
const { scrapeSingleWidgitPage } = require('./scraper');
const rows = require('../config/rows.json');
const fs = require('fs');
const settings = require('../config/settings.json');
const baseUrl = "https://widgitonline.com/doc/";
const PORT = 4000;

// Main function for processing all schemas
async function processAll() {
    console.log("Startar schemagenerering...");

    // Loop through each row and day to scrape and save images
    for (const row of rows) {
        for (const [day, docId] of Object.entries(row.days)) { // day is key, docId is value, row.days = {"Mån": "docId1", "Tis": "docId2", ...and so on}
            const url = baseUrl + docId; // Construct the full URL
            console.log(`Hämtar ${row.name} - ${day}`);

            // Generate filenames for each variant
            let filenames = [];
            for (let i = 0; i < settings.variants.length; i++) {
                const variant = settings.variants[i]; // e.g., "1a", "1b", etc.  if needed more variants, adjust config file
                const filename = generateFilename(row.name, day, variant); // e.g., "Schema_{RowName}_{Day}_{Variant}.png"
                filenames.push(filename);
            }

            // Scrape the page and save images
            const images = await scrapeSingleWidgitPage(url, filenames, settings.outputDir);
            for (const img of images) {
                console.log(`Sparade bild till: ${settings.outputDir}/${img}`);
            }
        }
    }
    console.log("Alla scheman är hämtade!");
    console.log(`Öppna sidan: http://localhost:${PORT}/`);
}

// Helper function to generate filenames based on the template in settings.json
function generateFilename(row, day, variant) {
    return settings.baseFilename
        .replace('{row}', row)
        .replace('{day}', day)
        .replace('{variant}', variant);
}

module.exports = { processAll };