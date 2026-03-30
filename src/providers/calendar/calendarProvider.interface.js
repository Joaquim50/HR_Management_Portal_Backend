/**
 * Calendar Provider Interface
 * 
 * All calendar providers must implement these methods.
 * This abstraction allows swapping providers (Google, Zoom, Teams, etc.)
 * without changing business logic.
 * 
 * @typedef {Object} CreateEventInput
 * @property {string} title - Event title
 * @property {string} description - Event description/notes
 * @property {Date|string} startTime - Event start time (ISO string or Date)
 * @property {Date|string} endTime - Event end time (ISO string or Date)
 * @property {string} timezone - IANA timezone (e.g. "Asia/Kolkata")
 * @property {string[]} attendees - List of attendee email addresses
 * @property {boolean} [createMeetingLink=true] - Whether to generate a video meeting link
 * 
 * @typedef {Object} UpdateEventInput
 * @property {string} eventId - Provider's event ID to update
 * @property {string} calendarId - Provider's calendar ID
 * @property {string} [title] - Updated title
 * @property {string} [description] - Updated description
 * @property {Date|string} [startTime] - Updated start time
 * @property {Date|string} [endTime] - Updated end time
 * @property {string} [timezone] - Updated timezone
 * @property {string[]} [attendees] - Updated attendees list
 * 
 * @typedef {Object} CalendarEventResult
 * @property {string} eventId - Provider's event ID
 * @property {string} calendarId - Provider's calendar ID
 * @property {string|null} meetingLink - Video meeting URL (e.g. Google Meet link)
 * @property {Object} [rawPayload] - Full provider response for debugging
 */

/**
 * Base class for calendar providers.
 * Each provider (Google, Zoom, Teams) extends this and implements all methods.
 */
export class CalendarProviderInterface {
    /**
     * Create a new calendar event with optional video meeting link
     * @param {CreateEventInput} input
     * @returns {Promise<CalendarEventResult>}
     */
    async createEvent(input) {
        throw new Error("createEvent() must be implemented by the provider");
    }

    /**
     * Update an existing calendar event
     * @param {UpdateEventInput} input
     * @returns {Promise<CalendarEventResult>}
     */
    async updateEvent(input) {
        throw new Error("updateEvent() must be implemented by the provider");
    }

    /**
     * Cancel/delete a calendar event
     * @param {string} eventId - Provider's event ID
     * @param {string} calendarId - Provider's calendar ID
     * @returns {Promise<{ success: boolean }>}
     */
    async cancelEvent(eventId, calendarId) {
        throw new Error("cancelEvent() must be implemented by the provider");
    }
}
