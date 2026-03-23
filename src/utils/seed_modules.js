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
                name: "Candidates",
                slug: "candidates",
                description: "Full management of candidate records, interviewing status, and data sync.",
                actions: ["view", "create", "update", "delete"]
            },
            {
                name: "Interviews",
                slug: "interviews",
                description: "Scheduling and managing interview feedback.",
                actions: ["view", "manage"]
            },
            {
                name: "Users",
                slug: "users",
                description: "Staff management and permission assignments.",
                actions: ["view", "manage"]
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
