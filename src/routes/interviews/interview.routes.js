import express from "express";
import {
    scheduleInterview,
    getInterviews,
    getInterviewById,
    updateInterview,
    deleteInterview
} from "../../controllers/interviews/interview.controller.js";
import { protect, authorize } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.route("/")
    .get(protect, getInterviews) // Security handled in controller for interviewers
    .post(protect, authorize("pipeline", "create"), scheduleInterview);

router.route("/:id")
    .get(protect, getInterviewById) // Security handled in controller for interviewers
    .put(protect, updateInterview) // Security handled in controller for interviewers
    .delete(protect, authorize("pipeline", "delete"), deleteInterview);

export default router;
