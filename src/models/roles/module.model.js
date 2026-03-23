import mongoose from "mongoose";

const moduleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    description: String,
    actions: {
        type: [String],
        default: ["view", "create", "update", "delete"]
    }
}, { timestamps: true });

export default mongoose.model("Module", moduleSchema);
