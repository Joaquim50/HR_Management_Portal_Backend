import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/users/user.model.js";
import dotenv from "dotenv";

dotenv.config();

const createSuperAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Connected for seeding...");

        const adminEmail = "admin@gmail.com";
        const existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            console.log("Superadmin already exists!");
            process.exit(0);
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("admin@123", salt);

        const superAdmin = new User({
            name: "Super Admin",
            email: adminEmail,
            password: hashedPassword,
            role: "superadmin",
            permissions: [] // Superadmins bypass permission checks
        });

        await superAdmin.save();
        console.log("Superadmin created successfully!");
        console.log("Email: admin@gmail.com");
        console.log("Password: admin@123");

        process.exit(0);
    } catch (error) {
        console.error("Error creating superadmin:", error.message);
        process.exit(1);
    }
};

createSuperAdmin();
