import jwt from "jsonwebtoken";
import User from "../models/users/user.model.js";

// @desc    Protect routes - Verify JWT
export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select("-password");

            if (!req.user) {
                return res.status(401).json({ message: "User not found" });
            }

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: "Not authorized, token failed" });
        }
    }

    if (!token) {
        res.status(401).json({ message: "Not authorized, no token" });
    }
};

import UserPermission from "../models/roles/userPermission.model.js";
import Module from "../models/roles/module.model.js";

// @desc    Authorize user based on permissions (Normalized Models)
export const authorize = (moduleSlug, action) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Not authorized" });
        }

        // Superadmin bypasses everything
        if (req.user.role === "superadmin") return next();

        try {
            // 1. Find the module by slug
            const module = await Module.findOne({ slug: moduleSlug });
            if (!module) {
                return res.status(500).json({ message: `System error: Module ${moduleSlug} not found` });
            }

            // 2. Find user's permission for this module
            const permission = await UserPermission.findOne({ 
                user: req.user._id, 
                module: module._id 
            });

            if (!permission) {
                return res.status(403).json({ message: `Access denied: No permissions set for module ${moduleSlug}` });
            }

            // 3. Map action string to model field
            const flagMap = {
                view: "canView",
                create: "canCreate",
                update: "canUpdate",
                delete: "canDelete"
            };

            const flag = flagMap[action];
            if (!flag || !permission[flag]) {
                return res.status(403).json({ message: `Access denied: Missing ${action} permission in ${moduleSlug}` });
            }

            next();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };
};
