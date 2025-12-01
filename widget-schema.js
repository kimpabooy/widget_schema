const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false }); // Sätt headless till false för att se webbläsaren, true för att köra i bakgrunden
    const context = await browser.newContext(); // Skapa en ny webbläsarkontext
    const page = await context.newPage(); // Skapa en ny sida i kontexten
    const pageToVisit = 'https://widgitonline.com/doc/71358bc50d1c91d3a8341d41af16ff6b';
    

    // Gå till den specifika sidan
    await page.goto(pageToVisit);

    // Vänta på att sidan är helt laddad
    await page.waitForLoadState('networkidle');

        // Dölj menyerna innan screenshot
    await page.evaluate(() => {
        const header = document.querySelector('.page-header.logged-out');
        if (header) header.style.display = 'none';
        const menu = document.querySelector('.view-document-menu');
        if (menu) menu.style.display = 'none';
        const notice = document.querySelector('.notification.notice');
        if (notice) notice.style.display = 'none';
    });

    // Hämta alla scheman
    const containers = await page.$$('div.flashcard-page-container');

    // Ta screenshot av varje schema inuti varje container och spara dem med unika namn
    for (let i = 0; i < containers.length; i++) {
        const card = await containers[i].$('div.flashcard-positioned-item');
        await card.screenshot({ path: `screenshots/Schema${i + 1}.png` });
    }

    // ---------------------
    await context.close();
    await browser.close();
})();