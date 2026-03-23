import axios from "axios";
import Candidate from "../models/candidates/candidate.model.js";
import { google } from 'googleapis'; // Added import for googleapis

export const syncSheetData = async (userId, globalRole = null) => { 
    // Removed old API_KEY and SHEET_ID variables as new auth method is used
    const RANGE = "Form Responses 1";

    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        throw new Error("Missing Google Sheets authentication variables: GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY");
    }

    // New Google Sheets API authentication and setup
    const auth = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL,
        null,
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    const range = `${RANGE}!A:Z`; // Adjust sheet name as needed, using original RANGE

    try {
        const response = await sheets.spreadsheets.values.get({ // Changed from axios.get to googleapis client
            spreadsheetId: process.env.GOOGLE_SHEET_ID,
            range,
        });
        const rows = response.data.values;

        if (!rows || rows.length === 0) { // Updated condition for empty rows
            return { message: "No data found in sheet" }; // Updated message
        }

        const headers = rows[0];
        const dataRows = rows.slice(1);

        let createdCount = 0;
        let updatedCount = 0;

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
            }

            // Map flexible details
            const details = new Map();
            Object.keys(rowData).forEach(key => {
                if (!["Email address", "Email", "Full Name", "Name", "Phone NO", "Phone Number", "TimeStamp", "Timestamp", "Role", "Position"].includes(key)) {
                    details.set(key, rowData[key]);
                }
            });

            let candidate = await Candidate.findOne({ email });

            if (!candidate) {
                candidate = new Candidate({
                    name,
                    email,
                    phone,
                    role,
                    details,
                    submissionDate: rowData["TimeStamp"] || rowData["Timestamp"],
                    status: "Pending",
                    statusHistory: [{ status: "Pending", changedAt: new Date(), changedBy: userId }]
                });
                await candidate.save();
                createdCount++;
            } else {
                candidate.name = name || candidate.name;
                candidate.phone = phone || candidate.phone;
                candidate.role = role || candidate.role;
                candidate.details = details;
                await candidate.save();
                updatedCount++;
            }
        }

        return { createdCount, updatedCount };
    } catch (error) {
        console.error("Error syncing Google Sheets:", error.response?.data || error.message);
        throw error;
    }
};
