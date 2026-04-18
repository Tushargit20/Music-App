/**
 * loadMusicData.js — Load songs from JSON into the music DynamoDB table
 * Uses ConditionExpression to prevent data overwrite during re-imports.
 *
 * Usage: node scripts/loadMusicData.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../src/config/aws');

const DATA_FILE = path.join(__dirname, '..', 'data', 'songs.json');
const TABLE_NAME = 'music';

async function loadMusicData() {
  console.log('🎵 Loading music data into DynamoDB...\n');

  // Read the JSON file
  const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
  const { songs } = JSON.parse(rawData);

  console.log(`  📂 Found ${songs.length} songs in songs.json\n`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const song of songs) {
    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            artist: song.artist,
            title: song.title,
            year: song.year,
            album: song.album,
            img_url: song.img_url || '',
          },
          // ❗ IMPORTANT: Prevent overwriting existing items
          // This ensures re-running the script doesn't corrupt data
          ConditionExpression:
            'attribute_not_exists(artist) AND attribute_not_exists(title)',
        })
      );
      console.log(`  ✅ Inserted: "${song.title}" by ${song.artist}`);
      inserted++;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        console.log(`  ⏭️  Skipped (exists): "${song.title}" by ${song.artist}`);
        skipped++;
      } else {
        console.error(`  ❌ Error inserting "${song.title}":`, error.message);
        errors++;
      }
    }
  }

  console.log('\n── Summary ──────────────────────────');
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Errors:   ${errors}`);
  console.log('  Total:    ' + songs.length);
  console.log('─────────────────────────────────────\n');
}

loadMusicData().catch(console.error);
