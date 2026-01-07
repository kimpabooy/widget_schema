const { processAll } = require('./src/processor');
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 4000;

app.use(helmet());
app.disable('x-powered-by');
app.use(express.json());

// Servera frontend och statiska filer
app.use(express.static(path.join(__dirname, 'public')));
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));

// API: Hämta alla scheman
app.get('/api/schemas', (req, res) => {
    const filePath = path.join(__dirname, 'config', 'rows.json');
    if (!fs.existsSync(filePath)) return res.json([]);
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: 'Kunde inte läsa scheman.' });
    }
});

// API: Lägg till nytt schema
app.post('/api/schemas', (req, res) => {
    const filePath = path.join(__dirname, 'config', 'rows.json');
    let data = [];
    if (fs.existsSync(filePath)) {
        try {
            data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch { }
    }
    const { name, days } = req.body;
    if (!name || typeof name !== 'string' || !days || typeof days !== 'object') {
        return res.status(400).json({ error: 'Felaktig data.' });
    }
    if (data.some(r => r.name === name)) {
        return res.status(409).json({ error: 'Schema med detta namn finns redan.' });
    }
    data.push({ name, days });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    res.status(201).json({ success: true });
});

// API: Ta bort schema
app.delete('/api/schemas/:name', (req, res) => {
    const filePath = path.join(__dirname, 'config', 'rows.json');
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Inget schema hittat.' });
    let data = [];
    try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return res.status(500).json({ error: 'Kunde inte läsa fil.' });
    }
    const name = req.params.name;
    const idx = data.findIndex(r => r.name === name);
    if (idx === -1) return res.status(404).json({ error: 'Schema hittades inte.' });
    data.splice(idx, 1);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    res.json({ success: true });
});

// Lista alla bilder i screenshots-mappen
app.get('/screenshots/', (req, res) => {
    const screenshotsDir = path.join(__dirname, 'screenshots');
    fs.readdir(screenshotsDir, (err, files) => {
        if (err) {
            return res.status(500).send('Kunde inte läsa mappen.');
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
            const links = imageFiles.map(file => `<li><a href="/screenshots/${encodeURIComponent(file)}" target="_blank">${file}</a></li>`).join('');
            html += `<ul>${links}</ul>`;
        }
        html += `</body></html>`;
        res.send(html);
    });
});

// Hämta om alla scheman genom /api/update 
app.post('/api/update', async (req, res) => {
    try {
        await processAll();
        res.json({ success: true, message: 'Alla scheman har hämtats om.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// 404 handler
app.use((req, res, next) => {
    res.status(404).send("Sorry, can't find that!");
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.listen(PORT);