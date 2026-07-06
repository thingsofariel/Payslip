// src/controllers/authController.js

const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const { signToken } = require('../utils/jwt');

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Returns a JWT on success. Deliberately returns the same generic error
 * for "no such email" and "wrong password" — distinguishing the two in
 * the response would let an attacker enumerate valid employee emails.
 */
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { email },
    });

    if (!employee) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(password, employee.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(employee);

    return res.json({
      token,
      employee: {
        employeeId: employee.employeeId,
        fullName: employee.fullName,
        email: employee.email,
        role: employee.role,
        jobTitle: employee.jobTitle,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred during login.' });
  }
}

module.exports = { login };
