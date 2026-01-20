const { processAll } = require('./src/processor');
const settings = require('./config/settings.json');
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const app = express();

// Sökväg till scheman JSON-fil
const SCHEMAS_PATH = path.join(__dirname, 'config', 'rows.json');

// Status för pågående uppdatering
let updateStatus = {
    isUpdating: false,
    startTime: null
};

// Hjälpfunktion för att escapa HTML och förhindra XSS ( Cross-Site Scripting )
const escapeHtml = (str) => String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Hjälpfunktion för att skapa fel med statuskod
const createError = (message, status) => {
    const error = new Error(message);
    error.status = status;
    return error;
};


// allowedFrameAncestors are used to allow embedding the site in specified domains.
const allowedFrameAncestors = [
    "'self'",
    "https://ankaret.utvecklingfalkenberg.se",
    "http://localhost:8080"
];

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "frame-ancestors": allowedFrameAncestors
            }
        }
    })
);

app.disable('x-powered-by'); // Döljer att servern kör Express
app.use(express.json());

// Servera frontend och statiska filer
app.use(express.static(path.join(__dirname, 'public')));

// Hjälpfunktion för att extrahera basnamn från filnamn (utan _1a/_1b suffix)
// Matchar t.ex. "Schema_227 EP_Fre_1a.png" -> "Schema_227 EP_Fre"
const getBaseSchemaName = (filename) => {
    const match = filename.match(/^(.+?)_1[ab]\.(png|jpg|jpeg)$/i);
    return match ? match[1] : null;
};

// --- Routes för Screenshots-galleriet --- //

// Lista alla bilder i screenshots-mappen
app.get('/screenshots/', (req, res, next) => {
    const screenshotsDir = path.join(__dirname, 'screenshots');
    fs.readdir(screenshotsDir, (err, files) => {
        if (err) {
            return next(createError('Kunde inte läsa mappen.', 500));
        }

        const imageFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f)).sort();

        // Gruppera bilder efter basnamn
        const groups = {};
        imageFiles.forEach(file => {
            const baseName = getBaseSchemaName(file);
            if (baseName) {
                if (!groups[baseName]) groups[baseName] = [];
                groups[baseName].push(file);
            }
        });

        let html = `
            <!DOCTYPE html>
            <html lang="sv">
            <head>
                <meta charset="UTF-8">
                <title>Schemagalleri</title>
                <link rel="icon" type="image/png" href="/images/WidgetSchemaIcon.png" />
                <link rel="stylesheet" href="/styles/styles.css" />
            </head>
            <body>
                <nav class="main-nav">
                    <a href="/" class="nav-link">Schemahantering</a>
                    <a href="/screenshots/" class="nav-link active">Schemagalleri</a>
                </nav>
        `;

        if (!Array.isArray(imageFiles) || imageFiles.length === 0) {
            html += '<h2>Inga bilder hittades.</h2>';
        } else {
            // Skapa listan med länkar
            const links = imageFiles.map(file => {
                const baseName = getBaseSchemaName(file);
                const group = baseName ? groups[baseName] : null;
                const hasPair = group && group.length === 2;

                // Skapa länk för enskild bild
                let linkHtml = `<li><a href="/screenshots/view/${encodeURIComponent(file)}?" target="_blank">${escapeHtml(file)}</a>`;

                // Skapa länk för att visa båda varianter om det finns 1a och 1b
                if (hasPair && file.includes('_1a.')) {
                    const pairUrl = `/screenshots/view/pair/${encodeURIComponent(baseName)}?`;
                    const pairName = `${baseName}.png`;
                    linkHtml += `<a href="${pairUrl}" class="pair-link" target="_blank">${escapeHtml(pairName)}</a>`;
                }

                linkHtml += `</li>`;
                return linkHtml;
            }).join('');
            html += `<ul>${links}</ul>`;
        }
        html += `</body></html>`;
        res.send(html);
    });
});

// Visa en enskild bild i HTML-wrapper (med favicon)
app.get('/screenshots/view/:filename', (req, res, next) => {
    const filename = req.params.filename;
    const screenshotsDir = path.join(__dirname, 'screenshots');
    const filePath = path.join(screenshotsDir, filename);

    if (!fs.existsSync(filePath)) {
        return next(createError('Bilden hittades inte.', 404));
    }

    const html = `
        <!DOCTYPE html>
        <html lang="sv">
        <head>
            <meta charset="UTF-8">
            <title>${escapeHtml(filename)}</title>
            <link rel="icon" type="image/png" href="/images/WidgetSchemaIcon.png" />
            <link rel="stylesheet" href="/styles/styles.css?v=2" />
        </head>
        <body class="single-image-page">
            <img src="/screenshots/${encodeURIComponent(filename)}?" alt="${escapeHtml(filename)}">
        </body>
        </html>
    `;
    res.send(html);
});

// Visa båda bildvarianterna (1a och 1b) bredvid varandra
app.get('/screenshots/view/pair/:baseName', (req, res, next) => {
    const baseName = req.params.baseName;
    if (!baseName) {
        return next(createError('Basnamn saknas.', 400));
    }

    const file1a = `${baseName}_1a.png`;
    const file1b = `${baseName}_1b.png`;
    const screenshotsDir = path.join(__dirname, 'screenshots');

    // Kontrollera att båda filerna finns
    const path1a = path.join(screenshotsDir, file1a);
    const path1b = path.join(screenshotsDir, file1b);

    if (!fs.existsSync(path1a) || !fs.existsSync(path1b)) {
        return next(createError('En eller båda bilderna hittades inte.', 404));
    }

    const html = `
        <!DOCTYPE html>
        <html lang="sv">
        <head>
            <meta charset="UTF-8">
            <title>Schema</title>
            <link rel="icon" type="image/png" href="/images/WidgetSchemaIcon.png" />
            <link rel="stylesheet" href="/styles/styles.css?v=2" />
        </head>
        <body class="pair-page">
            <img src="/screenshots/${encodeURIComponent(file1a)}?" alt="${escapeHtml(file1a)}">
            <img src="/screenshots/${encodeURIComponent(file1b)}?" alt="${escapeHtml(file1b)}">
        </body>
        </html>
    `;
    res.send(html);
});

// Statisk serving av screenshot-bilder (EFTER de specifika routerna)
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));

// --- API Endpoints --- //

// GET: Hämta alla scheman
app.get('/api/schemas', (req, res, next) => {
    if (!fs.existsSync(SCHEMAS_PATH)) return res.json([]);

    try {
        const data = JSON.parse(fs.readFileSync(SCHEMAS_PATH, 'utf8'));
        res.json(data);
    } catch (e) {
        next(createError('Serverfel, kunde inte läsa in Scheman.', 500));
    }
});

// POST: Lägg till nytt Schema
app.post('/api/schemas', (req, res, next) => {
    let data = [];

    if (fs.existsSync(SCHEMAS_PATH)) {
        try {
            data = JSON.parse(fs.readFileSync(SCHEMAS_PATH, 'utf8'));
        } catch (e) {
            return next(createError('Kunde inte läsa fil.', 500));
        }
    }

    let { name, days } = req.body;
    if (!name || typeof name !== 'string' || !days || typeof days !== 'object') {
        return next(createError('Felaktig data.', 400));
    }

    // Trimma och ersätt mellanslag med understreck
    name = name.trim().replace(/ +/g, "_");

    if (data.some(r => r.name === name)) {
        return next(createError('Schema med detta namn finns redan.', 409));
    }

    data.push({ name, days });
    fs.writeFileSync(SCHEMAS_PATH, JSON.stringify(data, null, 2), 'utf8');
    res.status(201).json({ success: true });
});

// DELETE: Ta bort schema
app.delete('/api/schemas/:name', (req, res, next) => {
    if (!fs.existsSync(SCHEMAS_PATH)) {
        return next(createError('Inget Schema hittat.', 404));
    }

    let data = [];
    try {
        data = JSON.parse(fs.readFileSync(SCHEMAS_PATH, 'utf8'));
    } catch {
        return next(createError('Kunde inte läsa fil.', 500));
    }

    const name = req.params.name;
    const idx = data.findIndex(r => r.name === name);

    if (idx === -1) {
        return next(createError('Schema hittades inte.', 404));
    }

    data.splice(idx, 1);
    fs.writeFileSync(SCHEMAS_PATH, JSON.stringify(data, null, 2), 'utf8');
    res.json({ success: true });
});

// POST: Hämta om alla scheman genom /api/update
app.post('/api/update', async (req, res, next) => {
    // Förhindra flera samtidiga uppdateringar
    if (updateStatus.isUpdating) {
        return res.json({ success: false, message: 'Uppdatering pågår redan.' });
    }

    updateStatus.isUpdating = true;
    updateStatus.startTime = Date.now();

    try {
        await processAll();
        updateStatus.isUpdating = false;
        updateStatus.startTime = null;
        res.json({ success: true, message: 'Alla Scheman har hämtats om.' });
    } catch (err) {
        updateStatus.isUpdating = false;
        updateStatus.startTime = null;
        next(createError(err.message, 500));
    }
});

// GET: Hämta uppdateringsstatus
app.get('/api/update/status', (req, res) => {
    res.json({
        isUpdating: updateStatus.isUpdating,
        elapsedSeconds: updateStatus.startTime ? Math.floor((Date.now() - updateStatus.startTime) / 1000) : 0
    });
});

// --- Error handling --- //

// om sidan inte hittas skickar den vidare error till error handler
app.use((req, res, next) => {
    const error = new Error('Sidan hittades inte');
    error.status = 404;
    next(error);
});

// Generell error handler - hanterar ALLA fel centralt
app.use((err, req, res, next) => {
    const status = err.status || 500;
    console.error(`[${status}] ${err.message}`);

    // JSON för API-requests, annars vanlig text
    if (req.path.startsWith('/api/')) {
        res.status(status).json({ error: err.message });
    } else {
        res.status(status).send(err.message || 'Något gick fel!');
    }
});

app.listen(settings.port, () => {
    console.log(`Server körs på http://localhost:${settings.port}/`);
});