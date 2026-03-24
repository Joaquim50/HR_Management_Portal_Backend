import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import axios from "axios";
import dotenv from "dotenv";
import User from "./src/models/users/user.model.js";
import Candidate from "./src/models/candidates/candidate.model.js";
import fs from "fs";
import FormData from "form-data";

dotenv.config();

const BASE_URL = "http://localhost:2000/api/candidates";

async function runTests() {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/employee_management");
        console.log("Connected to MongoDB for Test Setup...");

        // 1. Create a dummy superadmin user
        const testUser = new User({
            name: "API Test Admin",
            email: "apitestadmin@example.com",
            password: "password123",
            role: "superadmin"
        });
        await testUser.save();

        // 2. Mint token
        const token = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const headers = { Authorization: `Bearer ${token}` };

        console.log(`\n--- Starting API Tests ---`);

        let candidateId = null;

        // Cleanup before starting just in case
        await Candidate.findOneAndDelete({ email: "teste2e@example.com" });

        // Test 1: Create Candidate Manually
        console.log("\n[1] POST /api/candidates (Create Manual)");
        const createRes = await axios.post(BASE_URL, {
            name: "Test Candidate E2E",
            email: "teste2e@example.com",
            phone: "1112223334",
            role: "FullStack MERN",
            skills: ["React", "Express"],
            technologies: ["MongoDB"]
        }, { headers });
        console.log("Status:", createRes.status);
        candidateId = createRes.data._id;
        console.log("Created ID:", candidateId);

        // Test 2: Get All Candidates
        console.log("\n[2] GET /api/candidates");
        const getAllRes = await axios.get(BASE_URL, { headers });
        console.log("Status:", getAllRes.status, "| Total:", getAllRes.data.total);

        // Test 3: Get Candidate by ID
        console.log("\n[3] GET /api/candidates/:id");
        const getRes = await axios.get(`${BASE_URL}/${candidateId}`, { headers });
        console.log("Status:", getRes.status, "| Name:", getRes.data.name);

        // Test 4: Update Candidate Generic
        console.log("\n[4] PUT /api/candidates/:id");
        const putRes = await axios.put(`${BASE_URL}/${candidateId}`, {
            mumbaiComfort: "Yes, willing to relocate"
        }, { headers });
        console.log("Status:", putRes.status, "| mumbaiComfort:", putRes.data.mumbaiComfort);

        // Test 5: Update Candidate Status
        console.log("\n[5] PATCH /api/candidates/:id/status");
        const patchRes = await axios.patch(`${BASE_URL}/${candidateId}/status`, {
            status: "Screening"
        }, { headers });
        console.log("Status:", patchRes.status, "| New Status:", patchRes.data.status);

        // Test 6 & 7: Add / Remove Tag
        console.log("\n[6] POST /api/candidates/:id/tags");
        let tagRes = await axios.post(`${BASE_URL}/${candidateId}/tags`, { tag: "Top Tier" }, { headers });
        console.log("Status:", tagRes.status, "| Tags:", tagRes.data.tags);

        console.log("\n[7] DELETE /api/candidates/:id/tags");
        tagRes = await axios.delete(`${BASE_URL}/${candidateId}/tags`, { data: { tag: "Top Tier" }, headers });
        console.log("Status:", tagRes.status, "| Tags:", tagRes.data.tags);

        // Test 8 & 9: Add / Remove Skill
        console.log("\n[8] POST /api/candidates/:id/skills");
        let skillRes = await axios.post(`${BASE_URL}/${candidateId}/skills`, { skill: "TypeScript" }, { headers });
        console.log("Status:", skillRes.status, "| Skills:", skillRes.data.skills);

        console.log("\n[9] DELETE /api/candidates/:id/skills");
        skillRes = await axios.delete(`${BASE_URL}/${candidateId}/skills`, { data: { skill: "React" }, headers });
        console.log("Status:", skillRes.status, "| Skills:", skillRes.data.skills);

        // Test 10 & 11: Add / Remove Technology
        console.log("\n[10] POST /api/candidates/:id/technologies");
        let techRes = await axios.post(`${BASE_URL}/${candidateId}/technologies`, { technology: "Docker" }, { headers });
        console.log("Status:", techRes.status, "| Tech:", techRes.data.technologies);

        console.log("\n[11] DELETE /api/candidates/:id/technologies");
        techRes = await axios.delete(`${BASE_URL}/${candidateId}/technologies`, { data: { technology: "Docker" }, headers });
        console.log("Status:", techRes.status, "| Tech:", techRes.data.technologies);

        // Test 12: Save Feedback
        console.log("\n[12] POST /api/candidates/:id/feedback");
        const feedbackRes = await axios.post(`${BASE_URL}/${candidateId}/feedback`, {
            stage: "Screening",
            rating: 4,
            comments: "Good communication skills"
        }, { headers });
        console.log("Status:", feedbackRes.status, "| Feedbacks Count:", feedbackRes.data.feedbacks.length);

        // Test 13: Bulk Import Excel
        console.log("\n[13] POST /api/candidates/import");
        if (fs.existsSync("dummy_candidates_import.xlsx")) {
            const form = new FormData();
            form.append("file", fs.createReadStream("dummy_candidates_import.xlsx"));
            const importRes = await axios.post(`${BASE_URL}/import`, form, {
                headers: {
                    ...headers,
                    ...form.getHeaders()
                }
            });
            console.log("Status:", importRes.status, "| Import Stats:", importRes.data);
        } else {
            console.log("Excel file not found, skipping import test.");
        }

        // Test 14: Sync Sheets
        console.log("\n[14] POST /api/candidates/sync");
        const syncRes = await axios.post(`${BASE_URL}/sync`, {}, { headers });
        console.log("Status:", syncRes.status, "| Sync Result:", syncRes.data.data);

        // Test 15: Delete Candidate
        console.log("\n[15] DELETE /api/candidates/:id");
        const delRes = await axios.delete(`${BASE_URL}/${candidateId}`, { headers });
        console.log("Status:", delRes.status, "| Message:", delRes.data.message);

        console.log(`\n--- All Tests Completed Successfully ---`);

        // Cleanup
        await User.findByIdAndDelete(testUser._id);
        console.log("Cleanup complete.");
        process.exit(0);

    } catch (error) {
        console.error("\nTest failed:", error.response ? JSON.stringify(error.response.data) : error.message);

        // Cleanup on fail
        await User.findOneAndDelete({ email: "apitestadmin@example.com" });
        await Candidate.findOneAndDelete({ email: "teste2e@example.com" });

        process.exit(1);
    }
}

runTests();
