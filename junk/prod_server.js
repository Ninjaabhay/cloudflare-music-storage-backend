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
  endpoint: new AWS.Endpoint(process.env.R2_ENDPOINT), // Cloudflare R2 endpoint
  accessKeyId: process.env.R2_ACCESS_KEY, // Your R2 Access Key ID
  secretAccessKey: process.env.R2_SECRET_KEY, // Your R2 Secret Key
  region: "auto", // You can use 'auto' for Cloudflare R2
  signatureVersion: "v4", // Use v4 signing for authentication
});

// ✅ Test Backend
app.get("/", (req, res) => {
  res.send("🎵 Sangeet Backend is running with Cloudflare R2!");
});

// ✅ Fetch all playlists from the R2 bucket
app.get("/playlists", async (req, res) => {
  try {
    const params = {
      Bucket: process.env.R2_BUCKET_NAME, // Your Cloudflare R2 bucket name
      Prefix: "playlists/", // Look for the "playlists/" folder
      Delimiter: "/", // This ensures that only folders (playlists) are listed
    };

    const data = await s3.listObjectsV2(params).promise();

    // Extract playlist folder names under "playlists/"
    const playlists = data.CommonPrefixes.map((prefix) => ({
      name: decodeURIComponent(
        prefix.Prefix.replace("playlists/", "").replace("/", "")
      ), // Decode the playlist name properly
      id: prefix.Prefix, // Full path of the playlist folder (ID)
    }));

    res.json(playlists); // Send the list of playlists
  } catch (error) {
    console.error("❌ Error fetching playlists:", error);
    res.status(500).json({
      error: `Error fetching playlists from Cloudflare R2: ${error.message}`,
    });
  }
});

// ✅ Get list of songs from a playlist (files inside 'playlists/<playlist>/')
// Get list of songs from a playlist (files inside 'playlists/<playlist>/')
app.get("/playlists/:id", async (req, res) => {
  try {
    const playlistFolderId = req.params.id;
    console.log(`🔍 Requested Playlist: ${playlistFolderId}`);

    const params = {
      Bucket: process.env.R2_BUCKET_NAME,
      Prefix: `playlists/${playlistFolderId}/`, // Fetch files inside the playlist
    };

    const data = await s3.listObjectsV2(params).promise();

    const songs = await Promise.all(
      data.Contents.map(async (file) => {
        // Construct song name and URL
        const songName = file.Key.replace(
          `playlists/${playlistFolderId}/`,
          ""
        ).replace(".mp3", "");

        // Generate signed URL for private file access
        const signedUrl = s3.getSignedUrl("getObject", {
          Bucket: process.env.R2_BUCKET_NAME,
          Key: file.Key,
          Expires: 3600, // URL expires in 1 hour
        });

        return {
          name: songName, // The song name without extension
          url: signedUrl, // The signed URL to access the song
        };
      })
    );

    console.log(`✅ Songs Found in ${playlistFolderId}:`, songs); // Log the songs

    res.json(songs); // Send the list of songs
  } catch (error) {
    console.error("❌ Error fetching songs:", error);
    res.status(500).json({ error: "Error fetching songs from Cloudflare R2" });
  }
});

// 🚀 Start the Server
app.listen(PORT, () => console.log(`✅ Server running on Port: ${PORT}`));
