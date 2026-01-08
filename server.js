const { processAll } = require('./src/processor');
const settings = require('./config/settings.json');
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const app = express();

// Sökväg till scheman JSON-fil
const SCHEMAS_PATH = path.join(__dirname, 'config', 'rows.json');

// Hjälpfunktion för att escapa HTML och förhindra XSS ( Cross-Site Scripting )
const escapeHtml = (str) => String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Hjälpfunktion för att skapa fel med statuskod
const createError = (message, status) => {
    const error = new Error(message);
    error.status = status;
    return error;
};

app.use(helmet());
app.disable('x-powered-by');
app.use(express.json());

// Servera frontend och statiska filer
app.use(express.static(path.join(__dirname, 'public')));
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

    const { name, days } = req.body;
    if (!name || typeof name !== 'string' || !days || typeof days !== 'object') {
        return next(createError('Felaktig data.', 400));
    }

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

// Lista alla bilder i screenshots-mappen
app.get('/screenshots/', (req, res, next) => {
    const screenshotsDir = path.join(__dirname, 'screenshots');
    fs.readdir(screenshotsDir, (err, files) => {
        if (err) {
            return next(createError('Kunde inte läsa mappen.', 500));
        }

        const imageFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f));
        let html = `
            <!DOCTYPE html>
            <html lang="sv">
            <head>
                <meta charset="UTF-8">
                <title>Schemagalleri</title>
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
            const links = imageFiles.map(file => `<li><a href="/screenshots/${encodeURIComponent(file)}" target="_blank">${escapeHtml(file)}</a></li>`).join('');
            html += `<ul>${links}</ul>`;
        }
        html += `</body></html>`;
        res.send(html);
    });
});

// POST Hämta om alla scheman genom /api/update 
app.post('/api/update', async (req, res, next) => {
    try {
        await processAll();
        res.json({ success: true, message: 'Alla Scheman har hämtats om.' });
    } catch (err) {
        next(createError(err.message, 500));
    }
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