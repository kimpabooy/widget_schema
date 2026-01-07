const days = ["Mån", "Tis", "Ons", "Tor", "Fre"];
const daysInputs = document.getElementById('days-inputs');
days.forEach(day => {
    const label = document.createElement('label');
    label.textContent = `Dokument-ID för ${day}: `;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = `day-${day}`;
    label.appendChild(input);
    daysInputs.appendChild(label);
});

function renderSchemaList(schemas) {
    const list = document.getElementById('schema-list');
    list.innerHTML = '<h2>Befintliga scheman</h2>';
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
    const res = await fetch('/api/schemas');
    const schemas = await res.json();
    renderSchemaList(schemas);
}

document.getElementById('add-form').onsubmit = async e => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const daysObj = {};
    days.forEach(day => {
        const val = document.getElementById(`day-${day}`).value.trim();
        if (val) daysObj[day] = val;
    });
    await fetch('/api/schemas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, days: daysObj })
    });
    e.target.reset();
    fetchSchemas();
};

fetchSchemas();
