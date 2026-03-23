import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";

const API_URL = "http://localhost:2000/api";

async function testResumeUpload() {
    try {
        // 1. Login
        console.log("Logging in...");
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: "admin@gmail.com",
            password: "admin@123"
        });

        const token = loginRes.data.token;
        console.log("Logged in successfully. Token obtained.");

        // 2. Prepare Form Data
        const form = new FormData();
        form.append("name", "Test Candidate");
        form.append("email", `test_${Date.now()}@example.com`);
        form.append("phone", "1234567890");
        form.append("role", "JR MERN");
        form.append("resume", fs.createReadStream(path.join(process.cwd(), "test_resume.pdf")));

        // 3. Create Candidate
        console.log("Creating candidate with resume...");
        const createRes = await axios.post(`${API_URL}/candidates`, form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${token}`
            }
        });

        console.log("Candidate created successfully:", JSON.stringify(createRes.data, null, 2));

        if (createRes.data.resumeLink && createRes.data.resumeLink.includes("uploads")) {
            console.log("SUCCESS: resumeLink is set correctly.");
        } else {
            console.log("FAILURE: resumeLink is missing or incorrect.");
        }

    } catch (error) {
        console.error("Test failed:", error.response ? error.response.data : error.message);
    }
}

testResumeUpload();
