const fs = require("fs");

// Read the BASE64 string from the environment variable
const base64String = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!base64String) {
  console.error("❌ GOOGLE_APPLICATION_CREDENTIALS is missing!");
  process.exit(1);
}

try {
  // Decode the Base64 string
  const decodedJSON = Buffer.from(base64String, "base64").toString("utf8");

  console.log("✅ Decoded JSON:\n", decodedJSON);

  // Check if it's valid JSON
  JSON.parse(decodedJSON);
  console.log("✅ The JSON is valid!");
} catch (error) {
  console.error("❌ Invalid Base64 or JSON format:", error.message);
}
