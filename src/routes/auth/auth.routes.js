import express from "express";
import { register, login, getMe, refreshToken, logout } from "../../controllers/auth/auth.controller.js";
import { protect, authorize } from "../../middlewares/auth.middleware.js";
import { forgotPassword, resetPassword } from "../../controllers/auth/auth.controller.js";


const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshToken);
router.post("/logout", protect, logout);
router.get("/me", protect, authorize("view_profile"), getMe);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;