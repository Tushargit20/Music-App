/**
 * createTables.js — DynamoDB Table Creation Script
 * Creates the login, music, and subscription tables with their
 * primary keys, GSI, and LSI definitions.
 *
 * Usage: node scripts/createTables.js
 */

require('dotenv').config();
const {
  CreateTableCommand,
  DescribeTableCommand,
  waitUntilTableExists,
} = require('@aws-sdk/client-dynamodb');
const { dynamoDBClient } = require('../src/config/aws');

// ═══════════════════════════════════════════════════════════════
// TABLE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

const tables = [
  // ── Table 1: login ──────────────────────────────────────────
  {
    TableName: 'login',
    KeySchema: [
      { AttributeName: 'email', KeyType: 'HASH' }, // Partition Key
    ],
    AttributeDefinitions: [
      { AttributeName: 'email', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST', // On-demand pricing (ideal for academic)
  },

  // ── Table 2: music ─────────────────────────────────────────
  // PK: artist, SK: title
  // LSI: artist-year-index (same PK, SK: year)
  // GSI: album-year-index (PK: album, SK: year)
  {
    TableName: 'music',
    KeySchema: [
      { AttributeName: 'artist', KeyType: 'HASH' },  // Partition Key
      { AttributeName: 'title', KeyType: 'RANGE' },   // Sort Key
    ],
    AttributeDefinitions: [
      { AttributeName: 'artist', AttributeType: 'S' },
      { AttributeName: 'title', AttributeType: 'S' },
      { AttributeName: 'year', AttributeType: 'S' },
      { AttributeName: 'album', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',

    // Local Secondary Index: Query songs by artist sorted by year
    // LSI must share the same partition key as the base table
    LocalSecondaryIndexes: [
      {
        IndexName: 'artist-year-index',
        KeySchema: [
          { AttributeName: 'artist', KeyType: 'HASH' },  // Same PK
          { AttributeName: 'year', KeyType: 'RANGE' },     // Different SK
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],

    // Global Secondary Index: Query songs by album sorted by year
    // GSI can have a completely different partition key
    GlobalSecondaryIndexes: [
      {
        IndexName: 'album-year-index',
        KeySchema: [
          { AttributeName: 'album', KeyType: 'HASH' },  // New PK
          { AttributeName: 'year', KeyType: 'RANGE' },   // SK
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },

  // ── Table 3: subscription ──────────────────────────────────
  {
    TableName: 'subscription',
    KeySchema: [
      { AttributeName: 'email', KeyType: 'HASH' },    // Partition Key
      { AttributeName: 'song_id', KeyType: 'RANGE' },  // Sort Key: "artist#title"
    ],
    AttributeDefinitions: [
      { AttributeName: 'email', AttributeType: 'S' },
      { AttributeName: 'song_id', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
];

// ═══════════════════════════════════════════════════════════════
// TABLE CREATION LOGIC
// ═══════════════════════════════════════════════════════════════

async function tableExists(tableName) {
  try {
    await dynamoDBClient.send(
      new DescribeTableCommand({ TableName: tableName })
    );
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') return false;
    throw error;
  }
}

async function createTables() {
  console.log('🗄️  Creating DynamoDB tables...\n');

  for (const tableDef of tables) {
    const name = tableDef.TableName;

    // Check if table already exists
    if (await tableExists(name)) {
      console.log(`  ✅ Table "${name}" already exists. Skipping.`);
      continue;
    }

    try {
      await dynamoDBClient.send(new CreateTableCommand(tableDef));
      console.log(`  ⏳ Creating table "${name}"...`);

      // Wait until the table is active
      await waitUntilTableExists(
        { client: dynamoDBClient, maxWaitTime: 120 },
        { TableName: name }
      );
      console.log(`  ✅ Table "${name}" created and active!`);
    } catch (error) {
      console.error(`  ❌ Error creating table "${name}":`, error.message);
    }
  }

  console.log('\n🎉 All tables ready!');
}

// Run the script
createTables().catch(console.error);
