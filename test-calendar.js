import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config({ path: 'd:/practise/New folder (2)/HR_Management_Portal_Backend/.env' });

async function testGoogleCalendar() {
    console.log("Starting Google Calendar test...");
    try {
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
        const impersonationEmail = process.env.GOOGLE_IMPERSONATION_EMAIL;

        if (!clientEmail || !privateKey) {
            throw new Error("Credentials missing in .env");
        }

        const auth = new google.auth.JWT({
            email: clientEmail,
            key: privateKey,
            scopes: ["https://www.googleapis.com/auth/calendar"],
            subject: impersonationEmail || undefined,
        });

        const calendar = google.calendar({ version: "v3", auth });

        console.log("Attempting to create a test event...");
        const event = {
            summary: "Test API Event",
            description: "Testing API access",
            start: {
                dateTime: new Date(Date.now() + 3600000).toISOString(),
                timeZone: 'Asia/Kolkata',
            },
            end: {
                dateTime: new Date(Date.now() + 7200000).toISOString(),
                timeZone: 'Asia/Kolkata',
            },
            conferenceData: {
                createRequest: {
                    requestId: `test-${Date.now()}`,
                    conferenceSolutionKey: { type: "hangoutsMeet" },
                },
            },
        };

        const response = await calendar.events.insert({
            calendarId: "primary",
            resource: event,
            conferenceDataVersion: 1,
        });

        console.log("Success! Event created with ID:", response.data.id);
        console.log("Meeting link:", response.data.hangoutLink);
        
    } catch (error) {
        console.error("EXPECTED ERROR FOUND:");
        console.error(error.message);
        if (error.response?.data) {
            console.error(JSON.stringify(error.response.data, null, 2));
        }
    }
}

testGoogleCalendar().then(() => process.exit(0)).catch(() => process.exit(1));
