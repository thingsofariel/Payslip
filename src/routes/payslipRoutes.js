// src/routes/payslipRoutes.js

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  listPayslips,
  getPayslipById,
  createPayslip,
  finalizePayslip,
  markPayslipSent,
  getOrCreateShareLink,
} = require('../controllers/payslipController');
const { downloadPayslipPdf, downloadPayslipPdfByShareToken } = require('../controllers/pdfController');
const { bulkImportPayslips, getBulkImportStatus } = require('../controllers/bulkImportController');

// In-memory storage -- the CSV is read directly from req.file.buffer in
// the controller, never written to disk. A 5MB limit is generous for
// a CSV (even a few thousand rows is well under that) and guards
// against an accidental multi-GB upload tying up server memory.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Every payslip route requires authentication.
router.use(authenticate);

// Both ADMIN_HR and EMPLOYEE can hit these -- the controller itself
// scopes results to "own records only" for EMPLOYEE.
router.get('/', listPayslips);
router.get('/:id', getPayslipById);
router.get('/:id/pdf', downloadPayslipPdf);

// Shareable-link PDF route (what a manager-pasted WhatsApp link points
// at). Still requires login -- the token only identifies which payslip,
// ownership is still checked in pdfController.js. 3 path segments here
// vs 2 for '/:id/pdf' above means there's no route-matching ambiguity,
// same reasoning as the bulk-import routes below.
router.get('/share/:token/pdf', downloadPayslipPdfByShareToken);

// ADMIN_HR only -- creating and finalizing payroll entries.
router.post('/', authorize('ADMIN_HR'), createPayslip);
router.patch('/:id/finalize', authorize('ADMIN_HR'), finalizePayslip);
router.patch('/:id/mark-sent', authorize('ADMIN_HR'), markPayslipSent);

// ADMIN_HR only -- generates/returns the shareable link for a payslip.
router.post('/:id/share-link', authorize('ADMIN_HR'), getOrCreateShareLink);

// ADMIN_HR only -- bulk CSV import.
// No route-ordering conflict with '/:id' above: Express matches by
// HTTP method first (POST vs GET) and by path segment count, so
// 'POST /bulk-import' never competes with 'GET /:id', and
// 'GET /bulk-import/:batchId/status' (3 segments) never matches
// 'GET /:id' (1 segment) regardless of registration order.
router.post('/bulk-import', authorize('ADMIN_HR'), upload.single('file'), bulkImportPayslips);
router.get('/bulk-import/:batchId/status', authorize('ADMIN_HR'), getBulkImportStatus);

module.exports = router;
