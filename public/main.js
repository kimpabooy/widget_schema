const DAYS = ["Mån", "Tis", "Ons", "Tor", "Fre"];

// Hjälpfunktion för att återställa knapp efter timeout
function resetButton(btn, originalText, delay = 2500) {
    setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
    }, delay);
}

const daysInputs = document.getElementById('days-inputs');
DAYS.forEach(day => {
    const label = document.createElement('label');
    label.textContent = `Dokument-ID för ${day}: `;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = `day-${day}`;
    label.appendChild(input);
    daysInputs.appendChild(label);
});

// Lägg till "Uppdatera alla scheman"-knapp
window.addEventListener('DOMContentLoaded', async () => {
    const updateBtn = document.createElement('button');
    const originalText = 'Uppdatera alla Scheman';
    let intervalId = null;

    // Funktion för att starta timer-visning
    function startTimer(startSeconds = 0) {
        let seconds = startSeconds;
        updateBtn.disabled = true;
        updateBtn.textContent = `Uppdaterar... (${seconds}s)`;
        intervalId = setInterval(() => {
            seconds++;
            updateBtn.textContent = `Uppdaterar... (${seconds}s)`;
        }, 1000);
    }

    // Funktion för att stoppa timer och återställa knapp
    function stopTimer(message, delay = 2500) {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        updateBtn.textContent = message;
        setTimeout(() => {
            updateBtn.textContent = originalText;
            updateBtn.disabled = false;
        }, delay);
    }

    // Funktion för att kolla och följa uppdateringsstatus
    async function checkUpdateStatus() {
        try {
            const res = await fetch('/api/update/status');
            const status = await res.json();

            if (status.isUpdating) {
                startTimer(status.elapsedSeconds);
                // Fortsätt polla status tills uppdateringen är klar
                const pollInterval = setInterval(async () => {
                    const pollRes = await fetch('/api/update/status');
                    const pollStatus = await pollRes.json();
                    if (!pollStatus.isUpdating) {
                        clearInterval(pollInterval);
                        stopTimer('Alla scheman har hämtats om!');
                        fetchSchemas();
                    }
                }, 1000);
            }
        } catch (err) {
            console.error('Kunde inte hämta uppdateringsstatus:', err);
        }
    }

    updateBtn.textContent = originalText;
    updateBtn.onclick = async () => {
        updateBtn.disabled = true;
        startTimer(0);
        try {
            const res = await fetch('/api/update', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                stopTimer('Alla scheman har hämtats om!');
                fetchSchemas();
            } else {
                stopTimer(data.message || 'Fel vid uppdatering!', 3000);
            }
        } catch (err) {
            stopTimer('Fel vid uppdatering!', 3000);
        }
    };

    const btnContainer = document.getElementById('update-btn-container');
    if (btnContainer) {
        btnContainer.appendChild(updateBtn);
    }

    // Kolla status vid sidladdning
    await checkUpdateStatus();
});

function renderSchemaList(schemas) {
    const list = document.getElementById('schema-list');
    list.innerHTML = '<h2>Befintliga Scheman</h2>';
    if (!schemas.length) {
        list.innerHTML += '<p>Inga scheman finns.</p>';
        return;
    }
    const ul = document.createElement('ul');
    ul.className = 'schema-list-ul';
    schemas.forEach((schema, idx) => {
        const li = document.createElement('li');
        li.className = 'schema-list-li';

        let html = `<div class="schema-title"><b>${idx + 1}. Namn: ${schema.name}</b></div>`;
        html += '<ul class="schema-days-ul">';
        for (const [day, docId] of Object.entries(schema.days)) {
            html += `<li><b>${day}:</b> <span class="schema-docid">${docId}</span></li>`;
        }
        html += '</ul>';
        li.innerHTML = html;
        const del = document.createElement('span');
        del.textContent = 'Ta bort';
        del.className = 'delete-btn';
        del.onclick = async () => {
            if (confirm(`Är du säker på att du vill ta bort schema '${schema.name}'?`)) {
                await fetch(`/api/schemas/${encodeURIComponent(schema.name)}`, { method: 'DELETE' });
                fetchSchemas();
            }
        };
        li.appendChild(del);
        ul.appendChild(li);
    });
    list.appendChild(ul);
}

async function fetchSchemas() {
    try {
        const res = await fetch('/api/schemas');
        if (!res.ok) throw new Error('Kunde inte hämta scheman');
        const schemas = await res.json();
        renderSchemaList(schemas);
    } catch (err) {
        console.error('Fel vid hämtning av scheman:', err);
        const list = document.getElementById('schema-list');
        list.innerHTML = '<h2>Befintliga Scheman</h2><p style="color:red;">Kunde inte ladda scheman.</p>';
    }
}

document.getElementById('add-form').onsubmit = async e => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const type = document.getElementById('type').value;
    if (!name) {
        alert('Du måste ange ett namn för schemat.');
        return;
    }
    const daysObj = {};
    DAYS.forEach(day => {
        const val = document.getElementById(`day-${day}`).value.trim();
        if (val) daysObj[day] = val;
    });
    if (Object.keys(daysObj).length === 0) {
        alert('Du måste ange minst ett dokument-ID.');
        return;
    }
    try {
        const res = await fetch('/api/schemas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, type, days: daysObj })
        });
        if (res.status === 409) {
            alert('Ett schema med detta namn finns redan.');
            return;
        }
        if (!res.ok) throw new Error('Kunde inte lägga till schema');
        e.target.reset();
        fetchSchemas();
    } catch (err) {
        console.error('Fel vid tillägg av schema:', err);
        alert('Något gick fel vid tillägg av schemat.');
    }
};

fetchSchemas();
