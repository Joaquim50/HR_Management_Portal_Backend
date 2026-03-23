import dotenv from "dotenv";
import axios from "axios";
import { syncSheetData } from "./src/services/sheet.service.js";
import mongoose from "mongoose";

dotenv.config();

async function test() {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/employee_management");
        console.log("Connected to MongoDB");

        const result = await syncSheetData("69ba36f78b2156aa69915dab");
        console.log("Sync Result:", result);
        process.exit(0);
    } catch (error) {
        console.error("Test failed:", error.message);
        process.exit(1);
    }
}

test();
