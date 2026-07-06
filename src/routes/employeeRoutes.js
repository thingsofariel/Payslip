// src/routes/employeeRoutes.js

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  listEmployees,
  createEmployee,
  getOwnProfile,
  updateEmployee,
  deleteEmployee,
} = require('../controllers/employeeController');

router.use(authenticate);

// Any authenticated employee can view their own profile.
router.get('/me', getOwnProfile);

// ADMIN_HR only -- full employee directory, creation, edit, and removal.
router.get('/', authorize('ADMIN_HR'), listEmployees);
router.post('/', authorize('ADMIN_HR'), createEmployee);
router.patch('/:id', authorize('ADMIN_HR'), updateEmployee);
router.delete('/:id', authorize('ADMIN_HR'), deleteEmployee);

module.exports = router;