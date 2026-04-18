/**
 * routes/auth.js — Authentication Routes
 * Handles user registration, login, and logout.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const { getUserByEmail, createUser } = require('../services/dynamodb');
const { generateToken, authenticateToken } = require('../middleware/auth');

// ─── POST /api/auth/register ─────────────────────────────────
// Register a new user with unique email validation
router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    // Validate required fields
    if (!email || !username || !password) {
      return res.status(400).json({
        error: 'All fields are required: email, username, password',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters.',
      });
    }

    // Hash the password with bcrypt (10 salt rounds)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Attempt to create user (ConditionExpression prevents duplicates)
    await createUser({
      email: email.toLowerCase(),
      username,
      password: hashedPassword,
    });

    // Generate JWT token for immediate login after registration
    const token = generateToken({ email: email.toLowerCase(), username });

    res.status(201).json({
      message: 'Registration successful!',
      token,
      user: { email: email.toLowerCase(), username },
    });
  } catch (error) {
    // DynamoDB ConditionalCheckFailedException = email already exists
    if (error.name === 'ConditionalCheckFailedException') {
      return res.status(409).json({
        error: 'The email already exists. Please use a different email.',
      });
    }
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ─── POST /api/auth/login ────────────────────────────────────
// Authenticate user with email and password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required.',
      });
    }

    // Look up user in DynamoDB
    const user = await getUserByEmail(email.toLowerCase());
    if (!user) {
      return res.status(401).json({
        error: 'Email or password is incorrect.',
      });
    }

    // Verify password against bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Email or password is incorrect.',
      });
    }

    // Generate JWT token
    const token = generateToken({
      email: user.email,
      username: user.username,
    });

    res.json({
      message: 'Login successful!',
      token,
      user: { email: user.email, username: user.username },
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────
// Logout — client-side token removal (JWT is stateless)
router.post('/logout', authenticateToken, (req, res) => {
  // JWT is stateless, so logout is handled client-side by deleting the token.
  // This endpoint exists for API completeness and can be extended
  // with a token blacklist if needed.
  res.json({ message: 'Logged out successfully.' });
});

module.exports = router;
