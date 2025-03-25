import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// ✅ Use Public R2 URL from .env
const PUBLIC_R2_URL = process.env.PUBLIC_R2_URL; // e.g., "https://pub-xxxxxxxxxxxxxxxxxxx.r2.dev"

// ✅ Initialize metadata
let metadata = [];

// ✅ Load metadata.json directly from public URL (No S3 needed)
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

// ✅ Get Songs from a Playlist (Using Public URLs)
app.get("/playlists/:id", (req, res) => {
  const playlistId = req.params.id.replace("playlists/", "");

  const playlistSongs = metadata
    .filter((song) => song.playlist === playlistId)
    .map((song) => ({
      ...song,
      url: `${PUBLIC_R2_URL}/playlists/${encodeURIComponent(
        playlistId
      )}/${encodeURIComponent(song.filename)}.mp3`, // ✅ Direct Public URL
      cover: song.cover || "default-cover.jpg",
    }));

  res.json(playlistSongs);
});

// ✅ Get All Songs (Using Public URLs)
app.get("/all-songs", (req, res) => {
  const allSongs = metadata.map((song) => ({
    ...song,
    url: `${PUBLIC_R2_URL}/playlists/${encodeURIComponent(
      song.playlist
    )}/${encodeURIComponent(song.filename)}.mp3`,
  }));

  res.json(allSongs);
});

// ✅ Start Server
app.listen(PORT, () => console.log(`✅ Server running on Port: ${PORT}`));
