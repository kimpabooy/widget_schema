const express = require('express');
const path = require('path');

const app = express();
const PORT = 4000;


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
        if (imageFiles.length === 0) {
            return res.send('<h2>Inga bilder hittades.</h2>');
        }
        const links = imageFiles.map(files => `<li><a href="/screenshots/${encodeURIComponent(files)}" target="_blank">${files}</a></li>`).join('');
        res.send(`<ul>${links}</ul>`);
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/screenshots`);
});