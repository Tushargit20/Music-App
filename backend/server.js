/**
 * server.js — Entry point for the Music Subscription Backend
 * Starts the Express server on the configured port.
 */

require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎵 Music Subscription API running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   AWS Region:  ${process.env.AWS_REGION || 'us-east-1'}`);
});
