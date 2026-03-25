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

// @desc    Authorize user based on permissions (Embedded in User Model)
export const authorize = (moduleSlug, action) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Not authorized" });
        }

        // Superadmin bypasses everything
        if (req.user.role === "superadmin") return next();

        try {
            const permissions = req.user.permissions || {};
            let hasAccess = false;
            
            // Map action string (view, create, update, delete)
            const flagMap = {
                view: "view",
                create: "create",
                update: "update",
                delete: "delete"
            };
            const actionFlag = flagMap[action] || action;

            // Search the nested permissions structure: permissions[section][module][action]
            // moduleSlug passed from route is typically the section (e.g., 'candidates', 'jobs')
            if (permissions[moduleSlug]) {
                const sectionPerms = permissions[moduleSlug];
                for (const modKey in sectionPerms) {
                    if (sectionPerms[modKey] && sectionPerms[modKey][actionFlag] === true) {
                        hasAccess = true;
                        break;
                    }
                }
            }

            // Fallback: search all sections just in case the moduleSlug matches the inner module key
            if (!hasAccess) {
                for (const secKey in permissions) {
                    const sectionPerms = permissions[secKey];
                    if (sectionPerms[moduleSlug] && sectionPerms[moduleSlug][actionFlag] === true) {
                        hasAccess = true;
                        break;
                    }
                }
            }

            if (!hasAccess) {
                return res.status(403).json({ message: `Access denied: Missing ${action} permission for ${moduleSlug}` });
            }

            next();
        } catch (error) {
            console.error("Auth Middleware Error:", error);
            res.status(500).json({ error: error.message });
        }
    };
};
