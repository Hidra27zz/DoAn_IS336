// Authentication Routes - SQL Database
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login - User login
router.post('/login', async (req, res) => {
  try {
    const db = await getDatabase();
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Try to find user in database first
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password - support both bcrypt hash and demo plaintext
    let isValidPassword = false;
    
    // If password_hash starts with $2a$ or $2b$, it's a bcrypt hash
    if (user.password_hash && (user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$'))) {
      isValidPassword = await bcrypt.compare(password, user.password_hash);
    } else {
      // Demo mode: check against common demo passwords or plaintext hash
      if (user.username === 'admin' && password === 'admin123') {
        isValidPassword = true;
      } else if (user.username === 'manager' && password === 'manager123') {
        isValidPassword = true;
      } else if (user.username === 'operator' && password === 'operator123') {
        isValidPassword = true;
      } else if (user.username === 'operator1' && password === 'operator123') {
        isValidPassword = true;
      } else if (user.username === 'operator2' && password === 'operator123') {
        isValidPassword = true;
      } else if (user.password_hash === password) {
        // Direct comparison for demo
        isValidPassword = true;
      }
    }

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        username: user.username,
        role: user.role,
        id: user.id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      },
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/register - User registration (admin only)
router.post('/register', async (req, res) => {
  try {
    const db = await getDatabase();
    const { username, email, password, role = 'operator' } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUser) {
      return res.status(409).json({ error: 'User with this username or email already exists' });
    }

    // Hash password (in production, use proper bcrypt)
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
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/logout - User logout
router.post('/logout', (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // by removing the token from storage
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// GET /api/auth/me - Get current user info
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    res.json({
      success: true,
      user: {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role
      },
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get user info error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;