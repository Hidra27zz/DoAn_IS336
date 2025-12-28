// SQL Database Configuration - Replace Firebase
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SQLDatabase {
  constructor() {
    this.dbPath = path.join(__dirname, '..', 'warehouse.db');
    this.db = null;
    this.initialized = false;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ SQLite connection failed:', err.message);
          reject(err);
        } else {
          console.log('✅ SQLite database connected');
          this.initialized = true;
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    const tables = [
      // Products table
      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference TEXT UNIQUE NOT NULL,
        abc_code TEXT,
        sector TEXT,
        description TEXT,
        unit_price REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Storage locations table
      `CREATE TABLE IF NOT EXISTS storage_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location_code TEXT UNIQUE NOT NULL,
        x INTEGER,
        y INTEGER,
        z INTEGER,
        zone TEXT,
        capacity INTEGER DEFAULT 100,
        current_occupancy INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Inventory table
      `CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_reference TEXT NOT NULL,
        location_code TEXT NOT NULL,
        quantity REAL DEFAULT 0,
        reserved_quantity REAL DEFAULT 0,
        slot_position INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_reference) REFERENCES products (reference),
        FOREIGN KEY (location_code) REFERENCES storage_locations (location_code)
      )`,

      // Orders table
      `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        customer_name TEXT,
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 1,
        wave_number TEXT,
        operator TEXT,
        creation_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Order items table
      `CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_reference TEXT,
        quantity INTEGER,
        picked_quantity INTEGER DEFAULT 0,
        size TEXT,
        order_to_collect TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders (id),
        FOREIGN KEY (product_reference) REFERENCES products (reference)
      )`,

      // Picking tasks table
      `CREATE TABLE IF NOT EXISTS picking_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wave_number TEXT,
        product_reference TEXT,
        location_code TEXT,
        quantity_to_pick REAL,
        quantity_picked REAL DEFAULT 0,
        operator TEXT,
        size TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_reference) REFERENCES products (reference),
        FOREIGN KEY (location_code) REFERENCES storage_locations (location_code)
      )`,

      // Storage strategies table
      `CREATE TABLE IF NOT EXISTS storage_strategies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location_code TEXT,
        strategy_type TEXT,
        products TEXT,
        product_count INTEGER,
        total_quantity REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (location_code) REFERENCES storage_locations (location_code)
      )`,

      // Navigation points table
      `CREATE TABLE IF NOT EXISTS navigation_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT UNIQUE,
        x REAL,
        y REAL,
        z REAL,
        point_type TEXT,
        coordinates TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT,
        role TEXT DEFAULT 'operator',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // System logs table
      `CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT,
        module TEXT,
        message TEXT,
        details TEXT,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`
    ];

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_products_reference ON products (reference)',
      'CREATE INDEX IF NOT EXISTS idx_products_abc_code ON products (abc_code)',
      'CREATE INDEX IF NOT EXISTS idx_locations_code ON storage_locations (location_code)',
      'CREATE INDEX IF NOT EXISTS idx_locations_zone ON storage_locations (zone)',
      'CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory (product_reference)',
      'CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory (location_code)',
      'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status)',
      'CREATE INDEX IF NOT EXISTS idx_orders_wave ON orders (wave_number)',
      'CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id)',
      'CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items (product_reference)',
      'CREATE INDEX IF NOT EXISTS idx_picking_tasks_wave ON picking_tasks (wave_number)',
      'CREATE INDEX IF NOT EXISTS idx_picking_tasks_status ON picking_tasks (status)',
      'CREATE INDEX IF NOT EXISTS idx_storage_strategies_type ON storage_strategies (strategy_type)',
      'CREATE INDEX IF NOT EXISTS idx_storage_strategies_location ON storage_strategies (location_code)',
      'CREATE INDEX IF NOT EXISTS idx_navigation_points_label ON navigation_points (label)',
      'CREATE INDEX IF NOT EXISTS idx_navigation_points_type ON navigation_points (point_type)'
    ];

    try {
      // Create tables
      for (const tableSQL of tables) {
        await this.run(tableSQL);
      }

      // Create indexes
      for (const indexSQL of indexes) {
        await this.run(indexSQL);
      }

      console.log('✅ Database tables and indexes created successfully');
    } catch (error) {
      console.error('❌ Failed to create tables:', error);
      throw error;
    }
  }

  // Promisify database operations
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // High-level database operations
  async create(table, data) {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    
    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
    const result = await this.run(sql, values);
    
    return { id: result.id, ...data };
  }

  async findById(table, id) {
    const sql = `SELECT * FROM ${table} WHERE id = ?`;
    return await this.get(sql, [id]);
  }

  async findOne(table, conditions = {}) {
    const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(conditions);
    
    const sql = `SELECT * FROM ${table}${whereClause ? ` WHERE ${whereClause}` : ''}`;
    return await this.get(sql, values);
  }

  async findAll(table, conditions = {}, options = {}) {
    const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(conditions);
    
    let sql = `SELECT * FROM ${table}${whereClause ? ` WHERE ${whereClause}` : ''}`;
    
    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }
    
    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
    }
    
    if (options.offset) {
      sql += ` OFFSET ${options.offset}`;
    }
    
    return await this.all(sql, values);
  }

  async update(table, id, data) {
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), id];
    
    const sql = `UPDATE ${table} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await this.run(sql, values);
    
    return { id, ...data };
  }

  async delete(table, id) {
    const sql = `DELETE FROM ${table} WHERE id = ?`;
    await this.run(sql, [id]);
    return { id };
  }

  async count(table, conditions = {}) {
    const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(conditions);
    
    const sql = `SELECT COUNT(*) as count FROM ${table}${whereClause ? ` WHERE ${whereClause}` : ''}`;
    const result = await this.get(sql, values);
    return result.count;
  }

  // Bulk operations for large datasets
  async bulkInsert(table, dataArray, batchSize = 1000) {
    if (dataArray.length === 0) return;
    
    const columns = Object.keys(dataArray[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    console.log(`   Bulk inserting ${dataArray.length} records into ${table}...`);
    
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        const stmt = this.db.prepare(sql);
        let inserted = 0;
        
        for (const data of dataArray) {
          const values = columns.map(col => data[col]);
          stmt.run(values, (err) => {
            if (err) {
              console.error(`Error inserting record:`, err);
            } else {
              inserted++;
            }
          });
          
          // Progress update
          if (inserted % batchSize === 0) {
            console.log(`     Progress: ${inserted}/${dataArray.length} records inserted`);
          }
        }
        
        stmt.finalize((err) => {
          if (err) {
            this.db.run('ROLLBACK');
            reject(err);
          } else {
            this.db.run('COMMIT', (err) => {
              if (err) {
                reject(err);
              } else {
                console.log(`   ✅ Successfully inserted ${inserted} records into ${table}`);
                resolve(inserted);
              }
            });
          }
        });
      });
    });
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          } else {
            console.log('Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Singleton instance
let dbInstance = null;

const getDatabase = async () => {
  if (!dbInstance) {
    dbInstance = new SQLDatabase();
    await dbInstance.initialize();
  }
  return dbInstance;
};

module.exports = {
  SQLDatabase,
  getDatabase
};