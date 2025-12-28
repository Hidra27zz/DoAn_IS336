// Picking Routes - SQL Database
const express = require('express');
const { getDatabase } = require('../config/database');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/picking - Get all picking
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    
    // Mock data for now - implement actual SQL queries later
    const mockData = {
      success: true,
      data: [],
      message: 'Picking Routes endpoint - SQL Database ready',
      data_source: 'SQL Database'
    };

    res.json(mockData);

  } catch (error) {
    console.error('Get picking error:', error);
    res.status(500).json({ error: 'Failed to get picking' });
  }
});

module.exports = router;