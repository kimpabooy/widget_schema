const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Search path to the JSON file.
const filePath = path.join(__dirname, '..', 'config', 'rows.json');

// Function to add a new row
function addRow(row) {

    // Read existing rows
    let data = [];
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        try {
            data = JSON.parse(fileContent);
        } catch (error) {
            console.error('Fel vid tolkning av JSON:', error);
            return;
        }
    }

    data.push(row);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log('\nRad tillagd:', row);
}

// Checks if the script is run directly as a script (not imported as a module)
// if the file run directly, start interactive mode
// else just export the addRow function for use in other files
if (require.main === module) {
    const readLine = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const days = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre'];
    let row = { name: '', days: {} };
    let currentDayIndex = 0;

    // Ask for the title of the row
    function questionTitle() {
        readLine.question('Ange en Titel: ', (title) => {
            row.name = title.trim();
            questionDay();
        });
    }

    // Ask about each day recursively
    function questionDay() {
        // If all days are processed, save the row and exit
        if (currentDayIndex >= days.length) {
            readLine.close();
            addRow(row);
            return;
        }

        // Ask about the current day in the days list
        const day = days[currentDayIndex];
        readLine.question(`Vill du lägga till dokument-id för ${day}? (j/n): `, (yesOrNo) => {
            const answer = yesOrNo.trim().toLowerCase();

            if (answer === 'j') {
                questionDocumentId(day);
            }
            else if (answer === 'n') {
                currentDayIndex++;
                questionDay();
            }
            else {
                console.log("Skriv 'j' för ja eller 'n' för nej.");
                questionDay();
            }
        });
    }

    // Ask for document ID for a specific day
    function questionDocumentId(day) {
        readLine.question(`Ange dokument-id för ${day}: `, (id) => {
            row.days[day] = id.trim();
            currentDayIndex++;
            questionDay();
        });
    }

    questionTitle();
}