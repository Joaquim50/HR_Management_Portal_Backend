import { google } from "googleapis";
import { CalendarProviderInterface } from "./calendarProvider.interface.js";

/**
 * Google Calendar + Meet provider implementation.
 * 
 * Uses a Google Service Account with domain-wide delegation.
 * Credentials are read from environment variables:
 *   GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_IMPERSONATION_EMAIL, GOOGLE_DEFAULT_TIMEZONE
 */
export class GoogleCalendarProvider extends CalendarProviderInterface {
    constructor() {
        super();
        this.timezone = process.env.GOOGLE_DEFAULT_TIMEZONE || "Asia/Kolkata";
    }

    /**
     * Get an authenticated Google Calendar API client
     */
    _getCalendarClient() {
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
        let privateKey = process.env.GOOGLE_PRIVATE_KEY;
        if (privateKey) {
            // Strip leading/trailing quotes and trims, remove carriage returns
            privateKey = privateKey.trim()
                .replace(/^"|"$/g, '')
                .trim()
                .replace(/\\n/g, "\n")
                .replace(/\r/g, "");
        }
        const impersonationEmail = process.env.GOOGLE_IMPERSONATION_EMAIL;

        if (!clientEmail || !privateKey) {
            throw new Error("Google Calendar credentials not configured. Set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY in .env");
        }

        const auth = new google.auth.JWT({
            email: clientEmail,
            key: privateKey,
            scopes: ["https://www.googleapis.com/auth/calendar"],
            subject: impersonationEmail || undefined,
        });

        return google.calendar({ version: "v3", auth });
    }

    /**
     * Create a Google Calendar event with auto-generated Google Meet link
     * @param {import('./calendarProvider.interface.js').CreateEventInput} input
     * @returns {Promise<import('./calendarProvider.interface.js').CalendarEventResult>}
     */
    async createEvent(input) {
        const calendar = this._getCalendarClient();
        const { title, description, startTime, endTime, timezone, attendees, createMeetingLink = true } = input;

        const event = {
            summary: title,
            description: description || "",
            start: {
                dateTime: new Date(startTime).toISOString(),
                timeZone: timezone || this.timezone,
            },
            end: {
                dateTime: new Date(endTime).toISOString(),
                timeZone: timezone || this.timezone,
            },
            attendees: (attendees || []).map(email => ({ email })),
        };

        // Request Google Meet link creation
        if (createMeetingLink) {
            event.conferenceData = {
                createRequest: {
                    requestId: `interview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    conferenceSolutionKey: { type: "hangoutsMeet" },
                },
            };
        }

        try {
            const response = await calendar.events.insert({
                calendarId: "primary",
                resource: event,
                conferenceDataVersion: createMeetingLink ? 1 : 0,
                sendUpdates: "all",
            });

            const meetingLink = response.data.conferenceData?.entryPoints?.find(
                ep => ep.entryPointType === "video"
            )?.uri || response.data.hangoutLink || null;

            return {
                eventId: response.data.id,
                calendarId: "primary",
                meetingLink,
                rawPayload: response.data,
            };
        } catch (error) {
            console.error("[GoogleCalendar] Failed to create event:", error.message);
            throw new Error(`Google Calendar event creation failed: ${error.message}`);
        }
    }

    /**
     * Update an existing Google Calendar event
     * @param {import('./calendarProvider.interface.js').UpdateEventInput} input
     * @returns {Promise<import('./calendarProvider.interface.js').CalendarEventResult>}
     */
    async updateEvent(input) {
        const calendar = this._getCalendarClient();
        const { eventId, calendarId = "primary", title, description, startTime, endTime, timezone, attendees } = input;

        const updatePayload = {};
        if (title) updatePayload.summary = title;
        if (description !== undefined) updatePayload.description = description;
        if (startTime) {
            updatePayload.start = {
                dateTime: new Date(startTime).toISOString(),
                timeZone: timezone || this.timezone,
            };
        }
        if (endTime) {
            updatePayload.end = {
                dateTime: new Date(endTime).toISOString(),
                timeZone: timezone || this.timezone,
            };
        }
        if (attendees) {
            updatePayload.attendees = attendees.map(email => ({ email }));
        }

        try {
            const response = await calendar.events.patch({
                calendarId,
                eventId,
                resource: updatePayload,
                sendUpdates: "all",
            });

            const meetingLink = response.data.conferenceData?.entryPoints?.find(
                ep => ep.entryPointType === "video"
            )?.uri || response.data.hangoutLink || null;

            return {
                eventId: response.data.id,
                calendarId,
                meetingLink,
                rawPayload: response.data,
            };
        } catch (error) {
            console.error("[GoogleCalendar] Failed to update event:", error.message);
            throw new Error(`Google Calendar event update failed: ${error.message}`);
        }
    }

    /**
     * Cancel/delete a Google Calendar event
     * @param {string} eventId
     * @param {string} calendarId
     * @returns {Promise<{ success: boolean }>}
     */
    async cancelEvent(eventId, calendarId = "primary") {
        const calendar = this._getCalendarClient();

        try {
            await calendar.events.delete({
                calendarId,
                eventId,
                sendUpdates: "all",
            });
            return { success: true };
        } catch (error) {
            // If the event is already deleted, treat as success
            if (error.code === 410 || error.code === 404) {
                console.warn("[GoogleCalendar] Event already deleted:", eventId);
                return { success: true };
            }
            console.error("[GoogleCalendar] Failed to cancel event:", error.message);
            throw new Error(`Google Calendar event cancellation failed: ${error.message}`);
        }
    }
}
