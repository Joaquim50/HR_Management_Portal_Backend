import nodemailer from "nodemailer";
import EmailTemplate from "../models/emailTemplates/emailTemplate.model.js";
import dotenv from "dotenv";

import path from "path";

// Ensure .env is loaded from the root directory
dotenv.config({ path: path.join(process.cwd(), ".env") });

let transporter;

const initializeTransporter = async () => {
    if (transporter) return transporter;

    // Standardize and trim SMTP credentials
    const host = (process.env.SMTP_HOST || "").trim();
    const user = (process.env.SMTP_USER || "").trim();
    const pass = (process.env.SMTP_PASS || "").trim();
    const port = parseInt(process.env.SMTP_PORT || "587");

    if (host && user && pass) {
        // Use Real SMTP credentials from .env
        console.log(`📨 Initializing Real SMTP Transporter (${host})...`);
        
        const transportConfig = host.includes('gmail') 
            ? { service: 'gmail', auth: { user, pass } }
            : {
                host: host,
                port: port,
                secure: port === 465,
                auth: { user, pass },
                tls: { rejectUnauthorized: false }
            };

        transporter = nodemailer.createTransport(transportConfig);
        
        try {
            // Verify connection
            await transporter.verify();
            console.log("✅ Real SMTP Transporter verified and ready");
        } catch (err) {
            console.error("❌ SMTP Verification Failed, falling back to Ethereal:", err.message);
            transporter = null; // Reset to trigger fallback below
        }
    }

    if (!transporter) {
        // Fallback to fake Ethereal email for testing
        console.log("⚠️ Using fake Ethereal account for testing...");
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

// Helper to populate template placeholders
export const populateTemplate = (subject, body, candidate) => {
    let finalSubject = subject;
    let finalBody = body;

    const replacements = {
        "{{candidate_name}}": candidate.name || "",
        "{{role}}": candidate.role || "",
        "{{offered_ctc}}": candidate.details?.get?.("expectedCTC") || candidate.details?.expectedCTC || candidate.expectedCTC || "TBD",
        "{{joining_date}}": candidate.joiningDate || "TBD",
        "{{location}}": candidate.location || "Remote/Office",
        "{{notice_period}}": candidate.noticePeriod || "TBD",
        "{{experience}}": candidate.totalExperience || "TBD"
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
        const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
        finalSubject = finalSubject.replace(regex, value);
        finalBody = finalBody.replace(regex, value);
    }

    return { subject: finalSubject, body: finalBody };
};

// Generic mail sender
export const sendMail = async ({ to, subject, body }) => {
    try {
        const mailer = await initializeTransporter();
        const fromEmail = process.env.FROM_EMAIL || '"Metaphi Innovations HR" <hr@metaphi.com>';

        const info = await mailer.sendMail({
            from: fromEmail,
            to,
            subject,
            text: body,
            html: body.replace(/\n/g, "<br/>") // Basic text-to-html conversion
        });

        const isTestAccount = mailer.options.host === "smtp.ethereal.email";
        const previewUrl = isTestAccount ? nodemailer.getTestMessageUrl(info) : null;
        
        return { 
            success: true, 
            messageId: info.messageId, 
            previewUrl,
            isTest: isTestAccount
        };
    } catch (error) {
        console.error("❌ Error in sendMail service:", error.message);
        throw error;
    }
};

export const sendCandidateEmail = async (candidate, newStatus) => {
    try {
        const templateType = statusToTemplateMap[newStatus];
        if (!templateType) {
            return;
        }

        const template = await EmailTemplate.findOne({ type: templateType });
        if (!template) {
            console.error(`❌ EmailTemplate for type '${templateType}' not found in DB!`);
            return;
        }

        const { subject, body } = populateTemplate(template.subject, template.body, candidate);
        await sendMail({ to: candidate.email, subject, body });

        console.log(`✅ Automated email sent to ${candidate.email} for status: ${newStatus}`);
    } catch (error) {
        console.error("❌ Error sending automated candidate email:", error.message);
    }
};
