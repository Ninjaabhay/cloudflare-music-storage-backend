const express = require("express");
const cors = require("cors");
const AWS = require("aws-sdk");
require("dotenv").config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Enable CORS
app.use(cors());

// ✅ Configure Cloudflare R2 with AWS SDK
const s3 = new AWS.S3({
  endpoint: "https://f6b00b11cbb8c07c79fce5b256692ad5.r2.cloudflarestorage.com", // Cloudflare R2 endpoint (use the one that worked in the test)
  accessKeyId: process.env.R2_ACCESS_KEY, // Your R2 Access Key ID
  secretAccessKey: process.env.R2_SECRET_KEY, // Your R2 Secret Key
  region: "auto", // Set to 'auto' for Cloudflare R2
  signatureVersion: "v4", // Use v4 signing for authentication
});

// ✅ Test Backend
app.get("/", (req, res) => {
  res.send("🎵 Sangeet Backend is running with Cloudflare R2!");
});

// ✅ Get list of playlists (folders inside 'playlists/' directory)
app.get("/playlists", async (req, res) => {
  try {
    const params = {
      Bucket: process.env.R2_BUCKET_NAME, // Your Cloudflare R2 bucket name
      Prefix: "playlists/", // Look for folders under 'playlists/'
      Delimiter: "/", // Ensures we only list folders (playlists)
    };

    const data = await s3.listObjectsV2(params).promise();

    const playlists = data.CommonPrefixes.map((prefix) => ({
      name: prefix.Prefix.replace("playlists/", "").replace("/", ""), // Extract playlist name
      id: prefix.Prefix, // Folder path (ID)
    }));

    res.json(playlists); // Send list of playlists
  } catch (error) {
    console.error("❌ Error fetching playlists:", error);
    res
      .status(500)
      .json({ error: "Error fetching playlists from Cloudflare R2" });
  }
});

// ✅ Get list of songs from a playlist (files inside 'playlists/<playlist>/')
app.get("/playlist/:id", async (req, res) => {
  try {
    const playlistFolderId = req.params.id;
    console.log(`🔍 Requested Playlist: ${playlistFolderId}`); // Log the playlist ID

    const params = {
      Bucket: process.env.R2_BUCKET_NAME,
      Prefix: `playlists/${playlistFolderId}/`, // Fetch files inside the playlist
    };

    const data = await s3.listObjectsV2(params).promise();

    const songs = data.Contents.map((file) => ({
      name: file.Key.replace(`playlists/${playlistFolderId}/`, "").replace(
        ".mp3",
        ""
      ), // Extract song name
      url: `${process.env.R2_ENDPOINT}/${process.env.R2_BUCKET_NAME}/${file.Key}`, // Generate public file URL
    }));

    console.log(`✅ Songs Found in ${playlistFolderId}:`, songs); // Log the songs

    res.json(songs);
  } catch (error) {
    console.error("❌ Error fetching songs:", error);
    res.status(500).json({ error: "Error fetching songs from Cloudflare R2" });
  }
});

// 🚀 Start the Server
app.listen(PORT, () => console.log(`✅ Server running on Port: ${PORT}`));
