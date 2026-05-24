// Jest setup file for database tests
const { sequelize } = require('../config/database');

// Increase timeout for property-based tests
jest.setTimeout(60000);

// Setup database connection before all tests and seed test users
beforeAll(async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Seed test users
    const bcrypt = require('bcryptjs');
    const User = require('../models/User');

    // 1. Seed 'admin'
    const adminHashed = await bcrypt.hash('admin123', 10);
    const [adminUser, adminCreated] = await User.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        password: adminHashed,
        role: 'admin',
        isActive: true
      }
    });
    if (!adminCreated) {
      adminUser.password = adminHashed;
      adminUser.role = 'admin';
      adminUser.isActive = true;
      await adminUser.save();
    }

    // 2. Seed 'ashish'
    const ashishHashed = await bcrypt.hash('ashish789', 10);
    const [ashishUser, ashishCreated] = await User.findOrCreate({
      where: { username: 'ashish' },
      defaults: {
        password: ashishHashed,
        role: 'admin',
        isActive: true
      }
    });
    if (!ashishCreated) {
      ashishUser.password = ashishHashed;
      ashishUser.role = 'admin';
      ashishUser.isActive = true;
      await ashishUser.save();
    }

    global.adminUserId = adminUser.id;
    global.ashishUserId = ashishUser.id;

    console.log('Test users seeded successfully.');
  } catch (error) {
    console.error('Unable to connect to the database or seed users:', error);
    throw error;
  }
});

// Clean up after all tests
afterAll(async () => {
  try {
    await sequelize.close();
    console.log('Database connection closed.');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
});