import cors from "cors";
import express from "express";
import connectDB from "./src/config/db.js";
import dotenv from "dotenv";
import authRoutes from "./src/routes/auth/auth.routes.js";
import candidateRoutes from "./src/routes/candidates/candidate.routes.js";
import userRoutes from "./src/routes/users/user.routes.js";
import jobOpeningRoutes from "./src/routes/jobs/jobOpening.routes.js";
import interviewRoutes from "./src/routes/interviews/interview.routes.js";
import dashboardRoutes from "./src/routes/dashboard/dashboard.routes.js";
import emailTemplateRoutes from "./src/routes/emailTemplates/emailTemplate.routes.js";
import emailRoutes from "./src/routes/email/email.routes.js";
import path from "path";

dotenv.config();
const __dirname = path.resolve();

// Ensure uploads directory exists
import fs from "fs";
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const app = express();

// Connect DataBase
connectDB();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/users", userRoutes);
app.use("/api/jobs", jobOpeningRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/email-templates", emailTemplateRoutes);
app.use("/api/email", emailRoutes);

app.get("/", (req, res) => {
    res.send("API Running");
});

const PORT = 2000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));