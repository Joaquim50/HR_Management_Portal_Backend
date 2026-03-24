import mongoose from "mongoose";

const activitySchema = new mongoose.Schema({
    content: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["status_change", "new_candidate", "interview_scheduled", "hired", "rejected"],
        required: true
    },
    candidate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Candidate"
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
}, { timestamps: true });

export default mongoose.model("Activity", activitySchema);
