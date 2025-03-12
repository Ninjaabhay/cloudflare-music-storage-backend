import AWS from "aws-sdk";
import axios from "axios";
import { parseBuffer } from "music-metadata";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config(); // Load environment variables

// ✅ Configure Cloudflare R2
const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint(process.env.R2_ENDPOINT),
  accessKeyId: process.env.R2_ACCESS_KEY,
  secretAccessKey: process.env.R2_SECRET_KEY,
  region: "auto",
  signatureVersion: "v4",
});

// ✅ Fetch all songs & metadata from R2
async function fetchAllSongs() {
  console.log("⏳ Fetching songs from Cloudflare R2...");

  try {
    const params = { Bucket: process.env.R2_BUCKET_NAME, Prefix: "playlists/" };
    const data = await s3.listObjectsV2(params).promise();

    let songsMetadata = [];

    for (const file of data.Contents) {
      if (!file.Key.endsWith(".mp3")) continue;

      const songKey = file.Key;
      const playlistName = songKey.split("/")[1];
      const songName = songKey.split("/").pop().replace(".mp3", "");

      const signedUrl = s3.getSignedUrl("getObject", {
        Bucket: process.env.R2_BUCKET_NAME,
        Key: songKey,
        Expires: 3600,
      });

      try {
        const response = await axios.get(signedUrl, {
          responseType: "arraybuffer",
        });
        const metadata = await parseBuffer(
          Buffer.from(response.data),
          "audio/mpeg"
        );

        songsMetadata.push({
          playlist: playlistName,
          name: metadata.common.title || songName,
          artist: metadata.common.artist || "Unknown Artist",
          album: metadata.common.album || "Unknown Album",
          url: signedUrl,
        });
      } catch (error) {
        console.error(`❌ Error reading metadata for ${songName}:`, error);
        songsMetadata.push({
          playlist: playlistName,
          name: songName,
          artist: "Unknown Artist",
          album: "Unknown Album",
          url: signedUrl,
        });
      }
    }

    // ✅ Save metadata locally
    fs.writeFileSync("metadata.json", JSON.stringify(songsMetadata, null, 2));
    console.log("🎵 metadata.json generated successfully!");

    // ✅ Upload metadata.json to Cloudflare R2
    const uploadParams = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: "metadata.json",
      Body: JSON.stringify(songsMetadata, null, 2),
      ContentType: "application/json",
    };

    await s3.upload(uploadParams).promise();
    console.log("✅ metadata.json uploaded to Cloudflare R2!");
  } catch (error) {
    console.error("❌ Error fetching songs:", error);
  }
}

// ✅ Run the function
fetchAllSongs();
