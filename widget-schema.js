const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://widgitonline.com/doc/71358bc50d1c91d3a8341d41af16ff6b');


    // Hämta alla scheman
    const containers = await page.$$('div.flashcard-page-container');

    for (let i = 0; i < containers.length; i++) {
        const card = await containers[i].$('div.flashcard-positioned-item');
        await card.screenshot({ path: `screenshots/Schema${i + 1}.png` });
    }

    // ---------------------
    await context.close();
    await browser.close();
})();