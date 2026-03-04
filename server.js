require('dotenv').config();
const { processAll, processSingle } = require('./src/processor');
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

// Hjälpfunktion för att extrahera basnamn från filnamn (utan _1a/_1b suffix och utan prefix)
// Matchar t.ex. "Schema_227 EP_Fre_1a.png" -> "227 EP_Fre"
const getBaseSchemaName = (filename) => {
    const match = filename.match(/^(.+?)_1[ab]\.(png|jpg|jpeg)$/i);
    if (!match) return null;
    // Ta bort Schema_- eller GoogleSchema_-prefix
    return match[1].replace(/^(Schema_|GoogleSchema_)/, '');
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

        // Gruppera bilder efter basnamn och hantera GoogleSchema separat
        // Spara även originalt baseName med prefix för rätt länkning
        const groups = {};
        const baseNameWithPrefixMap = {};
        const googleSchemas = [];
        imageFiles.forEach(file => {
            if (file.startsWith('GoogleSchema_')) {
                googleSchemas.push(file);
                return;
            }
            // Hämta baseName utan prefix
            const baseName = getBaseSchemaName(file);
            // Hämta baseName MED prefix (för länkning)
            const match = file.match(/^(.+)_1[ab]\.(png|jpg|jpeg)$/i);
            const baseNameWithPrefix = match ? match[1] : null;
            if (baseName && baseNameWithPrefix) {
                if (!groups[baseName]) groups[baseName] = [];
                groups[baseName].push(file);
                baseNameWithPrefixMap[baseName] = baseNameWithPrefix;
            }
        });

        let html = `
            <!DOCTYPE html>
            <html lang="sv">
            <head>
                <meta charset="UTF-8">
                <title>Schemagalleri</title>
                <link rel="icon" type="image/png" href="/images/WidgetSchemaIcon.png" />
                <link rel="stylesheet" href="/styles/styles.css?v=${Date.now()}" />
            </head>
            <body>
                <nav class="main-nav">
                    <a href="/" class="nav-link">Schemahantering</a>
                    <a href="/screenshots/" class="nav-link active">Schemagalleri</a>
                </nav>
                <h1 style="text-align:center; margin-bottom:0.5em;">Schemagalleri</h1>
        `;

        if (!Array.isArray(imageFiles) || imageFiles.length === 0) {
            html += '<h2>Inga bilder hittades.</h2>';
        } else {
            html += `<div class="gallery-grid">`;
            // Visa vanliga grupperade scheman
            Object.entries(groups).forEach(([baseName, files]) => {
                html += `<div class="gallery-card">`;
                html += `<div class="gallery-card-title">${escapeHtml(baseName)}</div>`;
                html += `<div class="gallery-card-images">`;
                files.forEach(f => {
                    html += `<a href="/screenshots/view/${encodeURIComponent(f)}?" target="_blank"><img src="/screenshots/${encodeURIComponent(f)}?thumb=1" alt="${escapeHtml(f)}" class="gallery-img"></a>`;
                });
                html += `</div>`;
                if (files.length === 2) {
                    // Använd baseName med prefix i länken
                    const baseNameWithPrefix = baseNameWithPrefixMap[baseName] || baseName;
                    html += `<div class="gallery-card-links"><a href="/screenshots/view/pair/${encodeURIComponent(baseNameWithPrefix)}?" target="_blank">Länk till Schemat</a></div>`;
                }
                html += `</div>`;
            });
            // Visa GoogleSchema-bilder som egna kort, med filnamnet som rubrik (utan prefix)
            googleSchemas.forEach(f => {
                let title = f.replace(/\.(png|jpg|jpeg)$/i, '').replace(/^(Schema_|GoogleSchema_)/, '');
                html += `<div class="gallery-card">`;
                html += `<div class="gallery-card-title">${escapeHtml(title)}</div>`;
                html += `<div class="gallery-card-images">`;
                html += `<a href="/screenshots/view/${encodeURIComponent(f)}?" target="_blank"><img src="/screenshots/${encodeURIComponent(f)}?thumb=1" alt="${escapeHtml(f)}" class="gallery-img"></a>`;
                html += `</div>`;
                html += `<div class="gallery-card-links"><a href="/screenshots/view/${encodeURIComponent(f)}?" target="_blank">Länk till Schemat</a></div>`;
                html += `</div>`;
            });
            html += `</div>`;
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

    // Om det är en Google Slides-bild, använd särskild klass
    const isGoogleSlide = filename.startsWith('GoogleSchema_');
    const pageClass = isGoogleSlide ? 'google-slide-image-page' : 'single-image-page';
    // Ta bort prefix för visningstitel
    let displayTitle = filename.replace(/\.(png|jpg|jpeg)$/i, '').replace(/^(Schema_|GoogleSchema_)/, '');
    const html = `
    <!DOCTYPE html>
    <html lang="sv">
    <head>
        <meta charset="UTF-8">
        <title>${escapeHtml(displayTitle)}</title>
        <link rel="icon" type="image/png" href="/images/WidgetSchemaIcon.png" />
        <link rel="stylesheet" href="/styles/styles.css?v=${Date.now()}" />
    </head>
    <body class="${pageClass}">
        <img src="/screenshots/${encodeURIComponent(filename)}?" alt="${escapeHtml(displayTitle)}">
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
            <link rel="stylesheet" href="/styles/styles.css?v=${Date.now()}" />
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

    let { name, type, days } = req.body;
    if (!name || typeof name !== 'string' || !days || typeof days !== 'object') {
        return next(createError('Felaktig data.', 400));
    }

    // Trimma och ersätt mellanslag med understreck
    name = name.trim().replace(/ +/g, "_");
    type = typeof type === 'string' ? type : 'widgit';

    if (data.some(r => r.name === name)) {
        return next(createError('Schema med detta namn finns redan.', 409));
    }

    data.push({ name, type, days });
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

// POST: Hämta om ett enskilt schema genom /api/update/:name
app.post('/api/update/:name', async (req, res, next) => {
    const name = req.params.name;
    if (updateStatus.isUpdating) {
        return res.json({ success: false, message: 'Uppdatering pågår redan.' });
    }
    updateStatus.isUpdating = true;
    updateStatus.startTime = Date.now();
    try {
        await processSingle(name);
        updateStatus.isUpdating = false;
        updateStatus.startTime = null;
        res.json({ success: true, message: `Schemat '${name}' har hämtats om.` });
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

const port = process.env.PORT || settings.port || 4000;
app.listen(port, () => {
    console.log(`Server körs på http://localhost:${port}/`);
});