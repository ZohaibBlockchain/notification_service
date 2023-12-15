require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

const default_notification = "com.p2pchatter.general_alert";

function getDateString() {
    const date = new Date();
    return date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

app.post('/_matrix/push/v1/notify', async (req, res) => {
    try {
        const { notification } = req.body;
        const registrationIds = notification.devices
            .filter(device => device.app_id === "com.p2pchatter.app")
            .map(device => device.pushkey);

        if (registrationIds.length === 0) {
            throw new Error("No pushkey found!");
        }

        const isMessage = typeof notification.event_id === "string" && notification.event_id !== "";
        const unread = notification.counts && notification.counts.unread || 0;
        const title = unread < 2 ? "Neue Nachricht" : `${unread} ungelesene Unterhaltungen`;

        const notifyData = {
            collapse_key: default_notification,
            badge: `${unread || "0"}`,
            data: notification,
            notification: isMessage ? {
                title,
                body: "App öffnen, um Nachricht zu entschlüsseln",
                badge: `${unread}`,
                sound: "default",
                icon: "notifications_icon",
                tag: default_notification,
                android_channel_id: "com.p2pchatter.app.message"
            } : undefined
        };

        notifyData.to = registrationIds.length === 1 ? registrationIds[0] : undefined;
        notifyData.registration_ids = registrationIds.length > 1 ? registrationIds : undefined;

        const response = await axios.post("https://fcm.googleapis.com/fcm/send", notifyData, {
            headers: {
                Authorization: `key=${process.env.ADMINKEY}`,
                "Content-Type": "application/json"
            }
        });

        console.log(`${getDateString()} Firebase response:`, response.data);
        const rejected = response.data.results
            .filter(result => result.error)
            .map((result, index) => registrationIds[index]);

        res.json({ rejected });
    } catch (error) {
        console.error(`${getDateString()} Exception:`, error);
        res.status(400).json({ errcode: "M_UNKNOWN", error: error.message });
    }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

