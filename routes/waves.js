// Wave Management Routes - SQL Database
const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');

// GET /api/waves - Get all waves with filtering and pagination
router.get('/', async (req, res) => {
  try {
    // Mock wave data since we don't have waves table yet
    const waves = [
      {
        id: 'wave-001',
        wave_number: 'W001',
        status: 'in_progress',
        total_items: 25,
        operator: 'John Doe',
        created_at: new Date().toISOString()
      },
      {
        id: 'wave-002',
        wave_number: 'W002',
        status: 'created',
        total_items: 18,
        operator: 'Jane Smith',
        created_at: new Date().toISOString()
      },
      {
        id: 'wave-003',
        wave_number: 'W003',
        status: 'completed',
        total_items: 32,
        operator: 'Mike Johnson',
        created_at: new Date().toISOString()
      }
    ];

    const { status, page = 1, limit = 50 } = req.query;

    let filteredWaves = waves;
    if (status) {
      filteredWaves = waves.filter(wave => wave.status === status);
    }

    const total = filteredWaves.length;
    const offset = (page - 1) * limit;
    const paginatedWaves = filteredWaves.slice(offset, offset + parseInt(limit));

    res.json({
      waves: paginatedWaves,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      },
      data_source: 'SQL Database (Mock Data)'
    });

  } catch (error) {
    console.error('Get waves error:', error);
    res.status(500).json({ error: 'Failed to get waves' });
  }
});

// GET /api/waves/:id - Get specific wave
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Mock wave data
    const wave = {
      id: id,
      wave_number: `W${id.slice(-3)}`,
      status: 'in_progress',
      total_items: 25,
      operator: 'John Doe',
      created_at: new Date().toISOString(),
      tasks: [
        {
          product_reference: 'O9YFO8',
          location_code: 'A-14-11',
          quantity: 5,
          status: 'pending'
        },
        {
          product_reference: 'I1X92B',
          location_code: 'A-14-12',
          quantity: 3,
          status: 'completed'
        }
      ]
    };

    res.json({
      wave: wave,
      data_source: 'SQL Database (Mock Data)'
    });

  } catch (error) {
    console.error('Get wave error:', error);
    res.status(500).json({ error: 'Failed to get wave' });
  }
});

// POST /api/waves - Create new wave
router.post('/', async (req, res) => {
  try {
    const { wave_number, operator, order_ids = [] } = req.body;

    if (!wave_number || !operator) {
      return res.status(400).json({ error: 'Wave number and operator are required' });
    }

    // Mock wave creation
    const wave = {
      id: 'wave-' + Date.now(),
      wave_number,
      operator,
      status: 'created',
      total_items: order_ids.length,
      created_at: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      wave: wave,
      data_source: 'SQL Database (Mock Data)'
    });

  } catch (error) {
    console.error('Create wave error:', error);
    res.status(500).json({ error: 'Failed to create wave' });
  }
});

// PUT /api/waves/:id/status - Update wave status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Mock status update
    const wave = {
      id: id,
      wave_number: `W${id.slice(-3)}`,
      status: status,
      total_items: 25,
      operator: 'John Doe',
      updated_at: new Date().toISOString()
    };

    res.json({
      success: true,
      wave: wave,
      data_source: 'SQL Database (Mock Data)'
    });

  } catch (error) {
    console.error('Update wave status error:', error);
    res.status(500).json({ error: 'Failed to update wave status' });
  }
});

module.exports = router;