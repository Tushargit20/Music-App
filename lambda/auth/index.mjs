/**
 * Lambda Function: Auth Handler
 * Handles /auth/login, /auth/register, /auth/logout
 * 
 * Deployed behind API Gateway as a single Lambda function
 * that routes based on the HTTP method and path.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';
import jwt from 'jsonwebtoken'; // Layer or bundled dependency

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const JWT_SECRET = process.env.JWT_SECRET || 'lambda-secret-key';
const TABLE_NAME = 'login';

// ── Simple bcrypt alternative for Lambda (no native modules) ──
// In production, use a Lambda Layer with bcryptjs
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verify;
}

function generateToken(user) {
  return jwt.sign({ email: user.email, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
}

// ── CORS Headers ──────────────────────────────────────────────
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
};

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

// ── Main Handler ──────────────────────────────────────────────
export const handler = async (event) => {
  console.log('Auth Event:', JSON.stringify(event));

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  const path = event.path || event.resource;
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    // ── POST /auth/register ──
    if (path.endsWith('/register') && event.httpMethod === 'POST') {
      const { email, username, password } = body;

      if (!email || !username || !password) {
        return response(400, { error: 'All fields are required.' });
      }

      const hashedPassword = hashPassword(password);

      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: { email: email.toLowerCase(), username, password: hashedPassword },
        ConditionExpression: 'attribute_not_exists(email)',
      }));

      const token = generateToken({ email: email.toLowerCase(), username });
      return response(201, { message: 'Registration successful!', token, user: { email: email.toLowerCase(), username } });
    }

    // ── POST /auth/login ──
    if (path.endsWith('/login') && event.httpMethod === 'POST') {
      const { email, password } = body;

      if (!email || !password) {
        return response(400, { error: 'Email and password are required.' });
      }

      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { email: email.toLowerCase() },
      }));

      if (!result.Item || !verifyPassword(password, result.Item.password)) {
        return response(401, { error: 'Email or password is incorrect.' });
      }

      const token = generateToken({ email: result.Item.email, username: result.Item.username });
      return response(200, { message: 'Login successful!', token, user: { email: result.Item.email, username: result.Item.username } });
    }

    // ── POST /auth/logout ──
    if (path.endsWith('/logout') && event.httpMethod === 'POST') {
      return response(200, { message: 'Logged out successfully.' });
    }

    return response(404, { error: 'Route not found' });

  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return response(409, { error: 'Email already exists.' });
    }
    console.error('Auth Lambda Error:', error);
    return response(500, { error: 'Internal server error' });
  }
};
