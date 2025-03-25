import express from "express";
import cors from "cors";
import AWS from "aws-sdk";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// ✅ Configure Cloudflare R2 (For Signed URLs)
const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint(process.env.R2_ENDPOINT),
  accessKeyId: process.env.R2_ACCESS_KEY,
  secretAccessKey: process.env.R2_SECRET_KEY,
  region: "auto",
  signatureVersion: "v4",
});

// ✅ Public R2 URL from .env (Used for metadata & cover images)
const PUBLIC_R2_URL = process.env.PUBLIC_R2_URL;

// ✅ Initialize metadata
let metadata = [];

// ✅ Load metadata.json from Public R2 URL
async function loadMetadata() {
  try {
    console.log("⏳ Fetching metadata.json from Cloudflare R2...");

    const response = await fetch(`${PUBLIC_R2_URL}/metadata.json`);
    metadata = await response.json();

    console.log("✅ Metadata loaded successfully!");
  } catch (error) {
    console.error("❌ Failed to load metadata.json:", error);
  }
}

// ✅ Call function on startup
await loadMetadata();

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

// ✅ Get Songs from a Playlist (Using Signed URLs)
app.get("/playlists/:id", (req, res) => {
  const playlistId = req.params.id.replace("playlists/", "");

  const playlistSongs = metadata
    .filter((song) => song.playlist === playlistId)
    .map((song) => ({
      ...song,
      url: s3.getSignedUrl("getObject", {
        Bucket: process.env.R2_BUCKET_NAME,
        Key: `playlists/${playlistId}/${song.filename}.mp3`,
        Expires: 3600, // 🔥 Signed URL expires in 1 hour
      }),
      cover: song.cover || "default-cover.jpg", // ✅ Use public URL for covers
    }));

  res.json(playlistSongs);
});

// ✅ Get All Songs (Using Signed URLs)
app.get("/all-songs", (req, res) => {
  const allSongs = metadata.map((song) => ({
    ...song,
    url: s3.getSignedUrl("getObject", {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: `playlists/${song.playlist}/${song.filename}.mp3`,
      Expires: 3600, // 🔥 1-hour signed URL
    }),
  }));

  res.json(allSongs);
});

// ✅ Start Server
app.listen(PORT, () => console.log(`✅ Server running on Port: ${PORT}`));
