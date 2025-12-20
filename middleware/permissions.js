// Role-Based Access Control (RBAC) System
const { requireRole } = require('./auth');

// Define role hierarchy and permissions
const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager', 
  SUPERVISOR: 'supervisor',
  OPERATOR: 'operator',
  VIEWER: 'viewer'
};

// Define permissions for each module
const PERMISSIONS = {
  // Product Management
  PRODUCT_VIEW: 'product:view',
  PRODUCT_CREATE: 'product:create',
  PRODUCT_UPDATE: 'product:update',
  PRODUCT_DELETE: 'product:delete',
  PRODUCT_IMPORT: 'product:import',

  // Location Management
  LOCATION_VIEW: 'location:view',
  LOCATION_CREATE: 'location:create',
  LOCATION_UPDATE: 'location:update',
  LOCATION_DELETE: 'location:delete',

  // Inventory Management
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_RECEIVE: 'inventory:receive',
  INVENTORY_ADJUST: 'inventory:adjust',
  INVENTORY_COUNT: 'inventory:count',
  INVENTORY_RESERVE: 'inventory:reserve',

  // Order Management
  ORDER_VIEW: 'order:view',
  ORDER_CREATE: 'order:create',
  ORDER_UPDATE: 'order:update',
  ORDER_DELETE: 'order:delete',
  ORDER_ALLOCATE: 'order:allocate',

  // Wave Planning
  WAVE_VIEW: 'wave:view',
  WAVE_CREATE: 'wave:create',
  WAVE_UPDATE: 'wave:update',
  WAVE_DELETE: 'wave:delete',
  WAVE_RELEASE: 'wave:release',

  // Picking Operations
  PICKING_VIEW: 'picking:view',
  PICKING_EXECUTE: 'picking:execute',
  PICKING_CONFIRM: 'picking:confirm',

  // AI System
  AI_VIEW: 'ai:view',
  AI_TRAIN: 'ai:train',
  AI_APPLY: 'ai:apply',
  AI_CONFIGURE: 'ai:configure',

  // Analytics & Reports
  ANALYTICS_VIEW: 'analytics:view',
  REPORTS_VIEW: 'reports:view',
  REPORTS_EXPORT: 'reports:export',

  // User Management
  USER_VIEW: 'user:view',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',

  // System Administration
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_BACKUP: 'system:backup',
  SYSTEM_LOGS: 'system:logs'
};

// Role-Permission Matrix
const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    // Full access to everything
    ...Object.values(PERMISSIONS)
  ],

  [ROLES.MANAGER]: [
    // Product Management
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_UPDATE,
    PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.PRODUCT_IMPORT,

    // Location Management
    PERMISSIONS.LOCATION_VIEW,
    PERMISSIONS.LOCATION_CREATE,
    PERMISSIONS.LOCATION_UPDATE,
    PERMISSIONS.LOCATION_DELETE,

    // Inventory Management
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_RECEIVE,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_COUNT,
    PERMISSIONS.INVENTORY_RESERVE,

    // Order Management
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_UPDATE,
    PERMISSIONS.ORDER_DELETE,
    PERMISSIONS.ORDER_ALLOCATE,

    // Wave Planning
    PERMISSIONS.WAVE_VIEW,
    PERMISSIONS.WAVE_CREATE,
    PERMISSIONS.WAVE_UPDATE,
    PERMISSIONS.WAVE_DELETE,
    PERMISSIONS.WAVE_RELEASE,

    // Picking Operations
    PERMISSIONS.PICKING_VIEW,
    PERMISSIONS.PICKING_EXECUTE,
    PERMISSIONS.PICKING_CONFIRM,

    // AI System
    PERMISSIONS.AI_VIEW,
    PERMISSIONS.AI_TRAIN,
    PERMISSIONS.AI_APPLY,

    // Analytics & Reports
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,

    // User Management (limited)
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_UPDATE
  ],

  [ROLES.SUPERVISOR]: [
    // Product Management (read-only)
    PERMISSIONS.PRODUCT_VIEW,

    // Location Management (read-only)
    PERMISSIONS.LOCATION_VIEW,

    // Inventory Management
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_RECEIVE,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_COUNT,

    // Order Management
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_UPDATE,
    PERMISSIONS.ORDER_ALLOCATE,

    // Wave Planning
    PERMISSIONS.WAVE_VIEW,
    PERMISSIONS.WAVE_CREATE,
    PERMISSIONS.WAVE_UPDATE,
    PERMISSIONS.WAVE_RELEASE,

    // Picking Operations
    PERMISSIONS.PICKING_VIEW,
    PERMISSIONS.PICKING_EXECUTE,
    PERMISSIONS.PICKING_CONFIRM,

    // AI System (view only)
    PERMISSIONS.AI_VIEW,

    // Analytics & Reports
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.REPORTS_VIEW
  ],

  [ROLES.OPERATOR]: [
    // Product Management (read-only)
    PERMISSIONS.PRODUCT_VIEW,

    // Location Management (read-only)
    PERMISSIONS.LOCATION_VIEW,

    // Inventory Management (limited)
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_RECEIVE,
    PERMISSIONS.INVENTORY_COUNT,

    // Order Management (read-only)
    PERMISSIONS.ORDER_VIEW,

    // Wave Planning (read-only)
    PERMISSIONS.WAVE_VIEW,

    // Picking Operations
    PERMISSIONS.PICKING_VIEW,
    PERMISSIONS.PICKING_EXECUTE,
    PERMISSIONS.PICKING_CONFIRM,

    // Analytics (basic view)
    PERMISSIONS.ANALYTICS_VIEW
  ],

  [ROLES.VIEWER]: [
    // Read-only access
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.LOCATION_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.WAVE_VIEW,
    PERMISSIONS.PICKING_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.REPORTS_VIEW
  ]
};

// Check if user has specific permission
const hasPermission = (userRole, permission) => {
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return rolePermissions.includes(permission);
};

// Middleware to check specific permission
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permission,
        userRole: req.user.role
      });
    }

    next();
  };
};

// Middleware to check multiple permissions (OR logic)
const requireAnyPermission = (permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAnyPermission = permissions.some(permission => 
      hasPermission(req.user.role, permission)
    );

    if (!hasAnyPermission) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permissions,
        userRole: req.user.role
      });
    }

    next();
  };
};

// Get user permissions
const getUserPermissions = (userRole) => {
  return ROLE_PERMISSIONS[userRole] || [];
};

// Role hierarchy check (higher roles include lower role permissions)
const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 5,
  [ROLES.MANAGER]: 4,
  [ROLES.SUPERVISOR]: 3,
  [ROLES.OPERATOR]: 2,
  [ROLES.VIEWER]: 1
};

const hasRoleLevel = (userRole, requiredLevel) => {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  return userLevel >= requiredLevel;
};

const requireRoleLevel = (level) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!hasRoleLevel(req.user.role, level)) {
      return res.status(403).json({ 
        error: 'Insufficient role level',
        required: level,
        userLevel: ROLE_HIERARCHY[req.user.role] || 0
      });
    }

    next();
  };
};

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_HIERARCHY,
  hasPermission,
  requirePermission,
  requireAnyPermission,
  getUserPermissions,
  hasRoleLevel,
  requireRoleLevel,
  requireRole // Re-export from auth.js for backward compatibility
};