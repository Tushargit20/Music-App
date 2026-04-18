/**
 * routes/subscription.js — Subscription Routes
 * Handles adding, viewing, and removing song subscriptions.
 */

const express = require('express');
const router = express.Router();

const {
  getSubscriptions,
  addSubscription,
  removeSubscription,
} = require('../services/dynamodb');
const { getImageUrl, buildImageKey } = require('../services/s3');
const { authenticateToken } = require('../middleware/auth');

// All subscription routes require authentication
router.use(authenticateToken);

// ─── GET /api/subscriptions ──────────────────────────────────
// Get all subscriptions for the logged-in user
router.get('/', async (req, res) => {
  try {
    const email = req.user.email;
    const subscriptions = await getSubscriptions(email);

    // Enrich with pre-signed S3 image URLs
    const enrichedSubs = await Promise.all(
      subscriptions.map(async (sub) => {
        const imageKey = buildImageKey(sub.artist);
        const imageUrl = imageKey ? await getImageUrl(imageKey) : null;
        return {
          ...sub,
          img_url: imageUrl,
        };
      })
    );

    res.json({
      count: enrichedSubs.length,
      subscriptions: enrichedSubs,
    });
  } catch (error) {
    console.error('❌ Get subscriptions error:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions.' });
  }
});

// ─── POST /api/subscriptions ─────────────────────────────────
// Subscribe to a song (add to user's subscription list)
router.post('/', async (req, res) => {
  try {
    const email = req.user.email;
    const { title, artist, year, album, img_url } = req.body;

    // Validate required fields
    if (!title || !artist) {
      return res.status(400).json({
        error: 'Title and artist are required to subscribe.',
      });
    }

    await addSubscription(email, { title, artist, year, album, img_url });

    res.status(201).json({
      message: `Successfully subscribed to "${title}" by ${artist}!`,
    });
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return res.status(409).json({
        error: 'You are already subscribed to this song.',
      });
    }
    console.error('❌ Add subscription error:', error);
    res.status(500).json({ error: 'Failed to subscribe.' });
  }
});

// ─── DELETE /api/subscriptions ───────────────────────────────
// Remove a song from the user's subscriptions
router.delete('/', async (req, res) => {
  try {
    const email = req.user.email;
    const { song_id } = req.body;

    if (!song_id) {
      return res.status(400).json({
        error: 'song_id is required (format: "artist#title").',
      });
    }

    await removeSubscription(email, song_id);

    res.json({ message: 'Subscription removed successfully.' });
  } catch (error) {
    console.error('❌ Remove subscription error:', error);
    res.status(500).json({ error: 'Failed to remove subscription.' });
  }
});

module.exports = router;
