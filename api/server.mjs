import express from "express";
import cors from "cors";
import AWS from "aws-sdk";
import fs from "fs";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// ✅ Configure Cloudflare R2
const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint(process.env.R2_ENDPOINT),
  accessKeyId: process.env.R2_ACCESS_KEY,
  secretAccessKey: process.env.R2_SECRET_KEY,
  region: "auto",
  signatureVersion: "v4",
});

// ✅ Initialize metadata (Prevents ReferenceError)
let metadata = [];

// ✅ Function to Load metadata.json from R2
async function loadMetadataFromR2() {
  try {
    console.log("⏳ Fetching metadata.json from Cloudflare R2...");

    const signedUrl = s3.getSignedUrl("getObject", {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: "metadata.json",
      Expires: 3600,
    });

    const response = await axios.get(signedUrl);
    metadata = response.data;

    console.log("✅ Metadata loaded from Cloudflare R2!");
  } catch (error) {
    console.error("❌ Failed to load metadata.json from R2:", error);
  }
}

// ✅ Call function on startup
await loadMetadataFromR2();

// ✅ Home Route
app.get("/", (req, res) => {
  res.send("🎵 Sangeet Backend is running with Cloudflare R2!");
});

// ✅ Get Playlists
app.get("/playlists", (req, res) => {
  const playlists = [...new Set(metadata.map((song) => song.playlist))].map(
    (name) => ({
      name,
      id: `playlists/${name}`,
    })
  );
  res.json(playlists);
});

// ✅ Get Songs from a Playlist
app.get("/playlists/:id", (req, res) => {
  const playlistId = req.params.id.replace("playlists/", ""); // Remove prefix
  const playlistSongs = metadata.filter((song) => song.playlist === playlistId);
  res.json(playlistSongs);
});

// ✅ Start Server
app.listen(PORT, () => console.log(`✅ Server running on Port: ${PORT}`));
