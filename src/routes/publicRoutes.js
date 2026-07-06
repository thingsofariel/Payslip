// src/routes/publicRoutes.js
//
// Routes that deliberately do NOT require authentication. Kept on a
// separate router/mount-point from payslipRoutes.js, which applies
// router.use(authenticate) globally -- mounting verifyPayslip there
// would have accidentally locked the public QR-scan endpoint behind
// a login wall.

const express = require('express');
const router = express.Router();
const { verifyPayslip } = require('../controllers/pdfController');

router.get('/payslips/verify/:hash', verifyPayslip);

module.exports = router;
