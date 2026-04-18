/**
 * aws.js — Centralized AWS SDK client configuration
 * All AWS service clients are created here and exported for reuse.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { S3Client } = require('@aws-sdk/client-s3');

// Base AWS config — uses env vars or IAM role on EC2/ECS
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
};

// Only add explicit credentials if provided (for local dev)
// On EC2/ECS, the IAM role provides credentials automatically
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  awsConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    ...(process.env.AWS_SESSION_TOKEN && {
      sessionToken: process.env.AWS_SESSION_TOKEN,
    }),
  };
}

// DynamoDB client
const dynamoDBClient = new DynamoDBClient(awsConfig);

// DynamoDB Document client (simplifies working with JS objects)
const docClient = DynamoDBDocumentClient.from(dynamoDBClient, {
  marshallOptions: {
    removeUndefinedValues: true, // Clean up undefined fields
  },
});

// S3 client
const s3Client = new S3Client(awsConfig);

module.exports = {
  dynamoDBClient,
  docClient,
  s3Client,
  AWS_REGION: awsConfig.region,
  S3_BUCKET: process.env.S3_BUCKET_NAME || 'music-app-artist-images',
};
