// User Management Routes
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/firebase-connection');
const { authMiddleware } = require('../middleware/auth');
const { 
  ROLES, 
  PERMISSIONS, 
  requirePermission, 
  getUserPermissions,
  requireRoleLevel 
} = require('../middleware/permissions');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/users - Get all users (Admin/Manager only)
router.get('/', requirePermission(PERMISSIONS.USER_VIEW), async (req, res) => {
  try {
    const { page = 1, limit = 50, role, status, search } = req.query;

    let users = await db.getAllUsers();

    // Apply filters
    if (role) {
      users = users.filter(u => u.role === role);
    }

    if (status) {
      users = users.filter(u => u.status === status);
    }

    if (search) {
      users = users.filter(u => 
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Remove sensitive data
    users = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
      last_login: user.last_login
    }));

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedUsers = users.slice(startIndex, endIndex);

    res.json({
      users: paginatedUsers,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(users.length / limit),
        total_items: users.length,
        items_per_page: parseInt(limit)
      },
      filters: {
        available_roles: Object.values(ROLES),
        available_statuses: ['active', 'inactive', 'suspended']
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// GET /api/users/:id - Get specific user
router.get('/:id', requirePermission(PERMISSIONS.USER_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await db.getUserById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove sensitive data
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
      last_login: user.last_login,
      permissions: getUserPermissions(user.role)
    };

    res.json({ user: userData });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// POST /api/users - Create new user (Admin only)
router.post('/', requirePermission(PERMISSIONS.USER_CREATE), async (req, res) => {
  try {
    const { username, email, password, role = ROLES.OPERATOR } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'Username, email, and password are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters' 
      });
    }

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role',
        available_roles: Object.values(ROLES)
      });
    }

    // Check if username/email already exists
    const existingUsername = await db.getUserByUsername(username);
    if (existingUsername) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const existingEmail = await db.getUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const userData = {
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      role: role,
      status: 'active',
      created_by: req.user.id
    };

    const newUser = await db.createUser(userData);

    // Log activity
    await db.createLog({
      level: 'info',
      module: 'users',
      message: `User created: ${username}`,
      details: { 
        user_id: newUser.id, 
        username, 
        email, 
        role 
      },
      user_id: req.user.id
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        username: userData.username,
        email: userData.email,
        role: userData.role,
        status: userData.status
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', requirePermission(PERMISSIONS.USER_UPDATE), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, status } = req.body;

    const user = await db.getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent users from modifying their own role (except admin)
    if (id === req.user.id && role && role !== user.role && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Cannot modify your own role' });
    }

    // Validate role if provided
    if (role && !Object.values(ROLES).includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role',
        available_roles: Object.values(ROLES)
      });
    }

    // Validate status if provided
    if (status && !['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        available_statuses: ['active', 'inactive', 'suspended']
      });
    }

    // Check username/email uniqueness if changed
    if (username && username !== user.username) {
      const existingUsername = await db.getUserByUsername(username);
      if (existingUsername) {
        return res.status(409).json({ error: 'Username already exists' });
      }
    }

    if (email && email !== user.email) {
      const existingEmail = await db.getUserByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ error: 'Email already exists' });
      }
    }

    // Update user
    const updateData = {};
    if (username) updateData.username = username.trim();
    if (email) updateData.email = email.trim().toLowerCase();
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    updateData.updated_at = new Date().toISOString();
    updateData.updated_by = req.user.id;

    await db.updateUser(id, updateData);

    // Log activity
    await db.createLog({
      level: 'info',
      module: 'users',
      message: `User updated: ${user.username}`,
      details: { 
        user_id: id, 
        changes: updateData 
      },
      user_id: req.user.id
    });

    res.json({
      message: 'User updated successfully',
      user: {
        id: id,
        username: updateData.username || user.username,
        email: updateData.email || user.email,
        role: updateData.role || user.role,
        status: updateData.status || user.status
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id - Delete user (Admin only)
router.delete('/:id', requirePermission(PERMISSIONS.USER_DELETE), async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.user.id) {
      return res.status(403).json({ error: 'Cannot delete your own account' });
    }

    const user = await db.getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Soft delete (set status to inactive)
    await db.updateUser(id, {
      status: 'inactive',
      deleted_at: new Date().toISOString(),
      deleted_by: req.user.id
    });

    // Log activity
    await db.createLog({
      level: 'info',
      module: 'users',
      message: `User deleted: ${user.username}`,
      details: { 
        user_id: id, 
        username: user.username 
      },
      user_id: req.user.id
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// POST /api/users/:id/change-password - Change user password
router.post('/:id/change-password', requirePermission(PERMISSIONS.USER_UPDATE), async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'New password must be at least 6 characters' 
      });
    }

    const user = await db.getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If changing own password, require current password
    if (id === req.user.id) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await db.updateUser(id, {
      password_hash: newPasswordHash,
      password_changed_at: new Date().toISOString(),
      password_changed_by: req.user.id
    });

    // Log activity
    await db.createLog({
      level: 'info',
      module: 'users',
      message: `Password changed for user: ${user.username}`,
      details: { user_id: id },
      user_id: req.user.id
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// GET /api/users/roles - Get available roles and permissions
router.get('/system/roles', requirePermission(PERMISSIONS.USER_VIEW), async (req, res) => {
  try {
    const rolesInfo = Object.values(ROLES).map(role => ({
      role: role,
      permissions: getUserPermissions(role),
      description: getRoleDescription(role)
    }));

    res.json({
      roles: rolesInfo,
      all_permissions: Object.values(PERMISSIONS)
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to get roles' });
  }
});

// Helper function to get role descriptions
function getRoleDescription(role) {
  const descriptions = {
    [ROLES.ADMIN]: 'Full system access and administration',
    [ROLES.MANAGER]: 'Management operations and reporting',
    [ROLES.SUPERVISOR]: 'Operational supervision and coordination',
    [ROLES.OPERATOR]: 'Daily warehouse operations',
    [ROLES.VIEWER]: 'Read-only access to system data'
  };
  return descriptions[role] || 'Unknown role';
}

module.exports = router;