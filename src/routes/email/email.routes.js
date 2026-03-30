import express from "express";
import { sendCandidateTemplateEmail } from "../../controllers/email/email.controller.js";
import { protect } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// Apply protection to all email routes
router.use(protect);

router.post("/send", sendCandidateTemplateEmail);

export default router;
