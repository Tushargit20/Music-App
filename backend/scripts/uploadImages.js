/**
 * uploadImages.js — Download artist images from URLs and upload to S3
 * Downloads each unique image_url from songs.json and uploads it
 * to the S3 bucket under the "artists/" prefix.
 *
 * Usage: node scripts/uploadImages.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const {
  PutObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutPublicAccessBlockCommand,
} = require('@aws-sdk/client-s3');
const { s3Client, S3_BUCKET } = require('../src/config/aws');

const DATA_FILE = path.join(__dirname, '..', 'data', 'songs.json');

/**
 * Build a safe S3 key from an artist name.
 */
function buildImageKey(artistName) {
  const safeName = artistName
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  return `artists/${safeName}.jpg`;
}

/**
 * Check if the S3 bucket exists, create it if not.
 */
async function ensureBucketExists() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
    console.log(`  ✅ Bucket "${S3_BUCKET}" exists.`);
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      console.log(`  ⏳ Creating bucket "${S3_BUCKET}"...`);
      
      const createParams = { Bucket: S3_BUCKET };
      // Only add LocationConstraint for non us-east-1 regions
      const region = process.env.AWS_REGION || 'us-east-1';
      if (region !== 'us-east-1') {
        createParams.CreateBucketConfiguration = {
          LocationConstraint: region,
        };
      }
      
      await s3Client.send(new CreateBucketCommand(createParams));

      // Block all public access (secure by default)
      await s3Client.send(
        new PutPublicAccessBlockCommand({
          Bucket: S3_BUCKET,
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true,
            IgnorePublicAcls: true,
            BlockPublicPolicy: true,
            RestrictPublicBuckets: true,
          },
        })
      );

      console.log(`  ✅ Bucket "${S3_BUCKET}" created with public access blocked.`);
    } else {
      throw error;
    }
  }
}

/**
 * Check if an object already exists in S3.
 */
async function objectExists(key) {
  try {
    await s3Client.send(
      new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key })
    );
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Download image from URL and upload to S3.
 */
async function downloadAndUpload(imageUrl, s3Key) {
  // Download the image
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: {
      'User-Agent': 'MusicSubscriptionApp/1.0',
    },
  });

  // Upload to S3
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: Buffer.from(response.data),
      ContentType: response.headers['content-type'] || 'image/jpeg',
    })
  );
}

async function uploadImages() {
  console.log('🖼️  Uploading artist images to S3...\n');

  // Ensure bucket exists
  await ensureBucketExists();

  // Read songs data
  const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
  const { songs } = JSON.parse(rawData);

  // Extract unique artist → img_url mappings
  const artistImages = new Map();
  for (const song of songs) {
    if (song.img_url && !artistImages.has(song.artist)) {
      artistImages.set(song.artist, song.img_url);
    }
  }

  console.log(`  📂 Found ${artistImages.size} unique artists to upload\n`);

  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  for (const [artist, imageUrl] of artistImages) {
    const s3Key = buildImageKey(artist);

    // Skip if already uploaded
    if (await objectExists(s3Key)) {
      console.log(`  ⏭️  Skipped (exists): ${artist} → ${s3Key}`);
      skipped++;
      continue;
    }

    try {
      await downloadAndUpload(imageUrl, s3Key);
      console.log(`  ✅ Uploaded: ${artist} → ${s3Key}`);
      uploaded++;
    } catch (error) {
      console.error(`  ❌ Error uploading ${artist}:`, error.message);
      // Create a placeholder image if download fails
      try {
        const placeholder = Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
            <rect width="200" height="200" fill="#1a1a2e"/>
            <text x="100" y="100" font-family="Arial" font-size="14" fill="#e94560" text-anchor="middle" dominant-baseline="middle">${artist}</text>
          </svg>`
        );
        await s3Client.send(
          new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: s3Key,
            Body: placeholder,
            ContentType: 'image/svg+xml',
          })
        );
        console.log(`  🔄 Uploaded placeholder for: ${artist}`);
        uploaded++;
      } catch (placeholderError) {
        errors++;
      }
    }
  }

  console.log('\n── Summary ──────────────────────────');
  console.log(`  Uploaded:  ${uploaded}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Errors:    ${errors}`);
  console.log('─────────────────────────────────────\n');
}

uploadImages().catch(console.error);
