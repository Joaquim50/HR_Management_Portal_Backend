import express from "express";
import { 
    getAllUsers, 
    getUserById, 
    createUser,
    updateUserDetails,
    updateUserPermissions, 
    getUserPermissions,
    toggleUserStatus,
    toggleInterviewerAccess
} from "../../controllers/users/user.controller.js";
import { 
    createModule, 
    getModules, 
    updateModule, 
    deleteModule 
} from "../../controllers/roles/module.controller.js";
import { protect } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// Module Management (Superadmin Only)
router.post("/modules", protect, createModule);
router.get("/modules", protect, getModules);
router.patch("/modules/:id", protect, updateModule);
router.delete("/modules/:id", protect, deleteModule);

// User Management
router.post("/", protect, createUser);
router.get("/", protect, getAllUsers);
router.get("/:id", protect, getUserById);
router.get("/:id/permissions", protect, getUserPermissions);
router.patch("/:id/details", protect, updateUserDetails);
router.patch("/:id/permissions", protect, updateUserPermissions);
router.patch("/:id/status", protect, toggleUserStatus);
router.patch("/:id/interviewer", protect, toggleInterviewerAccess);

export default router;
