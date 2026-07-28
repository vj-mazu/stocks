/**
 * Run All Migrations with Proper Tracking
 * 
 * This script runs pending migrations on server startup.
 * Uses SequelizeMeta table to track which migrations have been executed.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize } = require('./config/database');

async function runAllMigrations() {
    console.log('🚀 Starting Migration System on Startup...\n');

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
        let executedNames = executedMigrations.map(m => m.name);

        const tableExists = async (tableName) => {
            const [rows] = await sequelize.query(
                "SELECT to_regclass(:tableName) AS table_name",
                {
                    replacements: { tableName: `public.${tableName}` },
                    type: sequelize.QueryTypes.SELECT
                }
            );
            return Boolean(rows && rows.table_name);
        };

        const columnExists = async (tableName, columnName) => {
            const [rows] = await sequelize.query(
                `
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = :tableName
                  AND column_name = :columnName
                LIMIT 1
                `,
                {
                    replacements: { tableName, columnName },
                    type: sequelize.QueryTypes.SELECT
                }
            );
            return Boolean(rows && rows.column_name);
        };

        const removeStaleMigrationMarkers = async (migrationNames, reason) => {
            const staleNames = migrationNames.filter(name => executedNames.includes(name));
            if (staleNames.length === 0) {
                return;
            }

            console.warn(`⚠️  Removing stale migration markers (${reason}): ${staleNames.join(', ')}`);
            await sequelize.query(
                'DELETE FROM "SequelizeMeta" WHERE name IN (:names)',
                { replacements: { names: staleNames } }
            );
            executedNames = executedNames.filter(name => !staleNames.includes(name));
        };

        if (!(await tableExists('lorry_transit_details'))) {
            await removeStaleMigrationMarkers([
                '142_create_lorry_transit_details.js',
                '143_add_place_wb_approver_tracking.js',
                '144_update_existing_place_approved_at.js',
                '145_create_inventory_quality_parameters.js'
            ], 'lorry_transit_details table is missing');
        }

        if (!(await columnExists('sample_entries', 'wbInputType'))) {
            await removeStaleMigrationMarkers([
                '139_add_transit_approval_fields_to_sample_entries.js',
                '140_add_outturn_id_to_sample_entries.js',
                '141_add_wb_weights_to_sample_entries.js',
                '142_create_lorry_transit_details.js',
                '143_add_place_wb_approver_tracking.js',
                '144_update_existing_place_approved_at.js',
                '145_create_inventory_quality_parameters.js'
            ], 'sample_entries transit columns are missing');
        }

        if (!(await tableExists('inventory_quality_parameters'))) {
            await removeStaleMigrationMarkers([
                '145_create_inventory_quality_parameters.js'
            ], 'inventory_quality_parameters table is missing');
        }

        const getMigrationOrderKey = (file) => {
            const numericPrefix = file.match(/^(\d+)/);
            if (numericPrefix) {
                return [0, Number(numericPrefix[1]), file];
            }
            return [1, Number.MAX_SAFE_INTEGER, file];
        };

        const compareMigrations = (a, b) => {
            const left = getMigrationOrderKey(a);
            const right = getMigrationOrderKey(b);
            return left[0] - right[0] || left[1] - right[1] || left[2].localeCompare(right[2]);
        };

        // Get all migration files
        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.js') && file !== 'migrate.js')
            .sort(compareMigrations);

        let executed = 0;
        let skipped = 0;

        for (const file of files) {
            if (executedNames.includes(file)) {
                skipped++;
                continue;
            }

            console.log(`📋 Running pending migration: ${file}`);
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
                console.error(error);
                console.error(`\n⛔ Migration failed on startup. Server will not start with a partial schema.\n`);
                process.exit(1);
            }
        }

        if (executed > 0) {
            console.log(`\n✅ Migration complete! Executed ${executed} new migrations.\n`);
        } else {
            console.log(`\n✅ All migrations up to date (${skipped} already executed).\n`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration system failed:', error);
        process.exit(1);
    }
}

runAllMigrations();
