import express from "express";
import {
    syncCandidates,
    bulkImportExcel,
    getCandidates,
    getCandidateById,
    createCandidate,
    updateCandidateStatus,
    deleteCandidate
} from "../../controllers/candidates/candidate.controller.js";
import { protect, authorize } from "../../middlewares/auth.middleware.js";
import upload from "../../middlewares/upload.middleware.js";

const router = express.Router();

// Bulk Operations
router.post("/sync", protect, authorize("candidates", "create"), syncCandidates);
router.post("/import", protect, authorize("candidates", "create"), upload.single("file"), bulkImportExcel);

// Standard CRUD
router.get("/", protect, authorize("candidates", "view"), getCandidates);
router.get("/:id", protect, authorize("candidates", "view"), getCandidateById);
router.post("/", protect, authorize("candidates", "create"), upload.single("resume"), createCandidate);
router.patch("/:id/status", protect, authorize("candidates", "update"), updateCandidateStatus);
router.delete("/:id", protect, authorize("candidates", "delete"), deleteCandidate);

export default router;
