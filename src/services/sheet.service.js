import axios from "axios";
import Candidate from "../models/candidates/candidate.model.js";
import { updateJobStats } from "../utils/jobUtils.js";

export const syncSheetData = async (userId, globalRole = null, sheetId = null) => {
    const RANGE = "Sheet1";
    const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
    const SHEET_ID = sheetId || process.env.GOOGLE_SHEET_ID;

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
            const email = rowData["Email address"] || rowData["Email"];
            const name = rowData["Full Name"] || rowData["Name"];
            const phone = rowData["Phone NO"] || rowData["Phone Number"];
            const roleInput = rowData["Role"] || rowData["Position"];

            if (!email) continue;

            // Map role - Priority: 1. Global role from parameter, 2. Role from sheet column, 3. Default "Other"
            let role = "Other";
            if (globalRole) {
                role = globalRole;
            } else if (roleInput) {
                const ri = roleInput.toUpperCase();
                if (ri.includes("JR MERN")) role = "JR MERN";
                else if (ri.includes("SR MERN")) role = "SR MERN";
                else if (ri.includes("HR")) role = "HR";
                else if (ri.includes("QA")) role = "QA";
                else if (ri.includes("DEVOPS")) role = "DevOps";
                else if (ri.includes("FLUTTER")) role = "Flutter";
                else if (ri.includes("UI")) role = "UI/UX";
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
            });

            // Map flexible details (exclude the promoted fields)
            const details = {};
            const coreFields = [
                "Email address", "Email", "Full Name", "Name", "Phone NO", "Phone Number", 
                "TimeStamp", "Timestamp", "Role", "Position", "Candidate Type", "Type",
                "Total Experience", "Experience", "Work Exp", "Relevant Experience",
                "Notice Period", "Current CTC", "CTC", "Expected CTC", "Expected",
                "Location", "Current City", "Source"
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
                details,
                submissionDate: rowData["TimeStamp"] || rowData["Timestamp"],
                status: "New",
                statusHistory: [{ status: "New", changedAt: new Date(), changedBy: userId }]
            });
            await candidate.save();
            createdCount++;
        }

        // Recalculate job stats for all processed roles
        const uniqueRoles = [...new Set(dataRows.map(row => {
            const roleInput = row[headers.indexOf("Role")] || row[headers.indexOf("Position")];
            if (globalRole) return globalRole;
            if (roleInput) {
                const ri = roleInput.toUpperCase();
                if (ri.includes("JR MERN")) return "JR MERN";
                if (ri.includes("SR MERN")) return "SR MERN";
                if (ri.includes("HR")) return "HR";
                if (ri.includes("QA")) return "QA";
                if (ri.includes("DEVOPS")) return "DevOps";
                if (ri.includes("FLUTTER")) return "Flutter";
                if (ri.includes("UI")) return "UI/UX";
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
