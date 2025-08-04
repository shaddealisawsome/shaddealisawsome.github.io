// script.js

const publicVapidKey = 'YOUR_PUBLIC_VAPID_KEY'; // REPLACE THIS WITH YOUR ACTUAL PUBLIC VAPID KEY

// Objects to store our data in memory
let barcodeAssociations = {};
let scanLog = [];

// DOM elements
const barcodeAssociationForm = document.getElementById('barcode-association-form');
const barcodeInput = document.getElementById('barcode-input');
const nameInput = document.getElementById('name-input');
const statusInput = document.getElementById('status-input');
const messageElement = document.getElementById('message');
const quickScanInput = document.getElementById('quick-scan-input');
const scanResultDisplay = document.getElementById('last-scanned-value');
const scanResultsList = document.getElementById('scan-results');
const clearLogButton = document.getElementById('clear-log-button');
const exportAssociationsButton = document.getElementById('export-associations-button');
const exportLogButton = document.getElementById('export-log-button');
const enablePushButton = document.getElementById('enable-push-button');
const notificationMessage = document.getElementById('notification-message');

// --- Core Data Management Functions ---

function loadData() {
    const storedAssociations = localStorage.getItem('barcodeData');
    if (storedAssociations) {
        barcodeAssociations = JSON.parse(storedAssociations);
    }
    
    const storedLog = localStorage.getItem('scanLogData');
    if (storedLog) {
        scanLog = JSON.parse(storedLog);
        renderScanLog();
    }
}

function saveAssociations() {
    localStorage.setItem('barcodeData', JSON.stringify(barcodeAssociations));
    sendDataToBackend(); // IMPORTANT: Send data to the server on every save
}

function saveScanLog() {
    localStorage.setItem('scanLogData', JSON.stringify(scanLog));
    sendDataToBackend(); // IMPORTANT: Send data to the server on every save
}

// NEW: Function to send data to the backend
async function sendDataToBackend() {
    try {
        await fetch('http://localhost:3000/api/update-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ barcodeAssociations, scanLog })
        });
        console.log('Data successfully sent to backend.');
    } catch (error) {
        console.error('Failed to send data to backend:', error);
    }
}

function renderScanLog() {
    scanResultsList.innerHTML = '';
    scanLog.forEach(logEntry => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <strong>Timestamp:</strong> ${logEntry.timestamp} <br>
            <strong>Scanned Barcode:</strong> ${logEntry.barcode} <br>
            <strong>Associated Name:</strong> ${logEntry.name} <br>
            <strong>Status:</strong> ${logEntry.status}
        `;
        scanResultsList.appendChild(listItem);
    });
}

// --- Event Listeners and Core Logic ---

// Handle adding new barcode associations
barcodeAssociationForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const barcode = barcodeInput.value.trim();
    const name = nameInput.value.trim();
    const status = statusInput.value.trim();

    if (barcode && name && status) {
        barcodeAssociations[barcode] = { name: name, status: status };
        saveAssociations();
        messageElement.textContent = `Successfully associated barcode "${barcode}" with name "${name}" and status "${status}".`;
        messageElement.style.color = 'green';
        barcodeInput.value = '';
        nameInput.value = '';
        statusInput.value = '';
    } else {
        messageElement.textContent = 'Please fill in all fields.';
        messageElement.style.color = 'red';
    }
});

// Handle the dedicated quick scan input field
quickScanInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        const barcode = quickScanInput.value.trim();
        if (barcode.length > 0) {
            processScannedBarcode(barcode);
        }
        quickScanInput.value = '';
    }
});

function processScannedBarcode(barcode) {
    const timestamp = new Date().toLocaleString();
    
    // Retrieve the associated data using the new structure
    const associatedData = barcodeAssociations[barcode] || { name: 'Unknown', status: 'N/A' };
    const logEntry = {
        timestamp: timestamp,
        barcode: barcode,
        name: associatedData.name,
        status: associatedData.status
    };

    scanResultDisplay.innerHTML = `
        <strong>Scanned:</strong> ${barcode} <br>
        <strong>Name:</strong> ${associatedData.name} <br>
        <strong>Status:</strong> ${associatedData.status} <br>
        <strong>Timestamp:</strong> ${timestamp}
    `;

    scanLog.unshift(logEntry);
    
    if (scanLog.length > 500) {
        scanLog.pop();
    }
    
    saveScanLog();
    renderScanLog();
}

// --- Push Notification Logic (same as before) ---
async function subscribeUserToPush() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        const swRegistration = await navigator.serviceWorker.register('/service-worker.js');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Permission not granted for Notification');
        }

        const pushSubscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
        });

        await fetch('http://localhost:3000/api/subscribe-push', {
            method: 'POST',
            body: JSON.stringify(pushSubscription),
            headers: { 'content-type': 'application/json' },
        });

        notificationMessage.textContent = 'Successfully subscribed to push notifications!';
        notificationMessage.style.color = 'green';
    } else {
        notificationMessage.textContent = 'Push notifications are not supported by this browser.';
        notificationMessage.style.color = 'red';
    }
}

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Event listener for the push notification button
enablePushButton.addEventListener('click', () => {
    subscribeUserToPush().catch(error => {
        notificationMessage.textContent = `Error subscribing: ${error.message}`;
        notificationMessage.style.color = 'red';
        console.error('Error during push subscription:', error);
    });
});

// Handle "Clear Scan Log" button click
clearLogButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the entire scan log? This action cannot be undone.')) {
        scanLog = [];
        saveScanLog();
        renderScanLog();
        alert('Scan log has been cleared.');
    }
});

// Handle "Export Associations" button click
exportAssociationsButton.addEventListener('click', () => {
    let csvData = "Barcode,Name,Status\n";
    for (const barcode in barcodeAssociations) {
        if (Object.hasOwnProperty.call(barcodeAssociations, barcode)) {
            const { name, status } = barcodeAssociations[barcode];
            csvData += `${escapeForCsv(barcode)},${escapeForCsv(name)},${escapeForCsv(status)}\n`;
        }
    }
    exportToCsv('barcode-associations.csv', csvData);
});

// Handle "Export Scan Log" button click
exportLogButton.addEventListener('click', () => {
    let csvData = "Timestamp,Barcode,Name,Status\n";
    scanLog.forEach(entry => {
        csvData += `${escapeForCsv(entry.timestamp)},${escapeForCsv(entry.barcode)},${escapeForCsv(entry.name)},${escapeForCsv(entry.status)}\n`;
    });
    exportToCsv('barcode-scan-log.csv', csvData);
});

// Initial data load and autofocus on the quick scan input
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    quickScanInput.focus();
});
