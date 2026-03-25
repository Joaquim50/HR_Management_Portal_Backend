import axios from "axios";
import Candidate from "../models/candidates/candidate.model.js";
import { updateJobStats } from "../utils/jobUtils.js";

export const syncSheetData = async (userId) => {
    const RANGE = "Sheet1";
    const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;

    if (!API_KEY || !SHEET_ID) {
        throw new Error("Missing Google Sheets configuration: GOOGLE_SHEETS_API_KEY or GOOGLE_SHEET_ID");
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE + "!A:Z")}?key=${API_KEY}`;

    try {
        const response = await axios.get(url);
        const rows = response.data.values;

        if (!rows || rows.length === 0) {
            return { message: "No data found in sheet" };
        }

        const headers = rows[0].map(h => (h || "").trim().replace(/\./g, "_"));
        const dataRows = rows.slice(1);

        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const row of dataRows) {
            const rowData = {};
            headers.forEach((header, index) => {
                rowData[header] = row[index] || ""; // Ensure empty strings for missing data
            });

            // Identify core fields
            const email = String(rowData["Email address"] || rowData["Email"] || "").trim();
            const name = String(rowData["Full Name"] || rowData["Name"] || "").trim();
            const phone = String(rowData["Phone NO"] || rowData["Phone Number"] || "").trim();
            const roleInput = rowData["Role"] || rowData["Position"];

            if (!email || !name || !phone) continue;

            // Map role - Priority: 1. Role from sheet column, 2. Default "Other"
            let role = "Other";
            if (roleInput) {
                const ri = roleInput.toUpperCase();
                if (ri.includes("MERN")) role = "FullStack MERN";
                else if (ri.includes("QA")) role = "QA";
                else if (ri.includes("FLUTTER")) role = "Flutter";
                else if (ri.includes("UI") || ri.includes("UX")) role = "UI/UX";
            }

            // Map detailed fields from headers
            let candidateType = "Other";
            let totalExperience = "";
            let relevantExperience = "";
            let noticePeriod = "";
            let currentCTC = "";
            let expectedCTC = "";
            let location = "";
            let source = "Google Form";
            let resumeLink = "";
            let portfolioLink = "";
            let skills = [];
            let technologies = [];
            let hasLiveExperience = "";
            let mumbaiComfort = "";

            Object.keys(rowData).forEach(key => {
                const k = key.toLowerCase();
                const v = rowData[key];
                if (k.includes("candidate type") || k.includes("type")) candidateType = v;
                else if (k === "total experience" || k === "experience" || k === "work exp") totalExperience = v;
                else if (k.includes("relevant experience")) relevantExperience = v;
                else if (k.includes("notice period")) noticePeriod = v;
                else if (k.includes("current ctc") || k === "ctc") currentCTC = v;
                else if (k.includes("expected ctc") || k === "expected") expectedCTC = v;
                else if (k === "location" || k === "current city") location = v;
                else if (k === "source" || k.includes("how did you hear")) source = v;
                else if (k.includes("resume")) resumeLink = v;
                else if (k.includes("portfolio") || k.includes("github")) portfolioLink = v;
                else if (k.includes("skills")) {
                    skills = v ? v.split(",").map(s => s.trim()).filter(Boolean) : [];
                }
                else if (k.includes("technologies")) {
                    technologies = v ? v.split(",").map(s => s.trim()).filter(Boolean) : [];
                }
                else if (k.includes("live") || k.includes("production")) hasLiveExperience = v;
                else if (k.includes("comfort") || k.includes("mumbai") || k.includes("office") || k.includes("saturday") || k.includes("monday")) mumbaiComfort = v;
            });

            // Map flexible details (exclude the promoted fields)
            const details = {};
            const coreFields = [
                "Email address", "Email", "Full Name", "Name", "Phone NO", "Phone Number", 
                "TimeStamp", "Timestamp", "Role", "Position", "Candidate Type", "Type",
                "Total Experience", "Experience", "Work Exp", "Relevant Experience",
                "Notice Period", "Current CTC", "CTC", "Expected CTC", "Expected",
                "Location", "Current City", "Source",
                "Portfolio", "Github", "Technologies", "Skills", "Live", "Production", "Comfort", "Mumbai", "Office", "Monday", "Saturday"
            ];

            Object.keys(rowData).forEach(key => {
                if (!coreFields.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
                    details[key] = rowData[key];
                }
            });

            let candidate = await Candidate.findOne({ email });

            if (candidate) {
                skippedCount++;
                continue;
            }

            candidate = new Candidate({
                name,
                email,
                phone,
                role,
                candidateType,
                totalExperience,
                relevantExperience,
                noticePeriod,
                currentCTC,
                expectedCTC,
                location,
                source,
                resumeLink,
                portfolioLink,
                skills,
                technologies,
                hasLiveExperience,
                mumbaiComfort,
                details,
                submissionDate: rowData["TimeStamp"] || rowData["Timestamp"],
                status: "New",
                statusHistory: [{ status: "New", changedAt: new Date(), changedBy: userId }],
                activityLog: [{
                    date: new Date().toISOString().split("T")[0],
                    action: "Candidate synced from Google Sheets",
                    by: "System"
                }]
            });
            await candidate.save();
            createdCount++;
        }

        // Recalculate job stats for all processed roles
        const uniqueRoles = [...new Set(dataRows.map(row => {
            const roleInput = row[headers.indexOf("Role")] || row[headers.indexOf("Position")];
            if (roleInput) {
                const ri = roleInput.toUpperCase();
                if (ri.includes("MERN")) return "FullStack MERN";
                if (ri.includes("QA")) return "QA";
                if (ri.includes("FLUTTER")) return "Flutter";
                if (ri.includes("UI") || ri.includes("UX")) return "UI/UX";
            }
            return "Other";
        }))];

        for (const role of uniqueRoles) {
            await updateJobStats(role);
        }

        return { createdCount, updatedCount, skippedCount };
    } catch (error) {
        console.error("Error syncing Google Sheets:", error.message);
        throw error;
    }
};
