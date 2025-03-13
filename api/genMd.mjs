import AWS from "aws-sdk";
import { parseBuffer } from "music-metadata";
import dotenv from "dotenv";
import fs from "fs/promises";
import axios from "axios";
import path from "path";

dotenv.config();

// ✅ Configure Cloudflare R2
const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint(process.env.R2_ENDPOINT),
  accessKeyId: process.env.R2_ACCESS_KEY,
  secretAccessKey: process.env.R2_SECRET_KEY,
  region: "auto",
  signatureVersion: "v4",
});

// ✅ Your Cloudflare R2 **PUBLIC BUCKET URL** (Change this to match your setup)
const PUBLIC_R2_URL = "https://pub-e63479089c2b4fc5bcf14148e30297eb.r2.dev";

async function fetchAllSongs() {
  try {
    console.log("⏳ Fetching songs from Cloudflare R2...");
    const params = { Bucket: process.env.R2_BUCKET_NAME, Prefix: "playlists/" };
    const data = await s3.listObjectsV2(params).promise();
    const songFiles = data.Contents.filter((file) => file.Key.endsWith(".mp3"));

    let metadataArray = [];

    for (const file of songFiles) {
      const songKey = file.Key;
      const songName = path.basename(songKey, ".mp3");

      // ✅ Generate a signed URL for the song (valid for 1 hour)
      const signedUrl = s3.getSignedUrl("getObject", {
        Bucket: process.env.R2_BUCKET_NAME,
        Key: songKey,
        Expires: 3600, // 1 hour expiration
      });

      try {
        console.log(`🎵 Processing: ${songName}`);

        // ✅ Fetch the song file to read metadata
        const response = await axios.get(signedUrl, {
          responseType: "arraybuffer",
        });
        const metadata = await parseBuffer(
          Buffer.from(response.data),
          "audio/mpeg"
        );

        // ✅ Extract album cover if available
        let coverUrl = null;
        if (metadata.common.picture && metadata.common.picture.length > 0) {
          const coverData = metadata.common.picture[0];
          const safeCoverName = songName.replace(/[^a-zA-Z0-9]/g, "_") + ".jpg";
          const coverKey = `covers/${safeCoverName}`;

          // ✅ Upload cover image to Cloudflare R2
          await s3
            .upload({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: coverKey,
              Body: Buffer.from(coverData.data),
              ContentType: coverData.format || "image/jpeg",
            })
            .promise();

          // ✅ Use **PUBLIC R2 URL** instead of S3 signed URL
          coverUrl = `${PUBLIC_R2_URL}/covers/${safeCoverName}`;
          console.log(`🖼️ Cover uploaded: ${coverUrl}`);
        }

        // ✅ Store metadata in JSON
        metadataArray.push({
          playlist: songKey.split("/")[1], // Extract playlist name
          name: metadata.common.title || songName,
          artist: metadata.common.artist || "Unknown Artist",
          album: metadata.common.album || "Unknown Album",
          filename: songName,
          cover: coverUrl, // ✅ Store **public** cover URL
          url: signedUrl, // ✅ Store **signed** song URL
        });
      } catch (error) {
        console.error(`❌ Error reading metadata for ${songKey}:`, error);
      }
    }

    // ✅ Save metadata.json locally
    await fs.writeFile("metadata.json", JSON.stringify(metadataArray, null, 2));
    console.log("✅ metadata.json generated successfully!");

    // ✅ Upload metadata.json to Cloudflare R2
    await s3
      .upload({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: "metadata.json",
        Body: JSON.stringify(metadataArray, null, 2),
        ContentType: "application/json",
        ACL: "public-read",
      })
      .promise();

    console.log("✅ metadata.json uploaded to Cloudflare R2!");
  } catch (error) {
    console.error("❌ Error fetching songs:", error);
  }
}

// ✅ Run the function
fetchAllSongs();
