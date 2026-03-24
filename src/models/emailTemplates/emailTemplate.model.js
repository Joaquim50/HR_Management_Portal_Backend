import mongoose from "mongoose";

const emailTemplateSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ["rejection", "offer", "joining"],
        required: true,
        unique: true
    },
    subject: {
        type: String,
        required: true
    },
    body: {
        type: String,
        required: true
    },
    placeholders: {
        type: [String],
        default: []
    }
}, { timestamps: true });

export default mongoose.model("EmailTemplate", emailTemplateSchema);
