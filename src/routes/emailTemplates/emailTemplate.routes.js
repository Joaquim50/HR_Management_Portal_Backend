import express from "express";
import {
    getAllTemplates,
    getTemplateByType,
    updateTemplate
} from "../../controllers/emailTemplates/emailTemplate.controller.js";
import { protect, authorize } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protect, getAllTemplates);
router.get("/:type", protect, getTemplateByType);
router.put("/:type", protect, updateTemplate);

export default router;
