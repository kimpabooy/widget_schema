const { scrapeSingleWidgitPage } = require('./scraper');
const fs = require('fs');
const path = require('path');

// Läs konfigurationsfiler dynamiskt (ej cachad)
const getRows = () => JSON.parse(fs.readFileSync(path.join(__dirname, '../config/rows.json'), 'utf8'));
const getSettings = () => JSON.parse(fs.readFileSync(path.join(__dirname, '../config/settings.json'), 'utf8'));

const baseUrl = "https://widgitonline.com/doc/";

// Rensar bort bilder som inte längre har ett motsvarande schema
function cleanupOldImages(rows, settings) {
    const outputDir = path.join(__dirname, '..', settings.outputDir);

    // Kontrollera om mappen finns
    if (!fs.existsSync(outputDir)) {
        return; // Inga bilder att rensa
    }

    // Skapa en lista med alla förväntade filnamn baserat på rows.json filen
    const expectedFiles = new Set();
    for (const row of rows) {
        for (const day of Object.keys(row.days)) {
            for (const variant of settings.variants) {
                const filename = settings.baseFilename
                    .replace('{row}', row.name)
                    .replace('{day}', day)
                    .replace('{variant}', variant);
                expectedFiles.add(filename);
            }
        }
    }

    // Hämta alla filer i screenshots-mappen
    const existingFiles = fs.readdirSync(outputDir);

    // Ta bort filer som inte finns i förväntade listan (endast .png-filer)
    for (const file of existingFiles) {
        if (!expectedFiles.has(file)) {
            const filePath = path.join(outputDir, file);
            try {
                fs.unlinkSync(filePath);
                console.log(`Tog bort gammal bild: ${file}`);
            } catch (err) {
                console.error(`Kunde inte ta bort filen ${file}:`, err);
            }
        }
    }
}

// Main function for processing all schemas
async function processAll() {
    console.log("Startar Schemagenerering...");

    // Läs in aktuella scheman och inställningar
    const rows = getRows();
    const settings = getSettings();

    // Rensa bort bilder från borttagna scheman
    cleanupOldImages(rows, settings);

    // Loop through each row and day to scrape and save images
    for (const row of rows) {
        for (const [day, docId] of Object.entries(row.days)) { // day is key, docId is value, row.days = {"Mån": "docId1", "Tis": "docId2", ...and so on}
            try {
                const url = baseUrl + docId; // Construct the full URL
                console.log(`Hämtar ${row.name} - ${day}`);

                // Generate filenames for each variant
                let filenames = [];
                for (let i = 0; i < settings.variants.length; i++) {
                    const variant = settings.variants[i]; // e.g., "1a", "1b", etc.  if needed more variants, adjust config file
                    const filename = generateFilename(row.name, day, variant, settings); // e.g., "Schema_{RowName}_{Day}_{Variant}.png"
                    filenames.push(filename);
                }

                // Scrape the page and save images
                const images = await scrapeSingleWidgitPage(url, filenames, settings.outputDir);
                for (const img of images) {
                    console.log(`Sparade bild till: ${settings.outputDir}/${img}`);
                }
            } catch (error) {
                console.error(`Fel vid hämtning av ${row.name} - ${day}:`, error.message);
                // Fortsätter till nästa schema istället för att avbryta
            }
        }
    }
    console.log("Alla Scheman är hämtade!");
}

// Helper function to generate filenames based on the template in settings.json
function generateFilename(row, day, variant, settings) {
    return settings.baseFilename
        .replace('{row}', row)
        .replace('{day}', day)
        .replace('{variant}', variant);
}

module.exports = { processAll };