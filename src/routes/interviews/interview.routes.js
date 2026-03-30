import express from "express";
import {
    scheduleInterview,
    getInterviews,
    getInterviewById,
    updateInterviewSchedule,
    cancelInterview,
    completeInterview,
    getCandidateInterviews,
    getInterviewerInterviews,
    deleteInterview
} from "../../controllers/interviews/interview.controller.js";
import { protect, authorize } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// Specific routes MUST come before /:id to avoid conflicts
router.get("/candidate/:candidateId", protect, getCandidateInterviews);
router.get("/interviewer/:interviewerId", protect, getInterviewerInterviews);

router.route("/")
    .get(protect, getInterviews)
    .post(protect, authorize("pipeline", "create"), scheduleInterview);

router.route("/:id")
    .get(protect, getInterviewById)
    .put(protect, updateInterviewSchedule)
    .delete(protect, authorize("pipeline", "delete"), deleteInterview);

router.patch("/:id/cancel", protect, authorize("pipeline", "update"), cancelInterview);
router.patch("/:id/complete", protect, authorize("pipeline", "update"), completeInterview);

export default router;
