import fs from "fs";

const content = fs.readFileSync(".env", "utf8");
const lines = content.split(/\r?\n/);
const passLine = lines.find(l => l.startsWith("SMTP_PASS="));

if (passLine) {
    const value = passLine.split("=")[1];
    console.log(`SMTP_PASS value: [${value}]`);
    console.log(`Length: ${value.length}`);
    let hex = "";
    for (let i = 0; i < value.length; i++) {
        hex += value.charCodeAt(i).toString(16) + " ";
    }
    console.log(`Hex: ${hex}`);
} else {
    console.log("SMTP_PASS line not found!");
}
