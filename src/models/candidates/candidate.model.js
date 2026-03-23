import mongoose from "mongoose";

const candidateSchema = new mongoose.Schema({
    // Core candidate info
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: String,
    submissionDate: String,
    role: {
        type: String,
        enum: ["JR MERN", "SR MERN", "HR", "QA", "DevOps", "Other"],
        default: "Other"
    },
    resumeLink: String,
    source: { type: String, default: "Google Form" },

    // Status tracking
    status: {
        type: String,
        enum: [
            "Pending",
            "Shortlisted",
            "Interview Scheduled",
            "Interviewed",
            "Rejected",
            "Hired"
        ],
        default: "Pending"
    },
    statusHistory: [
        {
            status: {
                type: String,
                enum: [
                    "Pending",
                    "Shortlisted",
                    "Interview Scheduled",
                    "Interviewed",
                    "Rejected",
                    "Hired"
                ]
            },
            changedAt: { type: Date, default: Date.now },
            changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" } // optional, track who updated
        }
    ],

    // Interview info
    interview: {
        scheduledAt: Date,
        interviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // link to User model
        result: { type: String, enum: ["Pending", "Passed", "Failed"], default: "Pending" },
        feedback: String // optional notes
    },

    // Flexible per-role details from forms
    details: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    }
}, { timestamps: true });

export default mongoose.model("Candidate", candidateSchema);