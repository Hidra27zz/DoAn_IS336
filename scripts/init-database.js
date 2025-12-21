const db = require('../database/connection');

async function initializeDatabase() {
    try {
        console.log('Initializing database...');
        
        await db.initialize();
        
        console.log('Database initialized successfully!');
        console.log('Tables created and indexes added');
        console.log('Ready to seed data with: npm run seed-data');
        
        process.exit(0);
    } catch (error) {
        console.error('Database initialization failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    initializeDatabase();
}

module.exports = initializeDatabase;