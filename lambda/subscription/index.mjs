/**
 * Lambda Function: Subscription Handler
 * Handles GET, POST, DELETE /subscriptions
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import jwt from 'jsonwebtoken';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const JWT_SECRET = process.env.JWT_SECRET || 'lambda-secret-key';
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'music-app-artist-images';
const TABLE_NAME = 'subscription';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
};

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function verifyToken(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (!authHeader) throw new Error('No token');
  const token = authHeader.split(' ')[1];
  return jwt.verify(token, JWT_SECRET);
}

function buildImageKey(artistName) {
  return `artists/${artistName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}.jpg`;
}

async function getImageUrl(imageKey) {
  try {
    const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: imageKey });
    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  } catch { return null; }
}

export const handler = async (event) => {
  console.log('Subscription Event:', JSON.stringify(event));

  if (event.httpMethod === 'OPTIONS') return response(200, {});

  let user;
  try {
    user = verifyToken(event);
  } catch {
    return response(401, { error: 'Authentication required.' });
  }

  const email = user.email;
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    // ── GET: List subscriptions ──
    if (event.httpMethod === 'GET') {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: '#email = :email',
        ExpressionAttributeNames: { '#email': 'email' },
        ExpressionAttributeValues: { ':email': email },
      }));

      const subs = result.Items || [];
      const enriched = await Promise.all(subs.map(async (sub) => ({
        ...sub,
        img_url: await getImageUrl(buildImageKey(sub.artist)),
      })));

      return response(200, { count: enriched.length, subscriptions: enriched });
    }

    // ── POST: Add subscription ──
    if (event.httpMethod === 'POST') {
      const { title, artist, year, album, img_url } = body;

      if (!title || !artist) {
        return response(400, { error: 'Title and artist are required.' });
      }

      const songId = `${artist}#${title}`;

      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: { email, song_id: songId, title, artist, year, album, img_url: img_url || '' },
        ConditionExpression: 'attribute_not_exists(email) AND attribute_not_exists(song_id)',
      }));

      return response(201, { message: `Subscribed to "${title}" by ${artist}!` });
    }

    // ── DELETE: Remove subscription ──
    if (event.httpMethod === 'DELETE') {
      const { song_id } = body;

      if (!song_id) {
        return response(400, { error: 'song_id is required.' });
      }

      await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { email, song_id },
      }));

      return response(200, { message: 'Subscription removed.' });
    }

    return response(404, { error: 'Route not found' });

  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return response(409, { error: 'Already subscribed to this song.' });
    }
    console.error('Subscription Lambda Error:', error);
    return response(500, { error: 'Internal server error' });
  }
};
