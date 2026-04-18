/**
 * Lambda Function: Music Search Handler
 * Handles GET /music/search with query parameters
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import jwt from 'jsonwebtoken';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const JWT_SECRET = process.env.JWT_SECRET || 'lambda-secret-key';
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'music-app-artist-images';
const TABLE_NAME = 'music';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
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
  console.log('Music Event:', JSON.stringify(event));

  if (event.httpMethod === 'OPTIONS') return response(200, {});

  try {
    verifyToken(event);
  } catch {
    return response(401, { error: 'Authentication required.' });
  }

  try {
    const params = event.queryStringParameters || {};
    const { title, artist, album, year, limit: limitParam, next } = params;

    // Handle /music/all for full list with pagination
    if (event.path?.endsWith('/all')) {
      const limitRaw = parseInt(limitParam, 10);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 10;

      let lastKey = null;
      if (next) {
        try {
          lastKey = JSON.parse(Buffer.from(next, 'base64').toString('utf8'));
        } catch {
          return response(400, { error: 'Invalid pagination token.' });
        }
      }

      const scanParams = {
        TableName: TABLE_NAME,
        Limit: limit,
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      };

      const result = await docClient.send(new ScanCommand(scanParams));
      const songs = result.Items || [];

      const enriched = await Promise.all(songs.map(async (song) => ({
        ...song,
        img_url: await getImageUrl(buildImageKey(song.artist)),
      })));

      const nextToken = result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : null;

      return response(200, { count: enriched.length, results: enriched, nextToken });
    }

    if (!title && !artist && !album && !year) {
      return response(400, { error: 'At least one search field is required.' });
    }

    let songs = [];
    const filterParts = [];
    const exprAttrNames = {};
    const exprAttrValues = {};

    if (artist) {
      let keyCondition = '#artist = :artist';
      exprAttrNames['#artist'] = 'artist';
      exprAttrValues[':artist'] = artist;

      if (title) {
        keyCondition += ' AND begins_with(#title, :title)';
        exprAttrNames['#title'] = 'title';
        exprAttrValues[':title'] = title;
      }
      if (album) {
        filterParts.push('contains(#album, :album)');
        exprAttrNames['#album'] = 'album';
        exprAttrValues[':album'] = album;
      }
      if (year) {
        filterParts.push('#yr = :year');
        exprAttrNames['#yr'] = 'year';
        exprAttrValues[':year'] = year;
      }

      const queryParams = {
        TableName: TABLE_NAME,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues,
      };
      if (filterParts.length > 0) queryParams.FilterExpression = filterParts.join(' AND ');

      const result = await docClient.send(new QueryCommand(queryParams));
      songs = result.Items || [];

    } else if (album) {
      let keyCondition = '#album = :album';
      exprAttrNames['#album'] = 'album';
      exprAttrValues[':album'] = album;

      if (year) {
        keyCondition += ' AND #yr = :year';
        exprAttrNames['#yr'] = 'year';
        exprAttrValues[':year'] = year;
      }
      if (title) {
        filterParts.push('contains(#title, :title)');
        exprAttrNames['#title'] = 'title';
        exprAttrValues[':title'] = title;
      }

      const queryParams = {
        TableName: TABLE_NAME,
        IndexName: 'album-year-index',
        KeyConditionExpression: keyCondition,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues,
      };
      if (filterParts.length > 0) queryParams.FilterExpression = filterParts.join(' AND ');

      const result = await docClient.send(new QueryCommand(queryParams));
      songs = result.Items || [];

    } else {
      if (title) {
        filterParts.push('contains(#title, :title)');
        exprAttrNames['#title'] = 'title';
        exprAttrValues[':title'] = title;
      }
      if (year) {
        filterParts.push('#yr = :year');
        exprAttrNames['#yr'] = 'year';
        exprAttrValues[':year'] = year;
      }

      if (filterParts.length > 0) {
        const result = await docClient.send(new ScanCommand({
          TableName: TABLE_NAME,
          FilterExpression: filterParts.join(' AND '),
          ExpressionAttributeNames: exprAttrNames,
          ExpressionAttributeValues: exprAttrValues,
        }));
        songs = result.Items || [];
      }
    }

    // Enrich with S3 image URLs
    const enriched = await Promise.all(songs.map(async (song) => ({
      ...song,
      img_url: await getImageUrl(buildImageKey(song.artist)),
    })));

    return response(200, { count: enriched.length, results: enriched });

  } catch (error) {
    console.error('Music Lambda Error:', error);
    return response(500, { error: 'Search failed.' });
  }
};
