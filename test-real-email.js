import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import axios from "axios";
import dotenv from "dotenv";
import User from "./src/models/users/user.model.js";
import Candidate from "./src/models/candidates/candidate.model.js";

dotenv.config();

const BASE_URL = "http://localhost:2000/api/candidates";

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/employee_management");

        // Use the SMTP user email as the target so you receive the test email yourself.
        // If not set, fallback to a dummy email you can change.
        const targetEmail = process.env.SMTP_USER || "your_personal_email@example.com";
        
        console.log(`\n--- Sending Real Email to: ${targetEmail} ---`);
        console.log("Checking for SMTP credentials...");
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.error("❌ SMTP credentials missing from .env file!");
            process.exit(1);
        } else {
            console.log("✅ SMTP credentials found in environment variables.");
        }

        // Clean up previous tests
        await User.deleteMany({ email: "real_email_tester@example.com" });
        await Candidate.deleteMany({ email: targetEmail });

        const testUser = new User({ name: "Real Email Admin", email: "real_email_tester@example.com", password: "pass", role: "superadmin" });
        await testUser.save();

        const token = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        const headers = { Authorization: `Bearer ${token}` };

        // 1. Create candidate
        const createRes = await axios.post(BASE_URL, {
            name: "Production Test Candidate",
            email: targetEmail,
            phone: "9998887776",
            role: "FullStack MERN",
            expectedCTC: "12 LPA",
            location: "Remote",
            mumbaiComfort: "Yes"
        }, { headers });
        const candidateId = createRes.data._id;
        console.log(`✅ Dummy Candidate created using your email: ${candidateId}`);

        // 2. Change status to Offer (Triggers the real email!)
        console.log("\n[1] Changing status to 'Offer' via PATCH /status ...");
        console.log(`⏳ Sending template email via ${process.env.SMTP_HOST}... (This might take a few seconds)`);
        
        const patchRes = await axios.patch(`${BASE_URL}/${candidateId}/status`, {
            status: "Offer"
        }, { headers });
        console.log(`✅ Status changed to: ${patchRes.data.status}`);
        
        // Wait briefly to allow async email service to finish logging
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        console.log(`\n🎉 Test completed! Check the inbox of ${targetEmail} for the Offer email!`);

        // Cleanup
        await User.findByIdAndDelete(testUser._id);
        await Candidate.findByIdAndDelete(candidateId);
        process.exit(0);

    } catch (error) {
        console.error("❌ Test failed:", error.response ? JSON.stringify(error.response.data) : error.message);
        process.exit(1);
    }
}

run();
