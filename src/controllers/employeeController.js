// src/controllers/employeeController.js

const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');

const SAFE_EMPLOYEE_FIELDS = {
  employeeId: true,
  fullName: true,
  jobTitle: true,
  employmentStatus: true,
  email: true,
  bankAccountNo: true,
  role: true,
  createdAt: true,
  // Deliberately excluded: passwordHash, nik, dateOfBirth.
  // These are sensitive -- nik/dateOfBirth double as PDF password seeds,
  // and listing them in a general employee directory response is an
  // unnecessary exposure. Expose them only on endpoints that truly
  // need them (e.g. internal PDF-generation service), not here.
};

/**
 * GET /api/employees
 * ADMIN_HR only.
 */
async function listEmployees(req, res) {
  try {
    const employees = await prisma.employee.findMany({
      select: SAFE_EMPLOYEE_FIELDS,
      orderBy: { fullName: 'asc' },
    });
    return res.json({ employees });
  } catch (err) {
    console.error('listEmployees error:', err);
    return res.status(500).json({ error: 'Failed to retrieve employees.' });
  }
}

/**
 * POST /api/employees
 * ADMIN_HR only. Creates a new employee record + portal login.
 */
async function createEmployee(req, res) {
  const {
    fullName,
    jobTitle,
    employmentStatus,
    email,
    bankAccountNo,
    nik,
    dateOfBirth,
    password,
    role,
  } = req.body;

  if (!fullName || !jobTitle || !email || !bankAccountNo || !password) {
    return res.status(400).json({
      error: 'fullName, jobTitle, email, bankAccountNo, and password are required.',
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const employee = await prisma.employee.create({
      data: {
        fullName,
        jobTitle,
        employmentStatus: employmentStatus || 'PERMANENT',
        email,
        bankAccountNo,
        nik,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        passwordHash,
        role: role || 'EMPLOYEE',
      },
      select: SAFE_EMPLOYEE_FIELDS,
    });

    return res.status(201).json({ employee });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'An employee with this email or NIK already exists.' });
    }
    console.error('createEmployee error:', err);
    return res.status(500).json({ error: 'Failed to create employee.' });
  }
}

/**
 * GET /api/employees/me
 * Any authenticated employee -- returns their own profile.
 */
async function getOwnProfile(req, res) {
  try {
    const employee = await prisma.employee.findUnique({
      where: { employeeId: req.user.employeeId },
      select: SAFE_EMPLOYEE_FIELDS,
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    return res.json({ employee });
  } catch (err) {
    console.error('getOwnProfile error:', err);
    return res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
}

/**
 * PATCH /api/employees/:id
 * ADMIN_HR only. Updates editable directory fields for an employee.
 *
 * Deliberately does NOT allow changing password, nik, or dateOfBirth here --
 * those are sensitive / security-relevant fields (nik + dateOfBirth double as
 * PDF password seeds) and shouldn't be casually editable from this general
 * "edit employee" form. A dedicated endpoint should handle those if needed.
 */
async function updateEmployee(req, res) {
  const employeeId = Number(req.params.id);

  if (!Number.isInteger(employeeId)) {
    return res.status(400).json({ error: 'Invalid employee id.' });
  }

  const { fullName, jobTitle, employmentStatus, email, bankAccountNo, role } = req.body;

  // Build the update payload from only the fields actually provided --
  // this lets the frontend send a partial update (e.g. just fullName +
  // jobTitle) without accidentally nulling out other fields.
  const data = {};
  if (fullName !== undefined) data.fullName = fullName;
  if (jobTitle !== undefined) data.jobTitle = jobTitle;
  if (employmentStatus !== undefined) data.employmentStatus = employmentStatus;
  if (email !== undefined) data.email = email;
  if (bankAccountNo !== undefined) data.bankAccountNo = bankAccountNo;
  if (role !== undefined) data.role = role;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No updatable fields were provided.' });
  }

  try {
    const employee = await prisma.employee.update({
      where: { employeeId },
      data,
      select: SAFE_EMPLOYEE_FIELDS,
    });

    return res.json({ employee });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'An employee with this email already exists.' });
    }
    console.error('updateEmployee error:', err);
    return res.status(500).json({ error: 'Failed to update employee.' });
  }
}

/**
 * DELETE /api/employees/:id
 * ADMIN_HR only. Deletes an employee record.
 *
 * Blocked (with a clear error) if the employee has any payslips or audit
 * log entries, since both relations are onDelete: Restrict / no-action in
 * the schema -- payroll history must never silently disappear alongside
 * the employee record that produced it.
 */
async function deleteEmployee(req, res) {
  const employeeId = Number(req.params.id);

  if (!Number.isInteger(employeeId)) {
    return res.status(400).json({ error: 'Invalid employee id.' });
  }

  // Prevent an admin from deleting their own account mid-session -- this
  // avoids a confusing state where the token is still valid but the
  // underlying employee record is gone.
  if (req.user.employeeId === employeeId) {
    return res.status(400).json({ error: 'You cannot delete your own account while logged in.' });
  }

  try {
    await prisma.employee.delete({ where: { employeeId } });
    return res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    if (err.code === 'P2003' || err.code === 'P2014') {
      return res.status(409).json({
        error:
          'This employee cannot be deleted because they still have payslips or audit history on record. Remove or reassign those first.',
      });
    }
    console.error('deleteEmployee error:', err);
    return res.status(500).json({ error: 'Failed to delete employee.' });
  }
}

module.exports = { listEmployees, createEmployee, getOwnProfile, updateEmployee, deleteEmployee };
