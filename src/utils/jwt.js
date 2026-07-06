// src/utils/jwt.js
//
// JWT signing and verification. Keep tokens short-lived (8h) since this
// is payroll data — a stolen long-lived token is a much bigger problem
// here than in a typical consumer app.

const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '8h';

if (!JWT_SECRET) {
  // Fail loudly at startup rather than silently signing tokens with
  // `undefined` as the secret, which would be a critical security hole.
  throw new Error(
    'JWT_SECRET is not set in .env — refusing to start. Generate one with: openssl rand -hex 32'
  );
}

/**
 * Signs a JWT for an authenticated employee.
 * Payload intentionally minimal — just enough to authorize requests,
 * not a place to stash sensitive employee data.
 */
function signToken(employee) {
  return jwt.sign(
    {
      employeeId: employee.employeeId,
      role: employee.role,
      email: employee.email,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verifies a JWT and returns its decoded payload.
 * Throws if invalid/expired — callers should catch and respond 401.
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signToken, verifyToken };
