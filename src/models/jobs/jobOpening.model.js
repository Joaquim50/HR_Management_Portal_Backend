import mongoose from "mongoose";

const jobOpeningSchema = new mongoose.Schema({
    role: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String
    },
    requiredCount: {
        type: Number,
        default: 1
    },
    hiredCount: {
        type: Number,
        default: 0
    },
    rejectedCount: {
        type: Number,
        default: 0
    },
    backupCount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ["Open", "Closed"],
        default: "Open"
    },
    active: {
        type: Boolean,
        default: true
    },
    category: {
        type: String,
        enum: ["Full-time", "Part-time", "Intern", "Contract"],
        default: "Full-time"
    }
}, { timestamps: true });

// Virtual for remaining count
jobOpeningSchema.virtual("remainingCount").get(function() {
    return Math.max(0, this.requiredCount - this.hiredCount);
});

// Virtual for progress percentage
jobOpeningSchema.virtual("progress").get(function() {
    if (this.requiredCount === 0) return 0;
    return Math.round((this.hiredCount / this.requiredCount) * 100);
});

// Ensure virtuals are included in JSON output
jobOpeningSchema.set("toJSON", { virtuals: true });
jobOpeningSchema.set("toObject", { virtuals: true });

export default mongoose.model("JobOpening", jobOpeningSchema);
