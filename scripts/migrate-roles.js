import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../src/config/db.js";
import Candidate from "../src/models/candidates/candidate.model.js";
import JobOpening from "../src/models/jobs/jobOpening.model.js";

dotenv.config();

const migrate = async () => {
    try {
        await connectDB();

        console.log("Starting migration of candidate roles...");

        // 1. Update Candidates
        const candidateUpdates = [
            { old: "JR MERN", new: "FullStack MERN" },
            { old: "SR MERN", new: "FullStack MERN" },
            { old: "DevOps", new: "Other" },
            { old: "HR", new: "Other" }
        ];

        for (const update of candidateUpdates) {
            const res = await Candidate.updateMany(
                { role: update.old },
                { $set: { role: update.new } }
            );
            console.log(`Updated ${res.modifiedCount} candidates from "${update.old}" to "${update.new}"`);
        }

        // 2. Update JobOpenings
        const jobUpdates = [
            { old: "JR MERN", new: "FullStack MERN" },
            { old: "SR MERN", new: "FullStack MERN" },
            { old: "DevOps", new: "Other" },
            { old: "HR", new: "Other" }
        ];

        for (const update of jobUpdates) {
            const res = await JobOpening.updateMany(
                { role: update.old },
                { $set: { role: update.new } }
            );
            console.log(`Updated ${res.modifiedCount} job openings from "${update.old}" to "${update.new}"`);
        }

        console.log("Migration completed successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error.message);
        process.exit(1);
    }
};

migrate();
