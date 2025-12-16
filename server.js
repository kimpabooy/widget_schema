const express = require('express');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = 4000;

// Aktivera Helmet för säkerhetsheaders
app.use(helmet());
// Stäng av X-Powered-By headern
app.disable('x-powered-by');

// Servera statiska filer från screenshots-mappen
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));

// Lista alla bilder i screenshots-mappen
app.get('/screenshots/', (req, res) => {
    const fs = require('fs');
    const screenshotsDir = path.join(__dirname, 'screenshots');
    fs.readdir(screenshotsDir, (err, files) => {
        if (err) {
            return res.status(500).send('Kunde inte läsa mappen.');
        }
        // Filtrera bara bilder (png, jpg, jpeg)
        const imageFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f));
        if (!Array.isArray(imageFiles) || imageFiles.length === 0) {
            return res.send('<h2>Inga bilder hittades.</h2>');
        }
        const links = imageFiles.map(file => `<li><a href="/screenshots/${encodeURIComponent(file)}" target="_blank">${file}</a></li>`).join('');
        res.send(`<ul>${links}</ul>`);
    });
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