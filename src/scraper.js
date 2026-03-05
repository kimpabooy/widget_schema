const { chromium } = require('playwright');

// --- Huvudfunktion för att skrapa Schema Widgit-sida ---
async function scrapeWidgitPage(url, filenames, outputDir) {
    const browser = await chromium.launch();
    // const browser = await chromium.launch({ headless: false, slowMo: 3000 }); // Debugging mode

    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        let screenshotPaths = [];

        await page.goto(url, { waitUntil: 'networkidle' });

        // Hide menus before taking the screenshots
        await page.evaluate(() => {
            const selectors = [
                '.page-header.logged-out',
                '.view-document-menu',
                '.notification.notice'
            ];
            selectors.forEach(selector => {
                const element = document.querySelector(selector);
                if (element) element.style.display = 'none';
            });
        });

        // Get all schemas (flashcard containers)
        const containers = await page.$$('div.flashcard-page-container');

        // Loop through each schema/container
        for (let i = 0; i < containers.length; i++) {
            const inners = await containers[i].$$('div.flashcard-positioned-item-inner');

            // Find the grid element in the first inner element that has one
            let grid = null;
            for (const inner of inners) {
                grid = await findGridElement(inner);
                if (grid) break;
            }

            // Take screenshot of the grid if found
            if (grid && filenames[i]) {
                const filename = filenames[i];
                await grid.screenshot({ path: `${outputDir}/${filename}` });
                screenshotPaths.push(filename);
            }
        }

        return screenshotPaths;
    } finally {
        await browser.close();
    }
}

// --- Help function to scrape the page and find the grid element ---
async function findGridElement(inner) {
    const children = await inner.$$('div');
    let maxChild = null;
    let maxCount = 0;

    for (const child of children) {
        const count = await child.evaluate(element => element.children.length);
        if (count > maxCount) {
            maxCount = count;
            maxChild = child;
        }
    }
    return maxChild;
}

// --- Skrapa Google Slides ---
async function scrapeGoogleSlidesPage(url, filename, outputDir) {
    const browser = await chromium.launch();
    // const browser = await chromium.launch({ headless: false, slowMo: 1000 }); // Debugging mode
    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        let screenshotPaths = [];

        await page.goto(url, { waitUntil: 'networkidle' });

        // Vänta på SVG-elementet
        const svg = await page.waitForSelector('.sketchyViewerContent svg');
        if (!svg) throw new Error('SVG-elementet hittades inte!');

        // Hämta bounding box för SVG-elementet
        const svgArea = await svg.boundingBox();
        if (!svgArea) throw new Error('Kunde inte hämta bounding box för SVG!');

        // Ta screenshot av endast SVG-området
        await page.screenshot({
            path: `${outputDir}/${filename}`,
            clip: svgArea
        });
        screenshotPaths.push(filename);

        return screenshotPaths;
    } finally {
        await browser.close();
    }
}

module.exports = { scrapeWidgitPage, scrapeGoogleSlidesPage };
