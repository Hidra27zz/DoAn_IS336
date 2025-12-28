// Timeline Routes - SQL Database
const express = require('express');
const { getDatabase } = require('../config/database');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/timeline - Get all timeline
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    
    // Mock data for now - implement actual SQL queries later
    const mockData = {
      success: true,
      data: [],
      message: 'Timeline Routes endpoint - SQL Database ready',
      data_source: 'SQL Database'
    };

    res.json(mockData);

  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({ error: 'Failed to get timeline' });
  }
});

module.exports = router;