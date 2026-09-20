import jwt from 'jsonwebtoken';
import { canAccessView, hasPermission } from '../rbac.js';

const JWT_SECRET = process.env.JWT_SECRET || 'propvault-dev-secret-change-in-production';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (req.user.role === 'Admin' || roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function requireView(view) {
  return (req, res, next) => {
    if (!canAccessView(req.user.role, view)) {
      return res.status(403).json({ error: 'Access to this module is not permitted' });
    }
    next();
  };
}
