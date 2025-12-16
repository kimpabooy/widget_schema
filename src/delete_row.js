const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Search path to the JSON file.
const filePath = path.join(__dirname, '..', 'config', 'rows.json');

function deleteRow(row) {

    // if file does not exist, return
    if (!fs.existsSync(filePath)) {
        console.log('Ingen data att ta bort.');
        return;
    }

    // Read existing rows
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let data;
    try {
        data = JSON.parse(fileContent);
    }
    catch (error) {
        console.error('Fel vid tolkning av JSON objekt:', error);
        return;
    }

    // Find the row/object to delete
    const index = data.findIndex(indexRow => indexRow.name === row);
    if (index === -1) {
        console.log('Ingen rad med titeln hittades.');
        return;
    }

    const objekt = data[index];
    return { data, index, objekt };
}

// If the script is run directly, start interactive mode
if (require.main === module) {
    const readLine = readline.createInterface({
        input: process.stdin, // stdin = standard input
        output: process.stdout // stdout = standard output
    });

    // Ask for the title of the row to delete
    readLine.question('Ange titel på raden som ska tas bort: ', (titel) => {
        const result = deleteRow(titel.trim());
        if (!result || result.index === -1) {
            readLine.close();
            return;
        }

        const { data, index, objekt } = result;
        console.log('Följande objekt hittades:');
        console.log(JSON.stringify(objekt, null, 2));

        // Security question before deletion
        function securityQuestion() {
            readLine.question('Vill du verkligen ta bort detta objekt? (j/n): ', (answer) => {
                const choice = answer.trim().toLowerCase();

                if (choice === 'j') {
                    readLine.question('Bekräfta borttagning genom att skriva in titeln igen: ', (confirmation) => {
                        if (confirmation.trim() === objekt.name) {
                            data.splice(index, 1);
                            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
                            console.log('Objektet är borttaget.');
                        } else {
                            console.log('Fel titel. Ingen rad togs bort.');
                        }
                        readLine.close();
                    }
                    );
                } else if (choice === 'n') {
                    console.log('Ingen rad togs bort.');
                    readLine.close();
                } else {
                    console.log("Skriv 'j' för ja eller 'n' för nej.");
                    securityQuestion();
                }
            });
        }

        // Start the security question process
        securityQuestion();
    });
}