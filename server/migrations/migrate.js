/**
 * Migration Runner with Proper Tracking
 * 
 * This script runs pending migrations and tracks which ones have been executed.
 * Uses a SequelizeMeta table to track migration status.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');

async function migrate() {
    console.log('🚀 Starting Migration System...\n');

    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established\n');

        const queryInterface = sequelize.getQueryInterface();

        // Create SequelizeMeta table if it doesn't exist
        await queryInterface.createTable('SequelizeMeta', {
            name: {
                type: sequelize.Sequelize.STRING,
                allowNull: false,
                unique: true,
                primaryKey: true
            }
        }).catch(err => {
            if (!err.message.includes('already exists')) {
                throw err;
            }
        });

        // Get list of executed migrations
        const executedMigrations = await sequelize.query(
            'SELECT name FROM "SequelizeMeta" ORDER BY name',
            { type: sequelize.QueryTypes.SELECT }
        );
        const executedNames = executedMigrations.map(m => m.name);

        console.log(`📊 Found ${executedNames.length} previously executed migrations\n`);

        // Get all migration files
        const migrationsDir = path.join(__dirname);
        const files = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.js') && file !== 'migrate.js')
            .sort();

        console.log(`📁 Found ${files.length} total migration files\n`);

        let executed = 0;
        let skipped = 0;

        for (const file of files) {
            if (executedNames.includes(file)) {
                console.log(`⏭️  Skipping ${file} (already executed)`);
                skipped++;
                continue;
            }

            console.log(`📋 Running migration: ${file}`);
            try {
                const migration = require(path.join(migrationsDir, file));

                if (typeof migration === 'function') {
                    await migration();
                } else if (migration.up) {
                    await migration.up(queryInterface, sequelize.Sequelize);
                } else {
                    console.log(`  ⚠️  No up function found in ${file}, skipping.\n`);
                    continue;
                }

                // Record successful migration
                await sequelize.query(
                    'INSERT INTO "SequelizeMeta" (name) VALUES (?)',
                    { replacements: [file] }
                );

                console.log(`  ✅ Successfully executed ${file}\n`);
                executed++;
            } catch (error) {
                console.error(`  ❌ Error running ${file}:`, error.message);
                console.error(`\n⛔ Migration failed. Please fix the error and run again.\n`);
                process.exit(1);
            }
        }

        console.log(`\n✅ Migration complete!`);
        console.log(`   • Executed: ${executed}`);
        console.log(`   • Skipped: ${skipped}`);
        console.log(`   • Total: ${files.length}\n`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration system failed:', error);
        process.exit(1);
    }
}

migrate();
