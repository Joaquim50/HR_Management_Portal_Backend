import dotenv from "dotenv";
import path from "path";
import fs from "fs";

console.log("--- Env Loading Test ---");
console.log("CWD:", process.cwd());

const envPath = path.join(process.cwd(), ".env");
console.log("Looking for .env at:", envPath);
console.log("File exists?", fs.existsSync(envPath));

const result = dotenv.config();
if (result.error) {
    console.error("Error loading .env:", result.error);
} else {
    console.log("Dotenv loaded successfully.");
}

console.log("SMTP_HOST:", process.env.SMTP_HOST);
console.log("SMTP_USER:", process.env.SMTP_USER);
console.log("SMTP_PASS length:", process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0);

if (!process.env.SMTP_HOST) {
    console.log("⚠️ SMTP_HOST is MISSING in process.env!");
} else {
    console.log("✅ SMTP_HOST is present.");
}
