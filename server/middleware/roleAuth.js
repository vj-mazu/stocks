/**
 * Role-Based Authorization Middleware
 * 
 * Provides middleware functions for enforcing role-based access control
 * for the Inventory Transit workflow.
 */

/**
 * Require Inventory Role Middleware
 * Allows: inventory_staff, inventory_head, staff (location/mill/general), admin, manager, ceo
 * Use for: Place submission, WB submission
 */
const requireInventoryRole = (req, res, next) => {
  const allowedRoles = ['inventory_staff', 'inventory_head', 'staff', 'admin', 'manager', 'ceo'];
  
  if (!req.user || !req.user.role) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
  }
  
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Inventory role required. You do not have permission to perform this action.',
      requiredRoles: allowedRoles,
      yourRole: req.user.role
    });
  }
  
  next();
};

/**
 * Require Approver Role Middleware
 * Allows: inventory_head, admin, manager, ceo ONLY
 * Use for: Place approval, WB approval, viewing approvals
 */
const requireApproverRole = (req, res, next) => {
  const allowedRoles = ['inventory_head', 'admin', 'manager', 'ceo'];
  
  if (!req.user || !req.user.role) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
  }
  
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Approval permission required. Only Inventory Head, Admin, Manager, or CEO can approve submissions.',
      requiredRoles: allowedRoles,
      yourRole: req.user.role
    });
  }
  
  next();
};

module.exports = {
  requireInventoryRole,
  requireApproverRole
};
