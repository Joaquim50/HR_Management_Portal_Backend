import mongoose from "mongoose";

const interviewSchema = new mongoose.Schema({
    candidate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Candidate",
        required: true
    },
    jobOpening: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "JobOpening",
        required: true
    },
    interviewer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    scheduledAt: {
        type: Date,
        required: true
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
        type: String, // Meeting link or address
    },
    type: {
        type: String,
        enum: ["Technical", "HR", "Cultural", "Other"],
        default: "Technical"
    },
    status: {
        type: String,
        enum: ["Scheduled", "Completed", "Cancelled", "Rescheduled"],
        default: "Scheduled"
    },
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

export default mongoose.model("Interview", interviewSchema);
