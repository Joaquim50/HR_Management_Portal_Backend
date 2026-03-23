import express from "express";
import {
    createJobOpening,
    getJobOpenings,
    getJobOpeningById,
    updateJobOpening,
    deleteJobOpening
} from "../../controllers/jobs/jobOpening.controller.js";
import { protect, authorize } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.route("/")
    .get(protect, authorize("job-openings", "view"), getJobOpenings)
    .post(protect, authorize("job-openings", "create"), createJobOpening);

router.route("/:id")
    .get(protect, authorize("job-openings", "view"), getJobOpeningById)
    .put(protect, authorize("job-openings", "update"), updateJobOpening)
    .delete(protect, authorize("job-openings", "delete"), deleteJobOpening);

export default router;
