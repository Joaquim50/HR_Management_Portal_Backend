import Interview from "../models/interviews/interview.model.js";
import Candidate from "../models/candidates/candidate.model.js";
import User from "../models/users/user.model.js";
import Activity from "../models/dashboard/activity.model.js";
import { getCalendarProvider } from "../providers/calendar/calendarFactory.js";

/**
 * Interview Scheduling Service
 * 
 * Business logic layer — decoupled from Express.
 * Calls the calendar provider via factory, never directly touches Google SDK.
 */

// ─── Helpers ───────────────────────────────────────────────

/**
 * Check if a time range overlaps with any existing interviews for an interviewer
 */
async function checkInterviewerOverlap(interviewerId, startTime, endTime, excludeInterviewId = null) {
    const query = {
        interviewer: interviewerId,
        status: { $in: ["Scheduled", "Rescheduled"] },
        $or: [
            { startTime: { $lt: new Date(endTime) }, endTime: { $gt: new Date(startTime) } },
            // Fallback for legacy records using scheduledAt + duration
            {
                startTime: { $exists: false },
                scheduledAt: { $gte: new Date(startTime), $lt: new Date(endTime) }
            }
        ]
    };

    if (excludeInterviewId) {
        query._id = { $ne: excludeInterviewId };
    }

    const conflicting = await Interview.findOne(query);
    return conflicting;
}

// ─── Create Interview ──────────────────────────────────────

export async function createScheduledInterview(data, scheduledByUser) {
    const {
        candidateId, interviewerId, roundType, title,
        date, startTime, endTime, timezone, duration,
        mode, notes, jobOpeningId
    } = data;

    // 1. Validate candidate exists
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
        throw { status: 400, message: "Candidate not found" };
    }

    // 2. Validate interviewer exists and is active
    const interviewer = await User.findById(interviewerId);
    if (!interviewer) {
        throw { status: 400, message: "Interviewer not found" };
    }
    if (!interviewer.active) {
        throw { status: 400, message: "Interviewer is not active" };
    }
    if (!interviewer.isInterviewer && interviewer.role !== "superadmin") {
        throw { status: 400, message: "Selected user is not designated as an interviewer" };
    }

    // 3. Parse times
    const parsedStart = new Date(startTime);
    const parsedEnd = new Date(endTime);

    if (parsedStart >= parsedEnd) {
        throw { status: 400, message: "Start time must be before end time" };
    }
    if (parsedStart < new Date()) {
        throw { status: 400, message: "Cannot schedule interviews in the past" };
    }

    // 4. Check overlap
    const overlap = await checkInterviewerOverlap(interviewerId, parsedStart, parsedEnd);
    if (overlap) {
        throw { status: 409, message: "Interviewer already has an interview scheduled during this time slot" };
    }

    // 5. Build title
    const interviewTitle = title || `${roundType} Interview — ${candidate.name}`;

    // 6. Call calendar provider
    const calendarProvider = getCalendarProvider();
    let providerResult = { eventId: null, calendarId: null, meetingLink: null, rawPayload: null };

    try {
        const attendees = [interviewer.email];
        if (candidate.email) attendees.push(candidate.email);

        providerResult = await calendarProvider.createEvent({
            title: interviewTitle,
            description: `Round: ${roundType}\nCandidate: ${candidate.name}\nInterviewer: ${interviewer.name}\n\n${notes || ""}`,
            startTime: parsedStart,
            endTime: parsedEnd,
            timezone: timezone || "Asia/Kolkata",
            attendees,
            createMeetingLink: mode === "Online",
        });
    } catch (err) {
        console.error("[InterviewService] Calendar provider error (non-blocking):", err.message);
        // Don't throw — interview still gets saved, just without meeting link
    }

    // 7. Save to DB
    const interview = await Interview.create({
        candidate: candidateId,
        interviewer: interviewerId,
        scheduledBy: scheduledByUser._id,
        jobOpening: jobOpeningId || undefined,
        title: interviewTitle,
        type: roundType,
        scheduledAt: parsedStart,
        startTime: parsedStart,
        endTime: parsedEnd,
        timezone: timezone || "Asia/Kolkata",
        duration: duration || Math.round((parsedEnd - parsedStart) / 60000),
        mode: mode || "Online",
        location: providerResult.meetingLink || "",
        notes: notes || "",
        status: "Scheduled",
        meetingProvider: process.env.CALENDAR_PROVIDER || "none",
        providerCalendarId: providerResult.calendarId,
        providerEventId: providerResult.eventId,
        providerMeetingLink: providerResult.meetingLink,
        providerPayload: providerResult.rawPayload,
    });

    // 8. Update candidate's interviewer list & activity log
    const interviewerIdentity = interviewer.email || interviewer.name;
    await Candidate.findByIdAndUpdate(candidateId, {
        $addToSet: { interviewer: interviewerIdentity },
        $push: {
            activityLog: {
                date: new Date(),
                action: `Interview scheduled: ${roundType} on ${parsedStart.toLocaleDateString()}`,
                by: scheduledByUser.name || scheduledByUser.email
            }
        }
    });

    // 9. Log global activity
    await Activity.create({
        content: `Interview scheduled for ${candidate.name} (${roundType})`,
        type: "interview_scheduled",
        candidate: candidateId,
        user: scheduledByUser._id
    });

    // 10. Return populated interview
    return Interview.findById(interview._id)
        .populate("candidate", "name email phone role")
        .populate("interviewer", "name email")
        .populate("scheduledBy", "name email");
}

// ─── Reschedule Interview ──────────────────────────────────

export async function rescheduleInterview(interviewId, data, user) {
    const { startTime, endTime, timezone, rescheduleReason, notes } = data;

    const interview = await Interview.findById(interviewId);
    if (!interview) {
        throw { status: 404, message: "Interview not found" };
    }
    if (["Cancelled", "Completed"].includes(interview.status)) {
        throw { status: 400, message: `Cannot reschedule a ${interview.status.toLowerCase()} interview` };
    }

    const parsedStart = new Date(startTime);
    const parsedEnd = new Date(endTime);

    if (parsedStart >= parsedEnd) {
        throw { status: 400, message: "Start time must be before end time" };
    }
    if (parsedStart < new Date()) {
        throw { status: 400, message: "Cannot reschedule to a past time" };
    }

    // Check overlap (exclude current interview)
    const overlap = await checkInterviewerOverlap(interview.interviewer, parsedStart, parsedEnd, interviewId);
    if (overlap) {
        throw { status: 409, message: "Interviewer has a conflicting interview during this time" };
    }

    // Update calendar provider event
    if (interview.providerEventId) {
        try {
            const calendarProvider = getCalendarProvider();
            await calendarProvider.updateEvent({
                eventId: interview.providerEventId,
                calendarId: interview.providerCalendarId || "primary",
                startTime: parsedStart,
                endTime: parsedEnd,
                timezone: timezone || interview.timezone,
            });
        } catch (err) {
            console.error("[InterviewService] Calendar update failed (non-blocking):", err.message);
        }
    }

    // Update DB
    interview.startTime = parsedStart;
    interview.endTime = parsedEnd;
    interview.scheduledAt = parsedStart;
    interview.duration = Math.round((parsedEnd - parsedStart) / 60000);
    interview.timezone = timezone || interview.timezone;
    interview.status = "Rescheduled";
    interview.rescheduleReason = rescheduleReason || "";
    if (notes !== undefined) interview.notes = notes;
    await interview.save();

    // Activity log
    const candidate = await Candidate.findById(interview.candidate);
    if (candidate) {
        candidate.activityLog.push({
            date: new Date(),
            action: `Interview rescheduled to ${parsedStart.toLocaleDateString()}`,
            by: user.name || user.email
        });
        await candidate.save();

        await Activity.create({
            content: `Interview rescheduled for ${candidate.name}`,
            type: "interview_rescheduled",
            candidate: interview.candidate,
            user: user._id
        });
    }

    return Interview.findById(interviewId)
        .populate("candidate", "name email phone role")
        .populate("interviewer", "name email")
        .populate("scheduledBy", "name email");
}

// ─── Cancel Interview ──────────────────────────────────────

export async function cancelScheduledInterview(interviewId, cancellationReason, user) {
    const interview = await Interview.findById(interviewId);
    if (!interview) {
        throw { status: 404, message: "Interview not found" };
    }
    if (interview.status === "Cancelled") {
        throw { status: 400, message: "Interview is already cancelled" };
    }
    if (interview.status === "Completed") {
        throw { status: 400, message: "Cannot cancel a completed interview" };
    }

    // Cancel calendar event
    if (interview.providerEventId) {
        try {
            const calendarProvider = getCalendarProvider();
            await calendarProvider.cancelEvent(interview.providerEventId, interview.providerCalendarId || "primary");
        } catch (err) {
            console.error("[InterviewService] Calendar cancel failed (non-blocking):", err.message);
        }
    }

    interview.status = "Cancelled";
    interview.cancellationReason = cancellationReason || "";
    await interview.save();

    // Activity log
    const candidate = await Candidate.findById(interview.candidate);
    if (candidate) {
        candidate.activityLog.push({
            date: new Date(),
            action: `Interview cancelled: ${cancellationReason || "No reason provided"}`,
            by: user.name || user.email
        });
        await candidate.save();

        await Activity.create({
            content: `Interview cancelled for ${candidate.name}`,
            type: "interview_cancelled",
            candidate: interview.candidate,
            user: user._id
        });
    }

    return Interview.findById(interviewId)
        .populate("candidate", "name email phone role")
        .populate("interviewer", "name email");
}

// ─── Complete Interview ────────────────────────────────────

export async function completeScheduledInterview(interviewId, user) {
    const interview = await Interview.findById(interviewId);
    if (!interview) {
        throw { status: 404, message: "Interview not found" };
    }
    if (interview.status === "Completed") {
        throw { status: 400, message: "Interview is already completed" };
    }
    if (interview.status === "Cancelled") {
        throw { status: 400, message: "Cannot complete a cancelled interview" };
    }

    interview.status = "Completed";
    interview.completedAt = new Date();
    await interview.save();

    const candidate = await Candidate.findById(interview.candidate);
    if (candidate) {
        candidate.activityLog.push({
            date: new Date(),
            action: `Interview marked as completed`,
            by: user.name || user.email
        });
        await candidate.save();

        await Activity.create({
            content: `Interview completed for ${candidate.name}`,
            type: "interview_completed",
            candidate: interview.candidate,
            user: user._id
        });
    }

    return Interview.findById(interviewId)
        .populate("candidate", "name email phone role")
        .populate("interviewer", "name email");
}
