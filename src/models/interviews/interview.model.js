import mongoose from "mongoose";

const interviewSchema = new mongoose.Schema({
    candidate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Candidate",
        required: true
    },
    jobOpening: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "JobOpening"
    },
    interviewer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    scheduledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    title: {
        type: String,
        default: ""
    },
    // Keep 'type' for backward compat, alias as roundType
    type: {
        type: String,
        enum: ["Screening", "Technical", "HR", "Cultural", "Offer", "Other"],
        default: "Technical"
    },
    scheduledAt: {
        type: Date,
        required: true
    },
    startTime: {
        type: Date
    },
    endTime: {
        type: Date
    },
    timezone: {
        type: String,
        default: "Asia/Kolkata"
    },
    duration: {
        type: Number, // in minutes
        default: 60
    },
    mode: {
        type: String,
        enum: ["Online", "Offline"],
        default: "Online"
    },
    location: {
        type: String, // Meeting link or physical address
    },
    notes: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        enum: ["Scheduled", "Completed", "Cancelled", "Rescheduled", "No Show"],
        default: "Scheduled"
    },
    // Calendar provider fields
    meetingProvider: {
        type: String,
        enum: ["google", "zoom", "teams", "none"],
        default: "none"
    },
    providerCalendarId: {
        type: String
    },
    providerEventId: {
        type: String
    },
    providerMeetingLink: {
        type: String
    },
    providerPayload: {
        type: mongoose.Schema.Types.Mixed
    },
    // Reschedule/Cancel metadata
    rescheduleReason: {
        type: String
    },
    cancellationReason: {
        type: String
    },
    completedAt: {
        type: Date
    },
    // Legacy feedback fields (used by InterviewerPortal)
    feedback: {
        type: String
    },
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    result: {
        type: String,
        enum: ["Pending", "Pass", "Fail"],
        default: "Pending"
    }
}, { timestamps: true });

// Indexes for efficient querying
interviewSchema.index({ candidate: 1 });
interviewSchema.index({ interviewer: 1 });
interviewSchema.index({ scheduledAt: 1 });
interviewSchema.index({ status: 1 });
interviewSchema.index({ interviewer: 1, scheduledAt: 1, status: 1 });

export default mongoose.model("Interview", interviewSchema);
