import mongoose from "mongoose";

const candidateSchema = new mongoose.Schema({
    // Core candidate info
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: String,
    submissionDate: String,
    role: {
        type: String,
        enum: ["FullStack MERN", "QA", "Flutter", "UI/UX", "Other"],
        default: "Other"
    },
    resumeLink: String,

    // Detailed Candidate Info (Promoted to top-level)
    candidateType: { type: String, enum: ["Experienced", "Fresher", "Intern", "Immediate Joiner", "Backup", "Other"], default: "Other" },
    totalExperience: String,
    relevantExperience: String,
    noticePeriod: String,
    currentCTC: String,
    expectedCTC: String,
    location: String,
    source: { type: String, default: "Direct" },
    portfolioLink: String,
    skills: [String],
    technologies: [String],
    hasLiveExperience: String,
    mumbaiComfort: String,

    // Status tracking
    status: {
        type: String,
        enum: [
            "New",
            "Screening",
            "Technical",
            "Offer",
            "Joined",
            "Rejected",
            "Backup"
        ],
        default: "New"
    },
    statusHistory: [
        {
            status: {
                type: String,
                enum: [
                    "New",
                    "Screening",
                    "Technical",
                    "Offer",
                    "Joined",
                    "Rejected",
                    "Backup"
                ]
            },
            changedAt: { type: Date, default: Date.now },
            changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
        }
    ],

    // Manual data (not in spreadsheet)
    tags: [String],
    feedbacks: [
        {
            stage: { type: String, enum: ["Screening", "Technical", "Offer"] },
            rating: { type: Number, min: 1, max: 5 },
            comments: String, // Can store HTML/Rich Text
            interviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            createdAt: { type: Date, default: Date.now }
        }
    ],

    // Flexible per-role details from forms
    details: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },
    screeningHistory: [
        {
            date: String,
            notes: String,
            by: String
        }
    ],
    technicalHistory: [
        {
            date: String,
            notes: String,
            rating: Number,
            by: String
        }
    ],
    offerHistory: [
        {
            date: String,
            notes: String,
            by: String
        }
    ],
    activityLog: [
        {
            date: String,
            action: String,
            by: String
        }
    ]
}, { timestamps: true });

export default mongoose.model("Candidate", candidateSchema);