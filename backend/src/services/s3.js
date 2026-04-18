/**
 * s3.js — S3 Service Layer
 * Handles generating pre-signed URLs for secure image access.
 */

const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, S3_BUCKET } = require('../config/aws');

/**
 * Generate a pre-signed URL for an artist image in S3.
 * This allows the frontend to access private S3 objects securely
 * without making the bucket public.
 *
 * @param {string} imageKey - The S3 object key (e.g., "artist_name.jpg")
 * @param {number} expiresIn - URL expiry in seconds (default: 1 hour)
 * @returns {string} Pre-signed URL
 */
async function getImageUrl(imageKey, expiresIn = 3600) {
  if (!imageKey) return null;

  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: imageKey,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error(`❌ Error generating pre-signed URL for ${imageKey}:`, error.message);
    return null;
  }
}

/**
 * Build the S3 key from an artist name.
 * Converts the artist name to a safe filename format.
 *
 * @param {string} artistName - The artist's name
 * @returns {string} S3 object key
 */
function buildImageKey(artistName) {
  if (!artistName) return null;
  // Convert to lowercase, replace spaces with underscores, remove special chars
  const safeName = artistName
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  return `artists/${safeName}.jpg`;
}

module.exports = {
  getImageUrl,
  buildImageKey,
  S3_BUCKET,
};
