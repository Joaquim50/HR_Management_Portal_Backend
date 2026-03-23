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
    .get(protect, authorize("pipeline", "view"), getInterviews) // Using 'pipeline' as slug since it's in the sidebar
    .post(protect, authorize("pipeline", "create"), scheduleInterview);

router.route("/:id")
    .get(protect, authorize("pipeline", "view"), getInterviewById)
    .put(protect, authorize("pipeline", "update"), updateInterview)
    .delete(protect, authorize("pipeline", "delete"), deleteInterview);

export default router;
