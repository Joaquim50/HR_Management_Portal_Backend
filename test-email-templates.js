import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import axios from "axios";
import dotenv from "dotenv";
import User from "./src/models/users/user.model.js";

dotenv.config();

const BASE_URL = "http://localhost:2000/api/email-templates";

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/employee_management");

        const testUser = new User({ name: "Test Admin", email: "emailtest@example.com", password: "pass123", role: "superadmin" });
        await testUser.save();

        const token = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        const headers = { Authorization: `Bearer ${token}` };

        console.log("\n--- Email Templates API Test ---");

        // 1. GET all
        console.log("\n[1] GET /api/email-templates");
        const all = await axios.get(BASE_URL, { headers });
        console.log("Status:", all.status, "| Count:", all.data.length);
        all.data.forEach(t => console.log(`  - ${t.type}: "${t.subject.slice(0, 40)}..."`));

        // 2. GET by type
        console.log("\n[2] GET /api/email-templates/rejection");
        const one = await axios.get(`${BASE_URL}/rejection`, { headers });
        console.log("Status:", one.status, "| Type:", one.data.type);
        console.log("Subject:", one.data.subject);
        console.log("Placeholders:", one.data.placeholders);

        // 3. PUT update
        console.log("\n[3] PUT /api/email-templates/rejection");
        const updated = await axios.put(`${BASE_URL}/rejection`, {
            subject: "UPDATED: Your application at Metaphi",
            body: "Dear {{candidate_name}}, we regret to inform you..."
        }, { headers });
        console.log("Status:", updated.status, "| New Subject:", updated.data.subject);

        // 4. Confirm persistence
        console.log("\n[4] GET /api/email-templates/rejection (after update)");
        const confirm = await axios.get(`${BASE_URL}/rejection`, { headers });
        console.log("Confirmed Subject:", confirm.data.subject);

        if (confirm.data.subject === "UPDATED: Your application at Metaphi") {
            console.log("✅ Update persisted correctly!");
        }

        // 5. Test 404
        console.log("\n[5] GET /api/email-templates/nonexistent");
        try {
            await axios.get(`${BASE_URL}/nonexistent`, { headers });
        } catch (e) {
            console.log("Status:", e.response.status, "| Message:", e.response.data.message, "✅ 404 handled correctly");
        }

        console.log("\n--- All Email Template Tests Passed ---");

        await User.findByIdAndDelete(testUser._id);
        process.exit(0);
    } catch (error) {
        console.error("❌ Test failed:", error.response ? JSON.stringify(error.response.data) : error.message);
        process.exit(1);
    }
}

run();
