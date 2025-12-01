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


    // Hämta alla scheman (varje container motsvarar ett schema på sidan)
    const containers = await page.$$('div.flashcard-page-container');

    // Loopa igenom varje schema/container
    for (let i = 0; i < containers.length; i++) {
        const inners = await containers[i].$$('div.flashcard-positioned-item-inner');
        let grid = null;
        
        // Hitta rutnäts-elementet i första inre elementet som har ett
        for (const inner of inners) {
            grid = await findGridElement(inner);
            if (grid) break;
        }
        // Ta screenshot av rutnätet om det hittades
        if (grid) {
            await grid.screenshot({ path: `screenshots/Schema${i + 1}.png` });
        }
    }

    // Funktion som hittar rutnäts-elementet (barn med flest egna barn)
    async function findGridElement(inner) {
        const children = await inner.$$('div');
        let maxChild = null;
        let maxCount = 0;
        // Loopa igenom barnen för att hitta det med flest egna barn
        for (const child of children) {
            const count = await child.evaluate(el => el.children.length);
            // Uppdatera maxCount och maxChild om nuvarande barn har fler barn.
            if (count > maxCount) {
                maxCount = count;
                maxChild = child;
            }
        }
        return maxChild;
    }

    // ---------------------
    await context.close();
    await browser.close();
})();