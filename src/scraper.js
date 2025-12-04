const { chromium } = require('playwright');

// Huvudfunktion för att skrapa Schema
async function scrapeSingleWidgitPage(url, filenames, outputDir = "screenshots") {
    const browser = await chromium.launch();
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
    await browser.close();
    return screenshotPaths;
}

// Help function to scrape the page and find the grid element
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

module.exports = { scrapeSingleWidgitPage };
