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
window.addEventListener('DOMContentLoaded', () => {
    const updateBtn = document.createElement('button');
    const originalText = 'Uppdatera alla Scheman';

    updateBtn.textContent = originalText;
    updateBtn.onclick = async () => {
        updateBtn.disabled = true;
        let seconds = 0;
        const intervalId = setInterval(() => {
            seconds++;
            updateBtn.textContent = `Uppdaterar... (${seconds}s)`;
        }, 1000);
        try {
            const res = await fetch('/api/update', { method: 'POST' });
            const data = await res.json();
            clearInterval(intervalId);
            if (data.success) {
                updateBtn.textContent = 'Alla scheman har hämtats om!';
                fetchSchemas();
                resetButton(updateBtn, originalText);
            } else {
                updateBtn.textContent = 'Fel vid uppdatering!';
                resetButton(updateBtn, originalText, 3000);
            }
        } catch (err) {
            clearInterval(intervalId);
            updateBtn.textContent = 'Fel vid uppdatering!';
            resetButton(updateBtn, originalText, 3000);
        }
    };
    const btnContainer = document.getElementById('update-btn-container');
    if (btnContainer) {
        btnContainer.appendChild(updateBtn);
    }
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
            html += `<li>DokumentID för ${day}: <span class="schema-docid">${docId}</span></li>`;
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
            body: JSON.stringify({ name, days: daysObj })
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
