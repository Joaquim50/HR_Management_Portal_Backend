import dotenv from 'dotenv';
dotenv.config({ path: 'd:/practise/New folder (2)/HR_Management_Portal_Backend/.env' });

function testKey() {
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (privateKey) {
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            privateKey = privateKey.slice(1, -1);
        }
        privateKey = privateKey.replace(/\\n/g, "\n");
    }
    
    console.log("Length:", privateKey?.length);
    console.log("Starts with:", JSON.stringify(privateKey?.substring(0, 30)));
    console.log("Ends with:", JSON.stringify(privateKey?.substring(privateKey.length - 30)));
}

testKey();
