import express from "express";
import { register, login, getMe } from "../../controllers/auth/auth.controller.js";
import { protect, authorize } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, authorize("view_profile"), getMe);

export default router;