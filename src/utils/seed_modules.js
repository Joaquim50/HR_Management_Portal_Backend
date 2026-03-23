import mongoose from "mongoose";
import Module from "../models/roles/module.model.js";
import dotenv from "dotenv";

dotenv.config();

const seedModules = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Connected for seeding modules...");

        const initialModules = [
            {
                name: "Dashboard",
                slug: "dashboard",
                description: "Summary view of hiring progress and key metrics.",
                actions: ["view", "create", "update", "delete"]
            },
            {
                name: "Candidates",
                slug: "candidates",
                description: "Full management of candidate records, interviewing status, and data sync.",
                actions: ["view", "create", "update", "delete"]
            },
            {
                name: "Pipeline",
                slug: "pipeline",
                description: "Visualizing and managing candidates through the hiring pipeline.",
                actions: ["view", "create", "update", "delete"]
            },
            {
                name: "Job Openings",
                slug: "job-openings",
                description: "Management of job roles and headcount tracking.",
                actions: ["view", "create", "update", "delete"]
            },
            {
                name: "Users & Permissions",
                slug: "users-permissions",
                description: "Internal user management and security settings.",
                actions: ["view", "create", "update", "delete"]
            },
            {
                name: "Email Templates",
                slug: "email-templates",
                description: "Creating and managing communication templates.",
                actions: ["view", "create", "update", "delete"]
            },
            {
                name: "Settings",
                slug: "settings",
                description: "System-wide configurations.",
                actions: ["view", "create", "update", "delete"]
            }
        ];

        for (const mod of initialModules) {
            await Module.findOneAndUpdate(
                { slug: mod.slug },
                mod,
                { upsert: true, new: true }
            );
            console.log(`Module '${mod.name}' seeded.`);
        }

        console.log("All modules seeded successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Error seeding modules:", error.message);
        process.exit(1);
    }
};

seedModules();
