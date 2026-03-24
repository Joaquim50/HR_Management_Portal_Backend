import express from "express";
import { getDashboardStats } from "../../controllers/dashboard/dashboard.controller.js";
import { protect, authorize } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// Get Dashboard Data
router.get("/", protect, authorize("dashboard", "view"), getDashboardStats);

export default router;
