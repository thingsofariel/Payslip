// src/middleware/auth.js
//
// Two middlewares:
//   authenticate    - verifies the JWT, attaches req.user
//   authorize(...roles) - restricts a route to specific roles
//
// Usage:
//   router.get('/admin-only', authenticate, authorize('ADMIN_HR'), handler)
//   router.get('/any-logged-in-user', authenticate, handler)

const { verifyToken } = require('../utils/jwt');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    // Attach decoded payload to the request for downstream handlers.
    // req.user.employeeId is the source of truth for "who is this" —
    // never trust an employeeId passed in the request body/params for
    // determining access to one's own records.
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      // authenticate() should always run first — this is a safeguard,
      // not the primary check.
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }

    next();
  };
}

module.exports = { authenticate, authorize };
