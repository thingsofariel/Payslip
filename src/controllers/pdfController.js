// src/controllers/pdfController.js

const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');
const { generatePayslipPdf, buildVerificationHash } = require('../services/pdfService');

/**
 * GET /api/payslips/:id/pdf
 *
 * Serves the cached PDF if one exists on disk, otherwise generates it
 * on the fly and caches it for next time. Same ownership rule as the
 * JSON payslip endpoint: an employee can only fetch their own PDF.
 */
async function downloadPayslipPdf(req, res) {
  try {
    const payslipId = parseInt(req.params.id, 10);

    const payslip = await prisma.payslip.findUnique({
      where: { payslipId },
      include: {
        employee: true,
        earningDetails: { orderBy: { sortOrder: 'asc' } },
        deductionDetails: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!payslip) {
      return res.status(404).json({ error: 'Payslip not found.' });
    }

    const isOwner = payslip.employeeId === req.user.employeeId;
    const isAdmin = req.user.role === 'ADMIN_HR';
    if (!isOwner && !isAdmin) {
      return res.status(404).json({ error: 'Payslip not found.' });
    }

    // Serve the cached file if it exists and is still actually on disk
    // (it may have been deleted manually, or this could be a payslip
    // finalized before the PDF feature existed -- pdfPath would be
    // null in that case).
    if (payslip.pdfPath && fs.existsSync(payslip.pdfPath)) {
      return res.download(payslip.pdfPath, `payslip-${payslip.payslipId}.pdf`);
    }

    // Fall back to generating on demand.
    const { filePath, verificationHash } = await generatePayslipPdf(payslip);

    await prisma.payslip.update({
      where: { payslipId },
      data: { pdfPath: filePath, pdfGeneratedAt: new Date(), verificationHash },
    });

    return res.download(filePath, `payslip-${payslip.payslipId}.pdf`);
  } catch (err) {
    console.error('downloadPayslipPdf error:', err);
    return res.status(500).json({ error: 'Failed to generate or retrieve payslip PDF.' });
  }
}

/**
 * GET /api/payslips/verify/:hash
 *
 * Public verification endpoint -- this is what the QR code on a printed
 * or downloaded payslip actually points at. Deliberately returns only
 * non-sensitive confirmation info (yes/no it's authentic, who signed
 * it, when) rather than the full payroll figures, since this endpoint
 * has no authentication and could be hit by anyone who scans the code.
 */
async function verifyPayslip(req, res) {
  try {
    const { hash } = req.params;

    const payslip = await prisma.payslip.findFirst({
      where: { verificationHash: hash },
      include: { employee: { select: { fullName: true } } },
    });

    if (!payslip) {
      return res.status(404).json({
        valid: false,
        message: 'No payslip matches this verification code.',
      });
    }

    return res.json({
      valid: true,
      employeeName: payslip.employee.fullName,
      period: `${payslip.periodMonth}/${payslip.periodYear}`,
      status: payslip.status,
      authorizedSignatory: payslip.authorizedSignatory,
      issueDate: payslip.issueDate,
      // Deliberately omitted: basicSalary, totalEarnings, totalDeductions,
      // netPay -- this is a public, unauthenticated endpoint.
    });
  } catch (err) {
    console.error('verifyPayslip error:', err);
    return res.status(500).json({ error: 'Failed to verify payslip.' });
  }
}

module.exports = { downloadPayslipPdf, verifyPayslip };
