import dotenv from 'dotenv';
dotenv.config({ path: 'd:/practise/New folder (2)/HR_Management_Portal_Backend/.env' });

import { GoogleCalendarProvider } from './src/providers/calendar/googleCalendar.provider.js';

async function test() {
    console.log("Testing actual provider...");
    try {
        const provider = new GoogleCalendarProvider();
        
        console.log("Calling createEvent...");
        const result = await provider.createEvent({
            title: "Direct Test Interview",
            description: "Testing",
            startTime: new Date(Date.now() + 3600000).toISOString(),
            endTime: new Date(Date.now() + 7200000).toISOString(),
            timezone: "Asia/Kolkata",
            attendees: ["nupunsawant3930@gmail.com"],
            createMeetingLink: true
        });
        
        console.log("SUCCESS:", result);
    } catch (e) {
        console.error("FAILED:", e.message);
    }
}

test().then(() => {
    console.log("Done");
    process.exit(0);
});
