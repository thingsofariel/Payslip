// src/app.js
//
// Express app setup. Kept separate from server.js so tests can import
// the app without actually binding a port.

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const payslipRoutes = require('./routes/payslipRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const publicRoutes = require('./routes/publicRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);

// IMPORTANT: publicRoutes must be mounted before payslipRoutes.
// payslipRoutes applies `router.use(authenticate)` to everything on it,
// including any path that happens to match -- mounting the public
// /api/payslips/verify/:hash route after that would lock it behind a
// login wall, breaking the whole point of a QR code anyone can scan.
app.use('/api', publicRoutes);

app.use('/api/payslips', payslipRoutes);
app.use('/api/employees', employeeRoutes);

// 404 handler -- must come after all routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// Centralized error handler -- catches anything thrown synchronously
// in a route handler that wasn't already caught locally. Async errors
// inside controllers are caught by their own try/catch blocks; this
// is a safety net, not the primary error-handling mechanism.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

module.exports = app;
