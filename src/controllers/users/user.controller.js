import User from "../../models/users/user.model.js";
import bcrypt from "bcryptjs";
// @desc    Get all users (Staff only)
// @route   GET /api/users
// @access  Private (Superadmin only)
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).select("-password");
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Create a user
// @route   POST /api/users
// @access  Private
export const createUser = async (req, res) => {
    try {
        const { name, email, password, role, active, permissions } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "User already exists" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password || "Password@123", salt);

        const user = new User({
            name,
            email,
            password: hashedPassword,
            role: role || "staff",
            active: active !== undefined ? active : true,
            permissions: permissions || {}
        });

        user.markModified('permissions');
        await user.save();
        res.status(201).json({ message: "User created successfully", user: { _id: user._id, name, email, role, active, permissions: user.permissions } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Update user details
// @route   PATCH /api/users/:id/details
// @access  Private
export const updateUserDetails = async (req, res) => {
    try {
        const { name, email, role, active, password, permissions } = req.body;
        const user = await User.findById(req.params.id);
        
        if (!user) return res.status(404).json({ message: "User not found" });

        if (name) user.name = name;
        if (email) user.email = email;
        if (role) user.role = role;
        if (active !== undefined) user.active = active;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }
        if (permissions) {
            user.permissions = permissions;
            user.markModified('permissions');
        }

        await user.save();
        res.json({ message: "User updated successfully", user: { _id: user._id, name: user.name, email: user.email, role: user.role, active: user.active, permissions: user.permissions } });
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

// @desc    Toggle interviewer access status
// @route   PATCH /api/users/:id/interviewer
// @access  Private (Superadmin only)
export const toggleInterviewerAccess = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.isInterviewer = !user.isInterviewer;
        await user.save();

        res.json({ message: `Interviewer access ${user.isInterviewer ? 'granted' : 'revoked'}`, isInterviewer: user.isInterviewer });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
