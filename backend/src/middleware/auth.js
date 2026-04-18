/**
 * auth.js — JWT Authentication Middleware
 * Verifies the JWT token from the Authorization header.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';

/**
 * Middleware: Verify JWT Token
 * Expects: Authorization: Bearer <token>
 * Sets req.user = { email, username } on success.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      email: decoded.email,
      username: decoded.username,
    };
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Generate a JWT token for a user.
 * @param {Object} user - { email, username }
 * @returns {string} JWT token
 */
function generateToken(user) {
  return jwt.sign(
    { email: user.email, username: user.username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

module.exports = {
  authenticateToken,
  generateToken,
  JWT_SECRET,
};
