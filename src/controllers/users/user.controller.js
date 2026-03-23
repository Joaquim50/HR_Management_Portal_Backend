import User from "../../models/users/user.model.js";

// @desc    Get all users (Staff only)
// @route   GET /api/users
// @access  Private (Superadmin only)
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({ role: "staff" }).select("-password");
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private (Superadmin only)
export const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-password");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

import UserPermission from "../../models/roles/userPermission.model.js";
import Module from "../../models/roles/module.model.js";

// @desc    Update user permissions (Normalized Models)
// @route   PATCH /api/users/:id/permissions
// @access  Private (Superadmin only)
export const updateUserPermissions = async (req, res) => {
    try {
        const { moduleId, canView, canCreate, canUpdate, canDelete } = req.body;
        const userId = req.params.id;

        // 1. Verify module exists
        const module = await Module.findById(moduleId);
        if (!module) {
            return res.status(404).json({ message: "Module not found" });
        }

        // 2. Create or update the permission record
        const permission = await UserPermission.findOneAndUpdate(
            { user: userId, module: moduleId },
            { canView, canCreate, canUpdate, canDelete },
            { new: true, upsert: true }
        );

        res.json({ message: "Permissions updated successfully", permission });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get all permissions for a user
// @route   GET /api/users/:id/permissions
export const getUserPermissions = async (req, res) => {
    try {
        const permissions = await UserPermission.find({ user: req.params.id }).populate("module");
        res.json(permissions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Toggle user active status
// @route   PATCH /api/users/:id/status
// @access  Private (Superadmin only)
export const toggleUserStatus = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.active = !user.active;
        await user.save();

        res.json({ message: `User ${user.active ? 'activated' : 'deactivated'}`, active: user.active });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
