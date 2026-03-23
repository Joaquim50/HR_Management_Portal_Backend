import mongoose from "mongoose";

const userPermissionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    module: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Module",
        required: true
    },
    // Granular flags
    canView: { type: Boolean, default: false },
    canCreate: { type: Boolean, default: false },
    canUpdate: { type: Boolean, default: false },
    canDelete: { type: Boolean, default: false }
}, { timestamps: true });

// Ensure a user has only one permission record per module
userPermissionSchema.index({ user: 1, module: 1 }, { unique: true });

export default mongoose.model("UserPermission", userPermissionSchema);
