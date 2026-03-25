import nodemailer from "nodemailer";
import EmailTemplate from "../models/emailTemplates/emailTemplate.model.js";
import dotenv from "dotenv";

dotenv.config();

let transporter;

const initializeTransporter = async () => {
    if (transporter) return transporter;

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        // Use Real SMTP credentials from .env
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_PORT == 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        console.log("📨 Real SMTP Transporter initialized");
    } else {
        // Fallback to fake Ethereal email for testing
        console.log("⚠️ No SMTP credentials found in .env. Generating fake Ethereal account for testing...");
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
        console.log("📨 Fake Ethereal Transporter initialized");
    }
    return transporter;
};

// Map Candidate Status to Template Type
const statusToTemplateMap = {
    "Offer": "offer",
    "Joined": "joining",
    "Rejected": "rejection"
};

export const sendCandidateEmail = async (candidate, newStatus) => {
    try {
        const templateType = statusToTemplateMap[newStatus];
        if (!templateType) {
             // Not a status that triggers an automated email
            return;
        }

        // 1. Fetch template from DB
        const template = await EmailTemplate.findOne({ type: templateType });
        if (!template) {
            console.error(`❌ EmailTemplate for type '${templateType}' not found in DB!`);
            return;
        }

        // 2. Parse placeholders
        let finalSubject = template.subject;
        let finalBody = template.body;

        const replacements = {
            "{{candidate_name}}": candidate.name || "",
            "{{role}}": candidate.role || "",
            "{{offered_ctc}}": candidate.details?.get("expectedCTC") || candidate.expectedCTC || "TBD",
            "{{joining_date}}": "TBD", // Update logic here if a Joining Date field is added
            "{{location}}": candidate.location || "Remote/Office"
        };

        for (const [placeholder, value] of Object.entries(replacements)) {
            const regex = new RegExp(`\\{\\{${placeholder.replace(/[{}]/g, "")}\\}\\}`, "g");
            finalSubject = finalSubject.replace(regex, value);
            finalBody = finalBody.replace(regex, value);
        }

        // 3. Send Email
        const mailer = await initializeTransporter();
        const fromEmail = process.env.FROM_EMAIL || '"Metaphi Innovations HR" <hr@metaphi.com>';

        const info = await mailer.sendMail({
            from: fromEmail,
            to: candidate.email,
            subject: finalSubject,
            text: finalBody,
        });

        console.log(`✅ Email sent to ${candidate.email} for status: ${newStatus}`);
        
        // Auto-generate preview URL if testing via Ethereal
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`👁️ Open to Preview Email: ${previewUrl}`);
        }

    } catch (error) {
        console.error("❌ Error sending candidate email:", error.message);
    }
};
