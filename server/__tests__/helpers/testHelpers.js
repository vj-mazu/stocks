const jwt = require('jsonwebtoken');

function generateTestToken() {
  // Use the ID of 'ashish' from global context (seeded in setup.js), fallback to 8 or 1
  const userId = global.ashishUserId || 8;
  const secret = process.env.JWT_SECRET || 'a3f7e9b1c4d8f2e6a0b5c3d9e7f1a4b8c2d6e0f3a7b1c5d9e3f7a0b4c8d2e6';
  
  return jwt.sign(
    { userId, role: 'admin' },
    secret,
    { expiresIn: '24h' }
  );
}

module.exports = {
  generateTestToken
};
