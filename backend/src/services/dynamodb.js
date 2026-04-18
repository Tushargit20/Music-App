/**
 * dynamodb.js — DynamoDB Service Layer
 * All DynamoDB operations (CRUD) for login, music, and subscription tables.
 */

const {
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../config/aws');

// Table names
const TABLES = {
  LOGIN: 'login',
  MUSIC: 'music',
  SUBSCRIPTION: 'subscription',
};

// ═══════════════════════════════════════════════════════════════
// AUTH OPERATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get a user by email from the login table.
 * @param {string} email - User's email (partition key)
 * @returns {Object|null} User record or null
 */
async function getUserByEmail(email) {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLES.LOGIN,
      Key: { email },
    })
  );
  return result.Item || null;
}

/**
 * Create a new user in the login table.
 * Uses ConditionExpression to prevent overwriting existing users.
 * @param {Object} user - { email, username, password }
 */
async function createUser(user) {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.LOGIN,
      Item: {
        email: user.email,
        username: user.username,
        password: user.password, // Must be pre-hashed
      },
      // Prevent overwriting existing user
      ConditionExpression: 'attribute_not_exists(email)',
    })
  );
}

// ═══════════════════════════════════════════════════════════════
// MUSIC OPERATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Search for songs using multiple criteria (AND logic).
 * Strategy:
 *   - If artist is provided → Query base table (artist is PK)
 *   - If album is provided (no artist) → Query GSI
 *   - Otherwise → Scan with filters
 *
 * @param {Object} params - { title, artist, album, year }
 * @returns {Array} Matching songs
 */
async function searchMusic({ title, artist, album, year }) {
  // Build filter conditions for non-key attributes
  const filterParts = [];
  const exprAttrNames = {};
  const exprAttrValues = {};

  // ── Case 1: Artist provided → Query the base table ──
  if (artist) {
    let keyCondition = '#artist = :artist';
    exprAttrNames['#artist'] = 'artist';
    exprAttrValues[':artist'] = artist;

    // Title is the sort key — use begins_with for partial match
    if (title) {
      keyCondition += ' AND begins_with(#title, :title)';
      exprAttrNames['#title'] = 'title';
      exprAttrValues[':title'] = title;
    }

    // Album and year are non-key → use FilterExpression
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
      TableName: TABLES.MUSIC,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeNames: exprAttrNames,
      ExpressionAttributeValues: exprAttrValues,
    };

    if (filterParts.length > 0) {
      queryParams.FilterExpression = filterParts.join(' AND ');
    }

    const result = await docClient.send(new QueryCommand(queryParams));
    return result.Items || [];
  }

  // ── Case 2: Album provided (no artist) → Query GSI ──
  if (album) {
    let keyCondition = '#album = :album';
    exprAttrNames['#album'] = 'album';
    exprAttrValues[':album'] = album;

    // Year is the GSI sort key
    if (year) {
      keyCondition += ' AND #yr = :year';
      exprAttrNames['#yr'] = 'year';
      exprAttrValues[':year'] = year;
    }

    // Title filter
    if (title) {
      filterParts.push('contains(#title, :title)');
      exprAttrNames['#title'] = 'title';
      exprAttrValues[':title'] = title;
    }

    const queryParams = {
      TableName: TABLES.MUSIC,
      IndexName: 'album-year-index',
      KeyConditionExpression: keyCondition,
      ExpressionAttributeNames: exprAttrNames,
      ExpressionAttributeValues: exprAttrValues,
    };

    if (filterParts.length > 0) {
      queryParams.FilterExpression = filterParts.join(' AND ');
    }

    const result = await docClient.send(new QueryCommand(queryParams));
    return result.Items || [];
  }

  // ── Case 3: No artist or album → Scan with filters ──
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

  // If no filters at all, return empty (at least one field required)
  if (filterParts.length === 0) {
    return [];
  }

  const scanParams = {
    TableName: TABLES.MUSIC,
    FilterExpression: filterParts.join(' AND '),
    ExpressionAttributeNames: exprAttrNames,
    ExpressionAttributeValues: exprAttrValues,
  };

  const result = await docClient.send(new ScanCommand(scanParams));
  return result.Items || [];
}

/**
 * Get all songs with pagination.
 * @param {Object} params - { limit, lastKey }
 * @returns {Object} { items, lastKey }
 */
async function getAllMusic({ limit = 10, lastKey = null } = {}) {
  const scanParams = {
    TableName: TABLES.MUSIC,
    Limit: limit,
  };

  if (lastKey) {
    scanParams.ExclusiveStartKey = lastKey;
  }

  const result = await docClient.send(new ScanCommand(scanParams));
  return {
    items: result.Items || [],
    lastKey: result.LastEvaluatedKey || null,
  };
}

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTION OPERATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get all subscriptions for a user.
 * @param {string} email - User's email (PK of subscription table)
 * @returns {Array} List of subscribed songs
 */
async function getSubscriptions(email) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.SUBSCRIPTION,
      KeyConditionExpression: '#email = :email',
      ExpressionAttributeNames: { '#email': 'email' },
      ExpressionAttributeValues: { ':email': email },
    })
  );
  return result.Items || [];
}

/**
 * Add a song to the user's subscriptions.
 * @param {string} email - User's email
 * @param {Object} song - { title, artist, year, album, image_url }
 */
async function addSubscription(email, song) {
  const songId = `${song.artist}#${song.title}`;

  await docClient.send(
    new PutCommand({
      TableName: TABLES.SUBSCRIPTION,
      Item: {
        email,
        song_id: songId,
        title: song.title,
        artist: song.artist,
        year: song.year,
        album: song.album,
        img_url: song.img_url || '',
      },
      // Prevent duplicate subscriptions
      ConditionExpression:
        'attribute_not_exists(email) AND attribute_not_exists(song_id)',
    })
  );
}

/**
 * Remove a song from the user's subscriptions.
 * @param {string} email - User's email
 * @param {string} songId - Song ID in format "artist#title"
 */
async function removeSubscription(email, songId) {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.SUBSCRIPTION,
      Key: {
        email,
        song_id: songId,
      },
    })
  );
}

module.exports = {
  getUserByEmail,
  createUser,
  searchMusic,
  getAllMusic,
  getSubscriptions,
  addSubscription,
  removeSubscription,
  TABLES,
};
