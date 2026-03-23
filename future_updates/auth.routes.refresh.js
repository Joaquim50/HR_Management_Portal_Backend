import express from "express";
import { register, login, getMe, refreshToken } from "../../controllers/auth/auth.controller.js";
import { protect } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshToken); // New endpoint for token rotation
router.get("/me", protect, getMe);

export default router;
