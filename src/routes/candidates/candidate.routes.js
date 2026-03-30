import express from "express";
import {
    syncCandidates,
    bulkImportExcel,
    getCandidates,
    getCandidateById,
    createCandidate,
    updateCandidateStatus,
    updateCandidate,
    deleteCandidate,
    addCandidateTag,
    removeCandidateTag,
    addCandidateSkill,
    removeCandidateSkill,
    addCandidateTechnology,
    removeCandidateTechnology,
    saveCandidateFeedback,
    uploadCandidateResume,
    bulkUpdateCandidates
} from "../../controllers/candidates/candidate.controller.js";
import { protect, authorize } from "../../middlewares/auth.middleware.js";
import upload from "../../middlewares/upload.middleware.js";

const router = express.Router();

// Bulk Operations
router.post("/sync", protect, authorize("candidates", "create"), syncCandidates);
router.post("/import", protect, authorize("candidates", "create"), upload.single("file"), bulkImportExcel);
router.post("/bulk-update", protect, authorize("candidates", "update"), bulkUpdateCandidates);

// Standard CRUD
router.get("/", protect, getCandidates); // Security handled in controller for interviewers
router.get("/:id", protect, getCandidateById); // Security handled in controller for interviewers
router.post("/", protect, authorize("candidates", "create"), upload.single("resume"), createCandidate);
router.put("/:id", protect, upload.single("resume"), updateCandidate); // Security handled in controller
router.patch("/:id/status", protect, updateCandidateStatus); // Security handled in controller or can be added
router.delete("/:id", protect, authorize("candidates", "delete"), deleteCandidate);

// Manual Data (Tags & Feedback)
router.post("/:id/tags", protect, authorize("candidates", "update"), addCandidateTag);
router.delete("/:id/tags", protect, authorize("candidates", "update"), removeCandidateTag);
router.post("/:id/skills", protect, authorize("candidates", "update"), addCandidateSkill);
router.delete("/:id/skills", protect, authorize("candidates", "update"), removeCandidateSkill);
router.post("/:id/technologies", protect, authorize("candidates", "update"), addCandidateTechnology);
router.delete("/:id/technologies", protect, authorize("candidates", "update"), removeCandidateTechnology);
router.post("/:id/feedback", protect, saveCandidateFeedback); // Security should be added to saveCandidateFeedback too
router.post("/:id/resume", protect, authorize("candidates", "update"), upload.single("resume"), uploadCandidateResume);

export default router;

