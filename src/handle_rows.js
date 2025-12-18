const readline = require('readline');
const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'config', 'rows.json');

// Create readline interface for user input
const readLine = readline.createInterface({
    input: process.stdin, // stdin standard input (tangentbord)
    output: process.stdout // stdout standard output (konsolen)
});

// Help function to read and parse JSON file with error handling
function readJsonFile(filePath, onError) {
    if (!fs.existsSync(filePath)) return [];
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(fileContent);
    } catch (error) {
        if (onError) {
            onError(error);
        } else {
            console.error('Fel vid tolkning av JSON:', error);
        }
        return [];
    }
}

// Show the main menu
function showMenu() {

    // Menu options, add more if needed
    const menuOptions = [
        'Visa alla scheman',
        'Lägg till ett schema',
        'Ta bort ett schema',
        'Rensa skärmen',
        'Avsluta'
    ];
    console.log('\n--- Schema hantering ---\n');
    menuOptions.forEach((option, idx) => {
        console.log(`${idx + 1}. ${option}`);
    });
    readLine.question(`\nVälj ett alternativ (1-${menuOptions.length}): `, handleMenu);
}

function handleMenu(choice) {
    switch (choice.trim()) {
        case '1':
            listRows();
            break;
        case '2':
            console.clear();
            addRow();
            break;
        case '3':
            console.clear();
            deleteRow();
            break;
        case '4':
            console.clear();
            showMenu();
            break;
        case '5':
            console.clear();
            readLine.close();
            break;
        default:
            console.clear();
            showMenu();
    }
}

// List all rows/schemas from the JSON file
function listRows() {
    let rows = readJsonFile(filePath, (error) => {
        console.error('Fel vid tolkning av JSON:', error);
    });

    // Display all objects/schemas in the rows.json in a readable format
    if (rows.length === 0) {
        console.log('Inga objekt hittades.');
    } else {
        console.log('\nAlla scheman:\n');
        rows.forEach((row, index) => {
            console.log(`${index + 1}. Namn: ${row.name}`);
            for (const [day, docId] of Object.entries(row.days)) {
                console.log(` - DokumentID för ${day}: ${docId}`);
            }
            console.log('');
        });
    }

    readLine.question('Tryck på Enter för att återgå till menyn...', () => {
        console.clear();
        showMenu();
    });
}

// Add a new row/schema to the JSON file
function addRow() {
    const days = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre'];
    let row = { name: '', days: {} };
    let currentDayIndex = 0;

    // Asking for the title/name of the new schema
    function questionTitle() {
        readLine.question('\nGe schemat ett namn (eller skriv "q" för att avbryta) \nNamn: ', (inputName) => {
            const name = inputName.trim();
            if (name.length === 0) {
                console.clear();
                console.log('Namnet kan inte vara tomt. Försök igen.');
                questionTitle();
                return;
            }
            if (name.toLowerCase() === 'q') {
                console.clear();
                showMenu();
                return;
            }

            // Error check
            let data = readJsonFile(filePath, (error) => {
                console.error('Fel vid tolkning av JSON:', error);
                showMenu();
            });

            // Check for duplicate names
            if (!Array.isArray(data)) data = [];
            const exists = data.some(r => r.name === name);
            if (exists) {
                console.clear();
                console.log('Det finns redan ett schema med det namnet. Ange ett unikt namn.');
                questionTitle();
                return;
            }
            row.name = name;
            questionDay();
        });
    }

    // Ask if user wants to add document IDs for certain days
    function questionDay() {
        if (currentDayIndex >= days.length) {

            //Error check
            let data = readJsonFile(filePath, (error) => {
                console.error('Fel vid tolkning av JSON:', error);
                showMenu();
            });

            // Append the new row and save back to the file
            if (!Array.isArray(data)) data = [];
            data.push(row);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

            console.clear();
            console.log('\nFöljande schema har lagts till:\n', row);
            showMenu();
            return;
        }

        // Looping through all days to ask for document IDs
        const day = days[currentDayIndex];
        readLine.question(`\nVill du lägga till dokument-id för ${day}? (j/n): \n`, (yesOrNo) => {
            const answer = yesOrNo.trim().toLowerCase();

            if (answer === 'j') {
                questionDocumentId(day);
            } else if (answer === 'n') {
                currentDayIndex++;
                questionDay();
            } else {
                console.log("\nSkriv 'j' för ja eller 'n' för nej.\n");
                questionDay();
            }
        });
        console.clear();
    }

    // Ask for the document ID for a specific day
    function questionDocumentId(day) {
        readLine.question(`Ange dokument-id för ${day}: `, (id) => {
            row.days[day] = id.trim();
            currentDayIndex++;
            questionDay();
        });
    }

    questionTitle();
}

// Delete a row/schema from the JSON file
function deleteRow() {
    readLine.question('\nAnge namn på Schemat som du vill tas bort (eller skriv "q" för att avbryta) \nNamn: ', (titel) => {
        const input = titel.trim();

        if (input.toLowerCase() === 'q') {
            console.clear();
            showMenu();
            return;
        }

        if (input.length === 0) {
            console.clear();
            console.log('Du måste ange ett namn. Försök igen.');
            deleteRow();
            return;
        }

        if (!fs.existsSync(filePath)) {
            console.log('Inget schema hittat att ta bort.');
            showMenu();
            return;
        }

        // Read the JSON file content
        const fileContent = fs.readFileSync(filePath, 'utf8');
        let data;
        try {
            data = JSON.parse(fileContent);
        } catch (error) {
            console.error('Fel vid tolkning av JSON objekt:', error);
            showMenu();
            return;
        }

        // Find the index of the object to delete
        const index = data.findIndex(indexRow => indexRow.name === input);
        if (index === -1) {
            console.log('Ingen rad med det namnet hittades, försök igen.\n');
            deleteRow();
            return;
        }

        // Confirm deletion
        const objekt = data[index];
        console.log('\nFöljande schema hittades:\n');
        console.log(JSON.stringify(objekt, null, 2));

        function securityQuestion() {
            readLine.question(`\nVill du verkligen ta bort detta schemat? (j/n): `, (answer) => {
                const choice = answer.trim().toLowerCase();

                if (choice === 'j') {
                    readLine.question(`Bekräfta borttagning genom att skriva in det "${objekt.name}" :  `, (confirmation) => {
                        if (confirmation.trim() === objekt.name) {
                            data.splice(index, 1);
                            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
                            console.clear();
                            console.log('Schemat är borttaget.');
                        } else {
                            console.log('Fel namn. Inget schema togs bort.');
                        }
                        showMenu();
                    });
                } else if (choice === 'n') {
                    console.log('Inget schema togs bort.');
                    showMenu();
                } else {
                    console.log("\nSkriv 'j' för ja eller 'n' för nej.\n");
                    securityQuestion();
                }
            });
        }
        securityQuestion();
    });
}

showMenu();