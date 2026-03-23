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
        enum: ["superadmin", "admin", "staff", "interviewer"],
        default: "staff"
    },
    active: { type: Boolean, default: true },
    refreshTokens: [String]
}, { timestamps: true });

export default mongoose.model("User", userSchema);