/**
 * routes/music.js — Music Search Routes
 * Handles song search with multiple criteria using AND logic.
 */

const express = require('express');
const router = express.Router();

const { searchMusic, getAllMusic } = require('../services/dynamodb');
const { getImageUrl, buildImageKey } = require('../services/s3');
const { authenticateToken } = require('../middleware/auth');

// ─── GET /api/music/search ───────────────────────────────────
// Search songs by title, artist, album, year (AND logic)
// At least one search field is required.
// Query params: ?title=...&artist=...&album=...&year=...
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { title, artist, album, year } = req.query;

    // At least one search criteria must be provided
    if (!title && !artist && !album && !year) {
      return res.status(400).json({
        error: 'At least one search field is required (title, artist, album, or year).',
      });
    }

    // Search DynamoDB
    const songs = await searchMusic({
      title: title || null,
      artist: artist || null,
      album: album || null,
      year: year || null,
    });

    // Enrich results with pre-signed S3 image URLs
    const enrichedSongs = await Promise.all(
      songs.map(async (song) => {
        const imageKey = buildImageKey(song.artist);
        const imageUrl = imageKey ? await getImageUrl(imageKey) : null;
        return {
          ...song,
          img_url: imageUrl, // Pre-signed S3 URL for the frontend
        };
      })
    );

    res.json({
      count: enrichedSongs.length,
      results: enrichedSongs,
    });
  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({ error: 'Search failed. Please try again.' });
  }
});

// ─── GET /api/music/all ───────────────────────────────────────────────────────
// List all songs with pagination.
// Query params: ?limit=10&next=<base64 token>
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 50)
      : 10;

    let lastKey = null;
    if (req.query.next) {
      try {
        const decoded = Buffer.from(req.query.next, 'base64').toString('utf8');
        lastKey = JSON.parse(decoded);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid pagination token.' });
      }
    }

    const { items, lastKey: nextKey } = await getAllMusic({ limit, lastKey });

    const enrichedSongs = await Promise.all(
      items.map(async (song) => {
        const imageKey = buildImageKey(song.artist);
        const imageUrl = imageKey ? await getImageUrl(imageKey) : null;
        return {
          ...song,
          img_url: imageUrl,
        };
      })
    );

    const nextToken = nextKey
      ? Buffer.from(JSON.stringify(nextKey)).toString('base64')
      : null;

    res.json({
      count: enrichedSongs.length,
      results: enrichedSongs,
      nextToken,
    });
  } catch (error) {
    console.error('❌ List all songs error:', error);
    res.status(500).json({ error: 'Failed to fetch songs.' });
  }
});

module.exports = router;
