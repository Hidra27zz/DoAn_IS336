// User Management Routes - SQL Database
const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/users - Get all users (admin only)
router.get('/', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const db = await getDatabase();
    const { page = 1, limit = 50, role = '' } = req.query;

    let whereConditions = [];
    let params = [];

    if (role) {
      whereConditions.push('role = ?');
      params.push(role);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const countResult = await db.get(countSql, params);
    const total = countResult.total;

    // Get paginated results (exclude password_hash)
    const offset = (page - 1) * limit;
    const sql = `
      SELECT 
        id,
        username,
        email,
        role,
        created_at,
        updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const users = await db.all(sql, [...params, parseInt(limit), offset]);

    res.json({
      users: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      },
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// GET /api/users/:id - Get specific user
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;

    const user = await db.get(`
      SELECT 
        id,
        username,
        email,
        role,
        created_at,
        updated_at
      FROM users 
      WHERE id = ?
    `, [id]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: user,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// POST /api/users - Create new user (admin only)
router.post('/', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const db = await getDatabase();
    const { username, email, password, role = 'operator' } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user already exists
    const existing = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      return res.status(409).json({ error: 'User with this username or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userData = {
      username,
      email,
      password_hash: hashedPassword,
      role
    };

    const result = await db.create('users', userData);

    res.status(201).json({
      success: true,
      user: {
        id: result.id,
        username: result.username,
        email: result.email,
        role: result.role
      },
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;
    const { email, role, password } = req.body;

    // Check if user exists
    const existing = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user
    const updateData = {};
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (password !== undefined) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    await db.update('users', id, updateData);

    // Get updated user (exclude password_hash)
    const updated = await db.get(`
      SELECT 
        id,
        username,
        email,
        role,
        created_at,
        updated_at
      FROM users 
      WHERE id = ?
    `, [id]);

    res.json({
      success: true,
      user: updated,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete('/:id', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;

    // Check if user exists
    const existing = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow deleting the last admin
    if (existing.role === 'admin') {
      const adminCount = await db.get('SELECT COUNT(*) as count FROM users WHERE role = ?', ['admin']);
      if (adminCount.count <= 1) {
        return res.status(409).json({ error: 'Cannot delete the last admin user' });
      }
    }

    // Delete user
    await db.delete('users', id);

    res.json({
      success: true,
      message: 'User deleted successfully',
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;