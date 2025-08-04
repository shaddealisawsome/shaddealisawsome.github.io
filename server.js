// server.js

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cron = require('node-cron');
const webpush = require('web-push');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(cors({ origin: 'http://127.0.0.1:5500' }));
app.use(bodyParser.json());

// --- VAPID Key Setup ---
const vapidKeys = webpush.generateVAPIDKeys();
console.log('Public VAPID Key:', vapidKeys.publicKey);
console.log('Private VAPID Key:', vapidKeys.privateKey);

webpush.setVapidDetails(
    'mailto:your-email@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// --- Data Storage ---
const pushSubscribersFile = 'push-subscribers.json';
const dataFile = 'app-data.json';
let pushSubscribers = [];
let barcodeAssociations = {};
let scanLog = [];

if (fs.existsSync(pushSubscribersFile)) {
    pushSubscribers = JSON.parse(fs.readFileSync(pushSubscribersFile, 'utf8'));
}
// New: Load app data from file
if (fs.existsSync(dataFile)) {
    const appData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    barcodeAssociations = appData.barcodeAssociations;
    scanLog = appData.scanLog;
}

// API endpoint for your frontend to subscribe a new device
app.post('/api/subscribe-push', (req, res) => {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ message: 'Invalid subscription.' });
    }
    pushSubscribers.push(subscription);
    fs.writeFileSync(pushSubscribersFile, JSON.stringify(pushSubscribers));
    console.log('New push subscriber added:', subscription.endpoint);
    res.status(201).json({ message: 'Push subscription received.' });
});

// NEW: API endpoint to receive and save data from the frontend
app.post('/api/update-data', (req, res) => {
    barcodeAssociations = req.body.barcodeAssociations;
    scanLog = req.body.scanLog;
    fs.writeFileSync(dataFile, JSON.stringify({ barcodeAssociations, scanLog }));
    res.status(200).json({ message: 'Data updated successfully.' });
});

// NEW: Function to analyze scan log and build the message
function generateReportMessage() {
    if (!scanLog || scanLog.length === 0) {
        return 'No scanning activity to report.';
    }

    // Determine the most recent status for each person
    const latestStatus = {};
    for (const entry of scanLog) {
        latestStatus[entry.name] = entry.status;
    }

    let inOrCrewRestCount = 0;
    const outNames = [];

    for (const name in latestStatus) {
        const status = latestStatus[name];
        if (status === 'in' || status === 'on crew rest') {
            inOrCrewRestCount++;
        } else if (status === 'out') {
            outNames.push(name);
        }
    }

    let message = '';
    message += `Report: ${inOrCrewRestCount} people are IN or ON CREW REST.\n`;

    if (outNames.length > 0) {
        message += `Marked as OUT: ${outNames.join(', ')}.`;
    } else {
        message += 'No people are currently marked as OUT.';
    }

    return message;
}

// Function to send a push notification to all subscribers
async function sendPushNotification() {
    console.log('Sending push notification to all subscribers...');
    const message = generateReportMessage();
    const payload = JSON.stringify({
        title: 'Daily Barcode Report',
        body: message,
    });

    for (const subscription of pushSubscribers) {
        try {
            await webpush.sendNotification(subscription, payload);
            console.log('Notification sent to:', subscription.endpoint);
        } catch (error) {
            console.error('Failed to send push notification:', error);
        }
    }
}

// --- Scheduled Notification Job ---
// Sunday (0) through Thursday (4) at 22:30
cron.schedule('30 22 * * 0-4', () => {
    sendPushNotification();
}, {
    timezone: "America/Chicago"
});

// Saturday (6) and Sunday (0) at 02:00
cron.schedule('0 2 * * 0,6', () => {
    sendPushNotification();
}, {
    timezone: "America/Chicago"
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
