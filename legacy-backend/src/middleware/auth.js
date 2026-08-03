import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/jwt.js';

// Middleware to authenticate JWT
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[2]; // Bearer JWT <token> (handling potential standard schemes) or standard:
  const actualToken = token || (authHeader && authHeader.split(' ')[1]);

  if (!actualToken) {
    return res.status(401).json({ message: 'Authentication token required.' });
  }

  jwt.verify(actualToken, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
}

// Factory to authorize specific roles
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized. Please log in.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Forbidden. This action requires one of these roles: [${allowedRoles.join(', ')}]. Your role: '${req.user.role}'` 
      });
    }

    next();
  };
}
