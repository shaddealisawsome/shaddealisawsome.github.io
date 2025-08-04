// Password logic
const passwordInput = document.getElementById('password-input');
const passwordButton = document.getElementById('password-button');
const passwordOverlay = document.getElementById('password-overlay');
const mainContent = document.getElementById('main-content');
const passwordMessage = document.getElementById('password-message');
const correctPassword = '97TRS';

function checkPassword() {
    if (passwordInput.value === correctPassword) {
        passwordOverlay.style.display = 'none';
        mainContent.classList.remove('hidden');
        manualBarcodeInput.focus(); // Focus on the barcode input after logging in
    } else {
        passwordMessage.textContent = 'Incorrect password. Please try again.';
        passwordInput.value = '';
    }
}

passwordButton.addEventListener('click', checkPassword);
passwordInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        checkPassword();
    }
});


// References to DOM elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

const barcodeAssociationForm = document.getElementById('barcode-association-form');
const barcodeToNameInput = document.getElementById('barcode-to-name-input');
const personNameInput = document.getElementById('person-name-input');
const roomNumberInput = document.getElementById('room-number-input'); // New reference
const phaseInput = document.getElementById('phase-input');
const associationMessageElement = document.getElementById('association-message');
const checkingStatusSelect = document.getElementById('checking-status');
const scanResultsList = document.getElementById('scan-results');
const exportLogButton = document.getElementById('export-log-button');
const clearLogButton = document.getElementById('clear-log-button');
const currentStatusDisplay = document.getElementById('current-status-display');
const exportStatusButton = document.getElementById('export-status-button');
const showAllButton = document.getElementById('show-all-button');
const showCheckedOutButton = document.getElementById('show-checked-out-button');
const manualBarcodeInput = document.getElementById('manual-barcode-input');
const manualLogButton = document.getElementById('manual-log-button');

// A database to store barcode associations (using local storage)
const barcodeAssociations = JSON.parse(localStorage.getItem('barcodeAssociations')) || {};
// A database to store the current in/out status for each barcode
const currentStatus = JSON.parse(localStorage.getItem('currentStatus')) || {};

// An array to store the scan log, now loaded from local storage
const scanLog = JSON.parse(localStorage.getItem('scanLog')) || [];

/**
 * Handles tab switching by showing and hiding content.
 * @param {Event} event The click event from a tab button.
 */
function switchTab(event) {
    const selectedTabId = event.target.dataset.tab;

    // Deactivate all tab buttons and hide all content
    tabButtons.forEach(button => button.classList.remove('active'));
    tabContents.forEach(content => content.classList.add('hidden'));

    // Activate the clicked button and show its corresponding content
    event.target.classList.add('active');
    const selectedTab = document.getElementById(selectedTabId);
    selectedTab.classList.remove('hidden');

    // If the status tab is active, populate it with current data
    if (selectedTabId === 'status-tab') {
        populateStatusTab('all');
    }

    // Automatically focus the barcode input when switching to the scan tab
    if (selectedTabId === 'scan-tab') {
        manualBarcodeInput.focus();
    }
}

/**
 * Populates the name and phase fields if an association for the barcode already exists.
 */
function populateAssociation() {
    const barcode = barcodeToNameInput.value.trim();
    if (barcodeAssociations.hasOwnProperty(barcode)) {
        const { name, room, phase } = barcodeAssociations[barcode];
        personNameInput.value = name;
        roomNumberInput.value = room;
        phaseInput.value = phase;
    } else {
        personNameInput.value = '';
        roomNumberInput.value = '';
        phaseInput.value = '1'; // Reset to default if no association exists
    }
}

/**
 * Handles form submission to add or update a barcode association.
 * @param {Event} event The form submission event.
 */
function handleAssociationFormSubmit(event) {
    event.preventDefault();

    const barcode = barcodeToNameInput.value.trim();
    const name = personNameInput.value.trim();
    const room = roomNumberInput.value.trim();
    const phase = phaseInput.value;

    if (barcode && name && phase) {
        barcodeAssociations[barcode] = { name, room, phase };
        localStorage.setItem('barcodeAssociations', JSON.stringify(barcodeAssociations));
        showAssociationMessage(`Association saved for ${name}, Phase ${phase}.`, 'success');
        barcodeToNameInput.value = '';
        personNameInput.value = '';
        roomNumberInput.value = '';
        phaseInput.value = '1';

        // Automatically log the new association as "In"
        logScanResult(barcode, 'In');

    } else {
        showAssociationMessage('Please enter a barcode, name, and phase.', 'error');
    }
}

/**
 * Displays a temporary message for the association form.
 * @param {string} text The message to display.
 * @param {string} type The type of message ('success' or 'error').
 */
function showAssociationMessage(text, type) {
    associationMessageElement.textContent = text;
    associationMessageElement.style.color = type === 'error' ? 'red' : 'green';
    setTimeout(() => {
        associationMessageElement.textContent = '';
    }, 3000);
}

/**
 * Logs the scanned barcode and the selected status. The displayed log is now much cleaner.
 * @param {string} barcode The scanned barcode number.
 * @param {string} status The status to be logged (e.g., 'In' or 'Out').
 */
function logScanResult(barcode, status) {
    const association = barcodeAssociations[barcode] || { name: 'Unknown', room: 'N/A', phase: 'N/A' };
    const timestamp = new Date().toLocaleString();
    const message = `${association.name} checked ${status}.`;

    // Update the current status database and save to local storage
    currentStatus[barcode] = {
        name: association.name,
        room: association.room,
        phase: association.phase,
        status: status,
        timestamp: timestamp
    };
    localStorage.setItem('currentStatus', JSON.stringify(currentStatus));

    // Add the scan result to the log array
    const newLogEntry = { barcode, name: association.name, room: association.room, phase: association.phase, status, timestamp };
    scanLog.push(newLogEntry);
    localStorage.setItem('scanLog', JSON.stringify(scanLog)); // Save the updated log

    // Create and append a new list item to the UI
    const listItem = document.createElement('li');
    listItem.innerHTML = `<span class="log-timestamp">${timestamp}</span><span class="log-info">${message}</span>`;
    scanResultsList.prepend(listItem);
}

/**
 * Populates the "Current Status" tab with a list of all associations, optionally filtered.
 * @param {string} filter 'all' or 'out'
 */
function populateStatusTab(filter = 'all') {
    currentStatusDisplay.innerHTML = ''; // Clear previous content

    if (Object.keys(barcodeAssociations).length === 0) {
        currentStatusDisplay.textContent = 'No barcode associations saved yet.';
        return;
    }

    const table = document.createElement('table');
    table.id = 'current-status-table';
    const headerRow = table.insertRow();
    ['Name', 'Room', 'Phase', 'Status'].forEach(headerText => {
        const header = document.createElement('th');
        header.textContent = headerText;
        headerRow.appendChild(header);
    });

    for (const barcode in barcodeAssociations) {
        const { name, room, phase } = barcodeAssociations[barcode];
        const statusData = currentStatus[barcode] || { status: 'Out' }; // Default to 'Out' if no log entry exists

        if (filter === 'all' || statusData.status === 'Out') {
            const row = table.insertRow();
            row.insertCell().textContent = name;
            row.insertCell().textContent = room;
            row.insertCell().textContent = phase;
            row.insertCell().textContent = statusData.status;
        }
    }

    currentStatusDisplay.appendChild(table);
}

/**
 * Displays the saved log entries from local storage when the page loads, hiding barcodes.
 */
function displaySavedLog() {
    scanResultsList.innerHTML = '';
    // Reverse the log to display newest first
    for (const entry of scanLog.slice().reverse()) {
        const message = `${entry.name} checked ${entry.status}.`;
        const listItem = document.createElement('li');
        listItem.innerHTML = `<span class="log-timestamp">${entry.timestamp}</span><span class="log-info">${message}</span>`;
        scanResultsList.appendChild(listItem);
    }
}

/**
 * Exports the current status data to a CSV file. Barcodes are still included in the export.
 */
function exportStatusToCsv() {
    if (Object.keys(barcodeAssociations).length === 0) {
        alert('No data to export!');
        return;
    }

    const headers = ['barcode', 'name', 'room', 'phase', 'status'];
    const csvRows = [];
    csvRows.push(headers.join(',')); // Add headers

    for (const barcode in barcodeAssociations) {
        const { name, room, phase } = barcodeAssociations[barcode];
        const statusData = currentStatus[barcode] || { status: 'Out' };

        const values = [
            barcode,
            name,
            room,
            phase,
            statusData.status
        ];

        const sanitizedValues = values.map(value => {
            let val = String(value).replace(/"/g, '""');
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                val = `"${val}"`;
            }
            return val;
        });

        csvRows.push(sanitizedValues.join(','));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'current_status.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Exports the scan log data to a CSV file. Barcodes are still included in the export.
 */
function exportLogToCsv() {
    if (scanLog.length === 0) {
        alert('No data to export!');
        return;
    }

    const headers = ['barcode', 'name', 'room', 'phase', 'status', 'timestamp'];
    const csvRows = [];
    csvRows.push(headers.join(',')); // Add headers

    // Map data to CSV rows
    for (const row of scanLog) {
        const values = headers.map(header => {
            let value = row[header] || '';
            // Sanitize the value for CSV
            value = String(value).replace(/"/g, '""');
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                value = `"${value}"`;
            }
            return value;
        });
        csvRows.push(values.join(','));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'scan_log.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Clears the scan log from the UI and the data array.
 */
function clearScanLog() {
    scanLog.length = 0;
    scanResultsList.innerHTML = '';
    localStorage.removeItem('scanLog');
}

/**
 * Handles the manual log button click and the scanner's 'Enter' keypress.
 */
function handleManualLog() {
    const manualBarcode = manualBarcodeInput.value.trim();
    if (manualBarcode) {
        const selectedStatus = checkingStatusSelect.value;
        logScanResult(manualBarcode, selectedStatus);
        manualBarcodeInput.value = ''; // Clear the input field after logging
    }
}

// Initial call to display any saved log entries on page load
displaySavedLog();

// Event Listeners
tabButtons.forEach(button => button.addEventListener('click', switchTab));
barcodeAssociationForm.addEventListener('submit', handleAssociationFormSubmit);
exportLogButton.addEventListener('click', exportLogToCsv);
exportStatusButton.addEventListener('click', exportStatusToCsv);
clearLogButton.addEventListener('click', clearScanLog);
showAllButton.addEventListener('click', () => populateStatusTab('all'));
showCheckedOutButton.addEventListener('click', () => populateStatusTab('out'));
manualLogButton.addEventListener('click', handleManualLog);

// Event listener to trigger log on 'Enter' keypress in the manual input field
manualBarcodeInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        handleManualLog();
        event.preventDefault(); // Prevent default form submission behavior
    }
});

// New event listener to refocus the barcode input after the status is changed
checkingStatusSelect.addEventListener('change', () => {
    manualBarcodeInput.focus();
});