const DAYS = ["Mån", "Tis", "Ons", "Tor", "Fre"];

// ─── Centraliserat tillstånd ───────────────────────────────────────────────
const state = {
    isUpdating: false,
    timerInterval: null,
    pollInterval: null,
    seconds: 0,
    activeBtn: null,       // Den knapp som räknar upp
    allBtns: [],           // Alla knappar (enskilda + global)
};

function getAllBtns() {
    const singleBtns = Array.from(document.querySelectorAll('.update-single-btn'));
    const globalBtn = document.getElementById('global-update-btn');
    return globalBtn ? [globalBtn, ...singleBtns] : singleBtns;
}

function lockAllBtns() {
    getAllBtns().forEach(b => (b.disabled = true));
}

function unlockAllBtns() {
    getAllBtns().forEach(b => {
        b.disabled = false;
    });
}

function startTimer(btn) {
    state.isUpdating = true;
    state.seconds = 0;
    state.activeBtn = btn;

    lockAllBtns();
    btn.textContent = `Uppdaterar... (0s)`;

    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        state.seconds++;
        btn.textContent = `Uppdaterar... (${state.seconds}s)`;
    }, 1000);
}

function stopTimer(successMessage, originalTexts) {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
    if (state.pollInterval) {
        clearInterval(state.pollInterval);
        state.pollInterval = null;
    }

    if (state.activeBtn) {
        state.activeBtn.textContent = successMessage;
    }

    state.isUpdating = false;

    setTimeout(() => {
        // Återställ text på alla knappar
        const allBtns = getAllBtns();
        allBtns.forEach(b => {
            const orig = originalTexts.get(b);
            if (orig) b.textContent = orig;
        });
        unlockAllBtns();
        state.activeBtn = null;
        fetchSchemas();
    }, 2000);
}

function startPolling(activeBtn, successMessage, originalTexts) {
    if (state.pollInterval) clearInterval(state.pollInterval);
    state.pollInterval = setInterval(async () => {
        try {
            const res = await fetch('/api/update/status');
            const status = await res.json();
            if (!status.isUpdating) {
                stopTimer(successMessage, originalTexts);
            }
        } catch (err) {
            console.error('Polling-fel:', err);
        }
    }, 1000);
}

// ─── Hjälpfunktion för att återställa knapp efter timeout ─────────────────
function resetButton(btn, originalText, delay = 2500) {
    setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
    }, delay);
}

// ─── Dag-inputs ───────────────────────────────────────────────────────────
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

// ─── Global "Uppdatera alla"-knapp ────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    const updateBtn = document.createElement('button');
    updateBtn.id = 'global-update-btn';
    const originalText = 'Uppdatera alla Scheman';
    updateBtn.textContent = originalText;

    updateBtn.onclick = async () => {
        if (state.isUpdating) return;

        const originalTexts = new Map();
        getAllBtns().forEach(b => originalTexts.set(b, b.textContent));
        originalTexts.set(updateBtn, originalText);

        startTimer(updateBtn);
        startPolling(updateBtn, 'Alla scheman har hämtats om!', originalTexts);

        try {
            const res = await fetch('/api/update', { method: 'POST' });
            const data = await res.json();
            if (!data.success) {
                // Backend avvisade direkt — stoppa utan polling
                clearInterval(state.pollInterval);
                state.pollInterval = null;
                clearInterval(state.timerInterval);
                state.timerInterval = null;
                state.isUpdating = false;
                updateBtn.textContent = data.message || 'Fel vid uppdatering!';
                setTimeout(() => {
                    updateBtn.textContent = originalText;
                    unlockAllBtns();
                    state.activeBtn = null;
                }, 3000);
            }
            // Om success: polling hanterar återställning
        } catch (err) {
            clearInterval(state.pollInterval);
            state.pollInterval = null;
            clearInterval(state.timerInterval);
            state.timerInterval = null;
            state.isUpdating = false;
            updateBtn.textContent = 'Fel vid uppdatering!';
            setTimeout(() => {
                updateBtn.textContent = originalText;
                unlockAllBtns();
                state.activeBtn = null;
            }, 3000);
        }
    };

    const btnContainer = document.getElementById('update-btn-container');
    if (btnContainer) btnContainer.appendChild(updateBtn);

    // Kolla om en uppdatering redan pågår vid sidladdning
    try {
        const res = await fetch('/api/update/status');
        const status = await res.json();
        if (status.isUpdating) {
            state.seconds = status.elapsedSeconds || 0;
            // Starta timer visuellt på global-knappen
            startTimer(updateBtn);
            state.seconds = status.elapsedSeconds || 0;
            updateBtn.textContent = `Uppdaterar... (${state.seconds}s)`;

            const originalTexts = new Map([[updateBtn, originalText]]);
            startPolling(updateBtn, 'Alla scheman har hämtats om!', originalTexts);
        }
    } catch (err) {
        console.error('Kunde inte hämta uppdateringsstatus:', err);
    }
});

// ─── Rendera schemalista ──────────────────────────────────────────────────
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

        // Ta bort-knapp
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

        // Enskild uppdatera-knapp
        const updateBtn = document.createElement('button');
        updateBtn.textContent = 'Uppdatera';
        updateBtn.className = 'update-single-btn';

        updateBtn.onclick = async () => {
            if (state.isUpdating) return;

            // Bygg originalTexts för alla knappar som finns just nu
            const originalTexts = new Map();
            getAllBtns().forEach(b => originalTexts.set(b, b.textContent));

            startTimer(updateBtn);
            startPolling(updateBtn, 'Schemat uppdaterat!', originalTexts);

            try {
                await fetch(`/api/update/${encodeURIComponent(schema.name)}`, { method: 'POST' });
                // Polling hanterar återställning
            } catch (err) {
                clearInterval(state.pollInterval);
                state.pollInterval = null;
                clearInterval(state.timerInterval);
                state.timerInterval = null;
                state.isUpdating = false;
                updateBtn.textContent = 'Fel vid uppdatering!';
                setTimeout(() => {
                    unlockAllBtns();
                    originalTexts.forEach((text, btn) => (btn.textContent = text));
                    state.activeBtn = null;
                }, 3000);
            }
        };

        li.appendChild(updateBtn);
        ul.appendChild(li);
    });

    list.appendChild(ul);
}

// ─── Hämta scheman ────────────────────────────────────────────────────────
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

// ─── Lägg till schema ─────────────────────────────────────────────────────
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