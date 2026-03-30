import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: String,
    email: {
        type: String,
        unique: true,
    },
    password: String,
    role: {
        type: String,
        enum: ["superadmin", "staff"],
        default: "staff"
    },
    active: { type: Boolean, default: true },
    isInterviewer: { type: Boolean, default: false },
    permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
    refreshTokens: [String],

    resetPasswordToken: String,
    resetPasswordExpires: Date
}, { timestamps: true });

export default mongoose.model("User", userSchema);