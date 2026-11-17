/**
 * Database Cleaner Utility
 * 
 * In MySQL InnoDB, each table has a hard limit of 64 keys/indexes.
 * When Sequelize associations or migrations run repeatedly over time,
 * MySQL can accumulate duplicate indexes (e.g. student_id_1, student_id_2, etc.).
 * 
 * This cleaner detects identical index signatures on any table and drops
 * redundant duplicate keys, keeping the primary canonical index intact and
 * preventing "Too many keys specified; max 64 keys allowed" errors.
 */

async function cleanDuplicateIndexes(sequelize) {
  if (!sequelize || typeof sequelize.query !== 'function') return;

  const dialect = typeof sequelize.getDialect === 'function' ? sequelize.getDialect() : '';
  if (dialect !== 'mysql') {
    return; // Non-MySQL engines (SQLite, etc.) do not have the 64-key limitation
  }

  try {
    const [tables] = await sequelize.query('SHOW TABLES');
    if (!tables || tables.length === 0) return;
    const tableKey = Object.keys(tables[0])[0];

    for (const tableRow of tables) {
      const tableName = tableRow[tableKey];
      if (!tableName) continue;

      try {
        const [indexes] = await sequelize.query(`SHOW INDEX FROM \`${tableName}\``);
        if (!indexes || indexes.length === 0) continue;

        // Group index columns by index key name
        const indexMap = {};
        for (const idx of indexes) {
          const name = idx.Key_name;
          if (!indexMap[name]) {
            indexMap[name] = {
              name,
              unique: idx.Non_unique === 0,
              columns: []
            };
          }
          indexMap[name].columns.push(idx.Column_name);
        }

        const seenSignatures = new Map();
        const duplicates = [];

        for (const [name, info] of Object.entries(indexMap)) {
          if (name === 'PRIMARY') continue; // Never drop primary key

          // Composite signature: Uniqueness + sorted columns
          const signature = `${info.unique ? 'U:' : 'N:'}${info.columns.join(',')}`;
          if (seenSignatures.has(signature)) {
            duplicates.push(name);
          } else {
            seenSignatures.set(signature, name);
          }
        }

        // If duplicate indexes exist, drop the redundant ones
        if (duplicates.length > 0) {
          console.log(`[DB Cleaner] 🧹 Table \`${tableName}\` has ${duplicates.length} duplicate indexes. Cleaning up...`);
          for (const dupName of duplicates) {
            try {
              await sequelize.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${dupName}\``);
              console.log(`[DB Cleaner] ✅ Dropped duplicate index \`${dupName}\` from \`${tableName}\``);
            } catch (dropErr) {
              // Might be referenced by foreign key constraint, safe to skip
            }
          }
        }
      } catch (err) {
        // Table index query error safe ignore
      }
    }
    console.log('[DB Cleaner] ✅ MySQL duplicate indexes verification complete.');
  } catch (err) {
    console.warn('[DB Cleaner] Notice during index cleanup:', err.message);
  }
}

module.exports = { cleanDuplicateIndexes };
