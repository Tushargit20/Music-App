/**
 * seedLoginData.js — Seed sample users into the login table
 * Creates a few test users for development and demonstration.
 *
 * Usage: node scripts/seedLoginData.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../src/config/aws');

const TABLE_NAME = 'login';

// Sample users for testing
const sampleUsers = [
  {
    email: 'tushar@example.com',
    username: 'Tushar',
    password: 'password123',
  },
  {
    email: 'admin@example.com',
    username: 'Admin',
    password: 'admin123',
  },
  {
    email: 'test@example.com',
    username: 'TestUser',
    password: 'test1234',
  },
];

async function seedUsers() {
  console.log('👤 Seeding sample users into the login table...\n');

  let inserted = 0;
  let skipped = 0;

  for (const user of sampleUsers) {
    try {
      // Hash the password before storing
      const hashedPassword = await bcrypt.hash(user.password, 10);

      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            email: user.email,
            username: user.username,
            password: hashedPassword,
          },
          // Prevent overwriting existing users
          ConditionExpression: 'attribute_not_exists(email)',
        })
      );

      console.log(`  ✅ Created user: ${user.email} (password: ${user.password})`);
      inserted++;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        console.log(`  ⏭️  Skipped (exists): ${user.email}`);
        skipped++;
      } else {
        console.error(`  ❌ Error creating ${user.email}:`, error.message);
      }
    }
  }

  console.log(`\n  Inserted: ${inserted}, Skipped: ${skipped}\n`);
}

seedUsers().catch(console.error);
