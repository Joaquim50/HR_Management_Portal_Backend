import { GoogleCalendarProvider } from "./googleCalendar.provider.js";

/**
 * Calendar Provider Factory
 * 
 * Returns the configured calendar provider based on CALENDAR_PROVIDER env var.
 * To add a new provider:
 *   1. Create a new file (e.g., zoomCalendar.provider.js)
 *   2. Implement CalendarProviderInterface
 *   3. Add a case here
 *   4. Set CALENDAR_PROVIDER=zoom in .env
 */

const providers = {};

/**
 * Get the calendar provider instance (singleton per provider type)
 * @returns {import('./calendarProvider.interface.js').CalendarProviderInterface}
 */
export function getCalendarProvider() {
    const providerName = (process.env.CALENDAR_PROVIDER || "google").toLowerCase();

    if (providers[providerName]) {
        return providers[providerName];
    }

    let provider;

    switch (providerName) {
        case "google":
            provider = new GoogleCalendarProvider();
            break;
        // Future providers:
        // case "zoom":
        //     provider = new ZoomCalendarProvider();
        //     break;
        // case "teams":
        //     provider = new TeamsCalendarProvider();
        //     break;
        case "none":
            // No-op provider for development/testing without calendar integration
            provider = {
                async createEvent() {
                    return { eventId: null, calendarId: null, meetingLink: null, rawPayload: null };
                },
                async updateEvent() {
                    return { eventId: null, calendarId: null, meetingLink: null, rawPayload: null };
                },
                async cancelEvent() {
                    return { success: true };
                },
            };
            break;
        default:
            throw new Error(`Unknown calendar provider: "${providerName}". Supported: google, none`);
    }

    providers[providerName] = provider;
    return provider;
}
