/**
 * Enterprise Database Backup & Restore Utility
 * 
 * Exporters all tables and data dynamically into a portable JSON snapshot.
 * Works without requiring native pg_dump/pg_restore binaries.
 * 
 * Usage:
 *   Backup:   node server/scripts/backup-db.js
 *   Restore:  node server/scripts/backup-db.js --restore server/backups/backup_xxxx.json
 */

const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');

async function getTables() {
  const query = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('SequelizeMeta', 'SequelizeData')
    ORDER BY table_name;
  `;
  const [results] = await sequelize.query(query);
  return results.map(row => row.table_name);
}

async function backup() {
  console.log('🔄 Starting Database Backup...');
  const startTime = Date.now();
  
  try {
    const tables = await getTables();
    console.log(`📋 Found ${tables.length} tables to backup.`);
    
    const backupData = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        dialect: 'postgres',
        tableCount: tables.length
      },
      data: {}
    };

    for (const table of tables) {
      console.log(`  📦 Backing up table: "${table}"...`);
      const [rows] = await sequelize.query(`SELECT * FROM "${table}"`);
      backupData.data[table] = rows;
      console.log(`    ✅ Captured ${rows.length} rows.`);
    }

    // Ensure backups directory exists
    const backupsDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp.substring(0, 19)}.json`;
    const outputPath = path.join(backupsDir, filename);

    fs.writeFileSync(outputPath, JSON.stringify(backupData, null, 2), 'utf8');
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 Backup Completed Successfully in ${duration}s!`);
    console.log(`💾 Saved to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('\n❌ Backup Failed:', error);
    throw error;
  }
}

async function restore(backupFilePath) {
  console.log(`🔄 Starting Database Restore from: ${backupFilePath}...`);
  const startTime = Date.now();

  if (!fs.existsSync(backupFilePath)) {
    console.error(`❌ Backup file does not exist: ${backupFilePath}`);
    process.exit(1);
  }

  try {
    const rawData = fs.readFileSync(backupFilePath, 'utf8');
    const backupData = JSON.parse(rawData);

    if (!backupData.metadata || !backupData.data) {
      throw new Error('Invalid backup file format.');
    }

    const tables = Object.keys(backupData.data);
    console.log(`📋 Found ${tables.length} tables in backup file.`);

    const transaction = await sequelize.transaction();

    try {
      console.log('🔒 Disabling database constraints & triggers...');
      await sequelize.query('SET CONSTRAINTS ALL DEFERRED', { transaction });
      
      // Temporarily disable triggers (including foreign key checks) on all tables
      for (const table of tables) {
        await sequelize.query(`ALTER TABLE "${table}" DISABLE TRIGGER ALL`, { transaction });
      }

      for (const table of tables) {
        console.log(`  🗑️ Truncating table: "${table}"...`);
        await sequelize.query(`TRUNCATE TABLE "${table}" CASCADE`, { transaction });

        const rows = backupData.data[table];
        if (rows.length === 0) {
          console.log(`    ℹ️ Table is empty, skipping insert.`);
          continue;
        }

        console.log(`  📥 Restoring ${rows.length} rows to "${table}"...`);
        
        // Extract column names
        const columns = Object.keys(rows[0]);
        const columnsStr = columns.map(col => `"${col}"`).join(', ');
        
        // Bulk insert rows using parameterized query parameter array
        for (let i = 0; i < rows.length; i += 200) {
          const batch = rows.slice(i, i + 200);
          
          let valuePlaceholderRows = [];
          let replacements = {};
          let paramCounter = 0;

          batch.forEach((row, rowIndex) => {
            const rowPlaceholders = [];
            columns.forEach(col => {
              const paramName = `val_${i}_${rowIndex}_${paramCounter++}`;
              let value = row[col];
              // Handle JSONB / Array values
              if (value !== null && typeof value === 'object') {
                value = JSON.stringify(value);
              }
              replacements[paramName] = value;
              rowPlaceholders.push(`:${paramName}`);
            });
            valuePlaceholderRows.push(`(${rowPlaceholders.join(', ')})`);
          });

          const insertQuery = `
            INSERT INTO "${table}" (${columnsStr}) 
            VALUES ${valuePlaceholderRows.join(', ')}
          `;
          
          await sequelize.query(insertQuery, { replacements, transaction });
        }
        console.log(`    ✅ Table "${table}" restored.`);
      }

      console.log('🔓 Re-enabling database constraints & triggers...');
      for (const table of tables) {
        await sequelize.query(`ALTER TABLE "${table}" ENABLE TRIGGER ALL`, { transaction });
      }

      // Sync serial ID sequences for auto-incrementing primary keys
      console.log('🔄 Syncing auto-increment sequences...');
      for (const table of tables) {
        const [seqResults] = await sequelize.query(`
          SELECT a.attname
          FROM pg_class c
          JOIN pg_attribute a ON a.attrelid = c.oid
          JOIN pg_index i ON i.indrelid = c.oid AND a.attnum = any(i.indkey)
          WHERE c.relname = :table AND i.indisprimary
        `, { replacements: { table }, transaction });

        if (seqResults.length > 0) {
          const primaryKeyCol = seqResults[0].attname;
          const [idSeqResults] = await sequelize.query(`
            SELECT pg_get_serial_sequence(:table, :col) as seq
          `, { replacements: { table, col: primaryKeyCol }, transaction });

          const seqName = idSeqResults[0].seq;
          if (seqName) {
            await sequelize.query(`
              SELECT setval(:seqName, COALESCE((SELECT MAX("${primaryKeyCol}") FROM "${table}"), 1), true)
            `, { replacements: { seqName }, transaction });
          }
        }
      }

      await transaction.commit();
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n🎉 Restore Completed Successfully in ${duration}s!`);
    } catch (innerError) {
      console.log('❌ Restore failed, rolling back changes...');
      await transaction.rollback();
      throw innerError;
    }
  } catch (error) {
    console.error('\n❌ Restore Failed:', error);
    process.exit(1);
  }
}

// CLI Execution Router
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--restore')) {
    const fileIndex = args.indexOf('--restore') + 1;
    const filePath = args[fileIndex];
    if (!filePath) {
      console.error('❌ Please specify the path to the backup file to restore.');
      console.error('Usage: node server/scripts/backup-db.js --restore <path_to_file>');
      process.exit(1);
    }
    restore(filePath);
  } else {
    backup()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

module.exports = { backup, restore };
