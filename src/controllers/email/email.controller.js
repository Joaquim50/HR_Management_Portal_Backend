import Candidate from "../../models/candidates/candidate.model.js";
import EmailTemplate from "../../models/emailTemplates/emailTemplate.model.js";
import { sendMail, populateTemplate } from "../../services/email.service.js";
import Activity from "../../models/dashboard/activity.model.js";

// @desc    Send a manual email to a candidate using a template or custom body
// @route   POST /api/email/send
// @access  Private (Admin/Superadmin)
export const sendCandidateTemplateEmail = async (req, res) => {
    try {
        const { candidateId, templateId, customSubject, customBody } = req.body;

        if (!candidateId) {
            return res.status(400).json({ message: "candidateId is required" });
        }

        const candidate = await Candidate.findById(candidateId);
        if (!candidate) {
            return res.status(404).json({ message: "Candidate not found" });
        }

        let subject = customSubject;
        let body = customBody;

        // If a templateId is provided, fetch it and populate it (if subject/body not fully custom)
        if (templateId) {
            const template = await EmailTemplate.findById(templateId);
            if (!template) {
                return res.status(404).json({ message: "Email template not found" });
            }
            
            // Only use template defaults if custom ones aren't provided
            if (!subject) subject = template.subject;
            if (!body) body = template.body;

            // Always run population on the final text to ensure placeholders are resolved
            const populated = populateTemplate(subject, body, candidate);
            subject = populated.subject;
            body = populated.body;
        }

        if (!subject || !body) {
            return res.status(400).json({ message: "Subject and body are required (via template or custom input)" });
        }

        // Send the email
        const result = await sendMail({
            to: candidate.email,
            subject,
            body
        });

        // Log activity
        await Activity.create({
            content: `Email sent to ${candidate.name}: ${subject}`,
            type: "email_sent",
            candidate: candidateId,
            user: req.user?._id || req.user?.id
        });

        res.json({
            message: "Email sent successfully",
            previewUrl: result.previewUrl,
            messageId: result.messageId
        });
    } catch (error) {
        console.error("❌ Error in sendCandidateTemplateEmail:", error.message);
        res.status(500).json({ error: error.message });
    }
};
