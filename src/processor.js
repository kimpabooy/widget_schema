require('dotenv').config();
const { scrapeWidgitPage, scrapeGoogleSlidesPage } = require('./scraper');
const fs = require('fs');
const path = require('path');

// Läs konfigurationsfiler dynamiskt (ej cachad)
const getRows = () => JSON.parse(fs.readFileSync(path.join(__dirname, '../config/rows.json'), 'utf8'));
const getSettings = () => JSON.parse(fs.readFileSync(path.join(__dirname, '../config/settings.json'), 'utf8'));

const baseWidgetUrl = process.env.WIDGIT_BASE_URL;
const baseGoogleSlideUrl = process.env.GOOGLE_SLIDES_BASE_URL;

// Max antal samtidiga skrapningar för att undvika överbelastning. 
// Justera efter behov ( 5 - 10 är rekommenderat).
const MAX_CONCURRENT = 10;

// Rensar bort bilder som inte längre har ett motsvarande schema
function cleanupOldImages(rows, settings) {
    const outputDir = path.join(__dirname, '..', settings.outputDir);

    // Kontrollera om mappen finns
    if (!fs.existsSync(outputDir)) {
        return;
    }

    // Skapa en lista med alla förväntade filnamn baserat på rows.json filen
    const expectedFiles = new Set();
    // Widgit-scheman
    for (const row of rows.filter(r => !r.type || r.type === 'widgit')) {
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
    // Google Slides-scheman
    for (const row of rows.filter(r => r.type === 'googleslides')) {
        for (const day of Object.keys(row.days)) {
            const filename = settings.baseFileNameGoogleSlides
                .replace('{row}', row.name)
                .replace('{day}', day);
            expectedFiles.add(filename);
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

// Queue-funktion för parallell kö
async function runQueue(tasks) {
    let index = 0;
    let running = 0;

    return new Promise((resolve, reject) => {
        let finished = 0;

        function next() {
            while (running < MAX_CONCURRENT && index < tasks.length) {
                running++;
                const task = tasks[index++]();
                task.then(() => {
                    running--;
                    finished++;
                    if (finished === tasks.length) resolve();
                    else next();
                }).catch(err => {
                    running--;
                    finished++;
                    console.error('Task error:', err);
                    if (finished === tasks.length) resolve();
                    else next();
                });
            }
        }
        next();
    });
}

// Huvudfunktion för att processa alla scheman
async function processAll() {
    console.log("Startar Schemagenerering...");

    // Läs in aktuella scheman och inställningar
    const rows = getRows();
    const settings = getSettings();

    // Rensa bort bilder från borttagna scheman
    cleanupOldImages(rows, settings);

    // Parallell skrapning med begränsad samtidighet
    const tasks = [];
    for (const row of rows.filter(r => !r.type || r.type === 'widgit')) {
        for (const [day, docId] of Object.entries(row.days)) {
            tasks.push(async () => {
                try {
                    const url = baseWidgetUrl + docId;
                    console.log(`Hämtar ${row.name} - ${day}`);
                    let filenames = [];
                    for (let i = 0; i < settings.variants.length; i++) {
                        const variant = settings.variants[i];
                        const filename = generateFilename(row.name, day, variant, settings);
                        filenames.push(filename);
                    }
                    const images = await scrapeWidgitPage(url, filenames, settings.outputDir);
                    for (const img of images) {
                        console.log(`Sparade bild till: ${settings.outputDir}/${img}`);
                    }
                } catch (error) {
                    console.error(`Fel vid hämtning av ${row.name} - ${day}:`, error.message);
                }
            });
        }
    }

    await runQueue(tasks);
    await processAllGoogleSlides();

    console.log("\nAlla Scheman är hämtade!");
}

// Funktion för att processa alla Google Slides-scheman
async function processAllGoogleSlides() {
    console.log("Startar Google Slides-schemagenerering...");

    const rows = getRows();
    const settings = getSettings();

    // Parallell skrapning med begränsad samtidighet
    const tasks = [];
    for (const row of rows.filter(r => r.type === 'googleslides')) {
        for (const [day, docId] of Object.entries(row.days)) {
            tasks.push(async () => {
                try {
                    const filename = settings.baseFileNameGoogleSlides
                        .replace('{row}', row.name)
                        .replace('{day}', day);
                    const url = baseGoogleSlideUrl + docId;
                    console.log(`Hämtar ${row.name} - ${day}`);
                    const images = await scrapeGoogleSlidesPage(url, filename, settings.outputDir);
                    for (const img of images) {
                        console.log(`Sparade bild till: ${settings.outputDir}/${img}`);
                    }
                } catch (error) {
                    console.error(`Fel vid hämtning av Google Slides för ${row.name} - ${day}:`, error.message);
                }
            });
        }
    }

    await runQueue(tasks);
    console.log("Alla Google Slides-scheman är hämtade!");
}

// Funktion för att processa ett enskilt schema
async function processSingle(name) {
    console.log(`Startar omklippning av schema: ${name}`);
    const rows = getRows();
    const settings = getSettings();
    const row = rows.find(r => r.name === name);
    if (!row) {
        throw new Error(`Schema med namn '${name}' hittades inte.`);
    }
    // Widgit-schema parallellt
    const widgitTasks = [];
    if (!row.type || row.type === 'widgit') {
        for (const [day, docId] of Object.entries(row.days)) {
            widgitTasks.push(async () => {
                try {
                    const url = baseWidgetUrl + docId;
                    console.log(`Hämtar ${row.name} - ${day}`);
                    let filenames = [];
                    for (let i = 0; i < settings.variants.length; i++) {
                        const variant = settings.variants[i];
                        const filename = generateFilename(row.name, day, variant, settings);
                        filenames.push(filename);
                    }
                    const images = await scrapeWidgitPage(url, filenames, settings.outputDir);
                    for (const img of images) {
                        console.log(`Sparade bild till: ${settings.outputDir}/${img}`);
                    }
                } catch (error) {
                    console.error(`Fel vid hämtning av ${row.name} - ${day}:`, error.message);
                }
            });
        }
        await runQueue(widgitTasks);
    }
    // Google Slides-schema parallellt
    const googleslidesTasks = [];
    if (row.type === 'googleslides') {
        for (const [day, docId] of Object.entries(row.days)) {
            googleslidesTasks.push(async () => {
                try {
                    const filename = settings.baseFileNameGoogleSlides
                        .replace('{row}', row.name)
                        .replace('{day}', day);
                    const url = baseGoogleSlideUrl + docId;
                    console.log(`Hämtar ${row.name} - ${day}`);
                    const images = await scrapeGoogleSlidesPage(url, filename, settings.outputDir);
                    for (const img of images) {
                        console.log(`Sparade bild till: ${settings.outputDir}/${img}`);
                    }
                } catch (error) {
                    console.error(`Fel vid hämtning av Google Slides för ${row.name} - ${day}:`, error.message);
                }
            });
        }
        await runQueue(googleslidesTasks);
    }
    console.log(`Schema '${name}' är hämtat!`);
}
// Helper function to generate filenames based on the template in settings.json
function generateFilename(row, day, variant, settings) {
    return settings.baseFilename
        .replace('{row}', row)
        .replace('{day}', day)
        .replace('{variant}', variant);
}

module.exports = { processAll, processSingle };