document.addEventListener('DOMContentLoaded', () => {
    const matchRowsContainer = document.getElementById('match-rows');
    const featuredMatchSelect = document.getElementById('featured-match-select');
    const resetBtn = document.getElementById('reset-btn');

    // Save / Load elements
    const saveNameInput = document.getElementById('save-name-input');
    const saveBtn = document.getElementById('save-btn');
    const savedSelect = document.getElementById('saved-select');
    const loadBtn = document.getElementById('load-btn');
    const deleteSaveBtn = document.getElementById('delete-save-btn');

    // Constants
    const NUM_MATCHES = 12;
    const USERS = 3;
    const STORAGE_PREFIX = 'footballApp_saved_';

    // Config
    let featuredMatchIndex = -1; // -1 means none

    // Initialize UI
    init();

    function init() {
        renderInputRows();
        populateFeaturedSelect();
        populateSavedSelect();

        // Listeners — real-time calculation on any input change
        matchRowsContainer.addEventListener('input', () => {
            calculatePoints();
        });

        featuredMatchSelect.addEventListener('change', (e) => {
            featuredMatchIndex = e.target.value === '' ? -1 : parseInt(e.target.value);
            highlightFeaturedRow();
            calculatePoints();
        });

        resetBtn.addEventListener('click', resetForm);

        // Save / Load listeners
        saveBtn.addEventListener('click', () => {
            const name = saveNameInput.value.trim();
            if (!name) {
                alert('Escriu un nom per al guardat.');
                return;
            }
            saveNamedState(name);
            saveNameInput.value = '';
            populateSavedSelect();
        });

        loadBtn.addEventListener('click', () => {
            const name = savedSelect.value;
            if (!name) {
                alert('Selecciona un guardat per carregar.');
                return;
            }
            loadNamedState(name);
        });

        deleteSaveBtn.addEventListener('click', () => {
            const name = savedSelect.value;
            if (!name) {
                alert('Selecciona un guardat per eliminar.');
                return;
            }
            if (confirm(`Segur que vols eliminar el guardat "${name}"?`)) {
                deleteNamedState(name);
                populateSavedSelect();
            }
        });
    }

    function renderInputRows() {
        matchRowsContainer.innerHTML = '';

        for (let i = 0; i < NUM_MATCHES; i++) {
            const tr = document.createElement('tr');
            tr.dataset.index = i;

            // Match Number
            const tdNum = document.createElement('td');
            tdNum.textContent = i + 1;
            tdNum.className = 'col-match';
            tr.appendChild(tdNum);

            // Teams Input
            const tdTeams = document.createElement('td');
            tdTeams.className = 'col-teams';
            tdTeams.innerHTML = `
                <input type="text" placeholder="Equip Local" class="team-home">
                <input type="text" placeholder="Equip Visitant" class="team-away">
            `;
            tr.appendChild(tdTeams);

            // Actual Result
            const tdResult = document.createElement('td');
            tdResult.className = 'col-result';
            tdResult.innerHTML = createScoreInput(`result-${i}`);
            tr.appendChild(tdResult);

            // User Predictions
            for (let u = 1; u <= USERS; u++) {
                const tdUser = document.createElement('td');
                tdUser.className = 'col-user';
                tdUser.innerHTML = createScoreInput(`u${u}-${i}`);
                tdUser.innerHTML += `<span class="points-badge" id="pts-u${u}-${i}">-</span>`;
                tr.appendChild(tdUser);
            }

            matchRowsContainer.appendChild(tr);
        }
    }

    function createScoreInput(idBase) {
        return `
            <div class="score-inputs">
                <input type="number" id="${idBase}-h" min="0" placeholder="0">
                <span class="score-separator">-</span>
                <input type="number" id="${idBase}-a" min="0" placeholder="0">
            </div>
        `;
    }

    function populateFeaturedSelect() {
        featuredMatchSelect.innerHTML = '<option value="">Cap</option>';
        for (let i = 0; i < NUM_MATCHES; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Partit ${i + 1}`;
            featuredMatchSelect.appendChild(option);
        }
    }

    function highlightFeaturedRow() {
        // Remove class from all
        document.querySelectorAll('#match-rows tr').forEach(row => {
            row.classList.remove('featured-match');
        });

        if (featuredMatchIndex !== -1) {
            const row = document.querySelector(`tr[data-index="${featuredMatchIndex}"]`);
            if (row) row.classList.add('featured-match');
        }
    }

    function calculatePoints() {
        let totalScores = [0, 0, 0]; // For U1, U2, U3

        // Reset ALL badges before recalculating (fixes the stale badge bug)
        document.querySelectorAll('.points-badge').forEach(b => {
            b.textContent = '-';
            b.className = 'points-badge';
        });

        // Reset totals display
        for (let u = 1; u <= USERS; u++) {
            document.getElementById(`total-u${u}`).textContent = '0';
        }

        for (let i = 0; i < NUM_MATCHES; i++) {
            // Get Actual Result
            const realH = getVal(`result-${i}-h`);
            const realA = getVal(`result-${i}-a`);

            if (realH === null || realA === null) continue; // Skip incomplete

            const isFeatured = (i === featuredMatchIndex);

            // Loop Users
            for (let u = 1; u <= USERS; u++) {
                const predH = getVal(`u${u}-${i}-h`);
                const predA = getVal(`u${u}-${i}-a`);
                const badge = document.getElementById(`pts-u${u}-${i}`);

                if (predH === null || predA === null) {
                    // badge already reset to '-' above
                    continue;
                }

                const pts = computeMatchPoints(realH, realA, predH, predA, isFeatured);
                totalScores[u - 1] += pts;

                badge.textContent = `${pts}`;
                badge.className = `points-badge ${pts > 0 ? 'points-positive' : 'points-zero'}`;
            }
        }

        // Update Totals
        for (let u = 1; u <= USERS; u++) {
            document.getElementById(`total-u${u}`).textContent = totalScores[u - 1];
        }
    }

    function getVal(id) {
        const el = document.getElementById(id);
        return el && el.value !== '' ? parseInt(el.value) : null;
    }

    function computeMatchPoints(realH, realA, predH, predA, isFeatured) {
        // Determine Outcomes (1, X, 2)
        const realOutcome = getOutcome(realH, realA);
        const predOutcome = getOutcome(predH, predA);

        let points = 0;

        // Exact Match
        if (realH === predH && realA === predA) {
            if (realOutcome === '1') points = 12;
            else if (realOutcome === '2') points = 20;
            else points = 16; // Draw

            // Star match ONLY doubles on exact match
            if (isFeatured) points *= 2;
            return points;
        }

        // Not Exact — correct outcome but NOT exact score
        if (realOutcome === predOutcome) {
            // Base points for correct outcome
            if (realOutcome === '1') points = 12 - 2;
            else if (realOutcome === '2') points = 20 - 4;
            else points = 16 - 4;

            // Goal Difference Penalty
            const realDiff = realH - realA;
            const predDiff = predH - predA;

            let penaltyPerDiff = 0;
            if (realOutcome === '1') penaltyPerDiff = 1;
            else if (realOutcome === '2') penaltyPerDiff = 2;

            const diffError = Math.abs(realDiff - predDiff);
            const extraPenalty = diffError * penaltyPerDiff;

            points -= extraPenalty;

            if (points < 0) points = 0;

            // NOT doubled for featured match if not exact
            return points;
        }

        return 0; // Incorrect outcome
    }

    function getOutcome(h, a) {
        if (h > a) return '1';
        if (a > h) return '2';
        return 'X';
    }

    function resetForm() {
        if (confirm('Segur que vols esborrar totes les dades? (Els guardats no s\'eliminaran)')) {
            document.querySelectorAll('#predictions-table input').forEach(i => i.value = '');
            document.querySelectorAll('.points-badge').forEach(b => {
                b.textContent = '-';
                b.className = 'points-badge';
            });
            document.getElementById('total-u1').textContent = '0';
            document.getElementById('total-u2').textContent = '0';
            document.getElementById('total-u3').textContent = '0';

            featuredMatchIndex = -1;
            featuredMatchSelect.value = "";
            highlightFeaturedRow();
        }
    }

    // ---- Save / Load System ----

    function getSavedNames() {
        const names = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(STORAGE_PREFIX)) {
                names.push(key.substring(STORAGE_PREFIX.length));
            }
        }
        return names.sort();
    }

    function populateSavedSelect() {
        const names = getSavedNames();
        savedSelect.innerHTML = '<option value="">-- Carregar guardat --</option>';
        names.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            savedSelect.appendChild(option);
        });
    }

    function saveNamedState(name) {
        const data = {
            featuredMatchIndex,
            inputs: {}
        };

        // Save all inputs
        document.querySelectorAll('#predictions-table input').forEach(input => {
            if (input.id) {
                data.inputs[input.id] = input.value;
            } else if (input.classList.contains('team-home')) {
                const row = input.closest('tr');
                const index = row.dataset.index;
                data.inputs[`team-home-${index}`] = input.value;
            } else if (input.classList.contains('team-away')) {
                const row = input.closest('tr');
                const index = row.dataset.index;
                data.inputs[`team-away-${index}`] = input.value;
            }
        });

        localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(data));
    }

    function loadNamedState(name) {
        const json = localStorage.getItem(STORAGE_PREFIX + name);
        if (!json) return;

        try {
            const data = JSON.parse(json);

            // Restore Featured Match
            if (data.featuredMatchIndex !== undefined) {
                featuredMatchIndex = data.featuredMatchIndex;
                featuredMatchSelect.value = featuredMatchIndex === -1 ? "" : featuredMatchIndex;
                highlightFeaturedRow();
            }

            // Restore Inputs
            if (data.inputs) {
                for (const [key, value] of Object.entries(data.inputs)) {
                    let el = document.getElementById(key);

                    if (!el) {
                        // Handle team inputs
                        const parts = key.match(/team-(home|away)-(\d+)/);
                        if (parts) {
                            const type = parts[1];
                            const idx = parts[2];
                            const row = document.querySelector(`tr[data-index="${idx}"]`);
                            if (row) {
                                el = row.querySelector(`.team-${type}`);
                            }
                        }
                    }

                    if (el) el.value = value;
                }
            }

            // Recalculate after loading
            calculatePoints();

        } catch (e) {
            console.error("Error loading data", e);
        }
    }

    function deleteNamedState(name) {
        localStorage.removeItem(STORAGE_PREFIX + name);
    }
});
