const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");
require("dotenv").config(); // Ensure dotenv is loaded

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Enable CORS
app.use(cors()); // This allows all origins

// Ensure GOOGLE_APPLICATION_CREDENTIALS is correctly set
const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!keyFilePath) {
  console.error("❌ GOOGLE_APPLICATION_CREDENTIALS is missing! Set it in .env");
  process.exit(1);
}

// Google Auth Configuration
const auth = new google.auth.GoogleAuth({
  keyFile: keyFilePath, // Directly use file path
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const drive = google.drive({ version: "v3", auth });

// ✅ Home Route (to test if backend is running)
app.get("/", (req, res) => {
  res.send("🎵 Sangeet Backend is running!");
});

// ✅ Get list of playlists (Google Drive folders)
app.get("/playlists", async (req, res) => {
  try {
    const parentFolderId = "1LctVT8qLRY1lsL4dCcVTIXX2GKeGEDVP"; // Replace with your actual folder ID
    const authClient = await auth.getClient();

    const response = await drive.files.list({
      auth: authClient,
      q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
      fields: "files(id, name)",
    });

    const playlists = response.data.files.map((folder) => ({
      name: folder.name,
      id: folder.id,
    }));

    res.json(playlists);
  } catch (error) {
    console.error("Error fetching playlists:", error);
    res
      .status(500)
      .json({ error: "Error fetching playlists from Google Drive" });
  }
});

// ✅ Get list of songs in a selected playlist (Google Drive folder)
app.get("/playlist/:id", async (req, res) => {
  try {
    const playlistFolderId = req.params.id;
    console.log(`🔍 Requested Playlist ID: ${playlistFolderId}`); // Log the ID

    const authClient = await auth.getClient();
    const response = await drive.files.list({
      auth: authClient,
      q: `'${playlistFolderId}' in parents and mimeType contains 'audio/mpeg'`,
      fields: "files(id, name)",
    });

    const songs = response.data.files.map((file) => ({
      name: file.name.replace(".mp3", ""),
      url: `https://drive.google.com/uc?export=download&id=${file.id}`,
    }));

    console.log(`✅ Songs Found:`, songs); // Log the songs

    res.json(songs);
  } catch (error) {
    console.error("❌ Error fetching songs:", error);
    res.status(500).json({ error: "Error fetching songs from Google Drive" });
  }
});

// 🚀 Start the Server
app.listen(PORT, () => console.log(`✅ Server running on Port: ${PORT}`));
