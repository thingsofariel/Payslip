// src/controllers/pdfController.js

const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');
const { generatePayslipPdf, buildVerificationHash } = require('../services/pdfService');

/**
 * Shared loader -- both the normal owner/admin PDF route and the
 * shareable-link route need the same fully-loaded payslip shape
 * (employee + line items) before generating/serving a PDF.
 */
async function loadFullPayslip(where) {
  return prisma.payslip.findUnique({
    where,
    include: {
      employee: true,
      earningDetails: { orderBy: { sortOrder: 'asc' } },
      deductionDetails: { orderBy: { sortOrder: 'asc' } },
    },
  });
}

/**
 * Same ownership rule used everywhere in this app: the payslip's own
 * employee, or an ADMIN_HR user. Never trust a client-supplied
 * employeeId for this -- req.user comes from the verified JWT.
 */
function canAccessPayslip(payslip, user) {
  return payslip.employeeId === user.employeeId || user.role === 'ADMIN_HR';
}

/**
 * Serves the cached PDF if present on disk, otherwise generates it on
 * demand and caches the result. Shared by both the normal PDF route
 * and the shareable-link route so the two never drift apart.
 */
async function servePayslipPdf(payslip, res) {
  if (payslip.pdfPath && fs.existsSync(payslip.pdfPath)) {
    return res.download(payslip.pdfPath, `payslip-${payslip.payslipId}.pdf`);
  }

  const { filePath, verificationHash } = await generatePayslipPdf(payslip);

  await prisma.payslip.update({
    where: { payslipId: payslip.payslipId },
    data: { pdfPath: filePath, pdfGeneratedAt: new Date(), verificationHash },
  });

  return res.download(filePath, `payslip-${payslip.payslipId}.pdf`);
}

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
    const payslip = await loadFullPayslip({ payslipId });

    if (!payslip) {
      return res.status(404).json({ error: 'Payslip not found.' });
    }

    if (!canAccessPayslip(payslip, req.user)) {
      return res.status(404).json({ error: 'Payslip not found.' });
    }

    return await servePayslipPdf(payslip, res);
  } catch (err) {
    console.error('downloadPayslipPdf error:', err);
    return res.status(500).json({ error: 'Failed to generate or retrieve payslip PDF.' });
  }
}

/**
 * GET /api/payslips/share/:token/pdf
 *
 * The route a manager-shared WhatsApp link actually points at. Mounted
 * on the authenticated payslipRoutes router (NOT publicRoutes.js) --
 * unlike the QR verification endpoint below, this one must require a
 * real login, since it serves the actual PDF with real payroll figures.
 * The token only identifies WHICH payslip; it grants no access by
 * itself -- canAccessPayslip() still enforces that the logged-in user
 * is either that payslip's own employee or ADMIN_HR.
 */
async function downloadPayslipPdfByShareToken(req, res) {
  try {
    const { token: shareToken } = req.params;
    const payslip = await loadFullPayslip({ shareToken });

    if (!payslip) {
      // 404, not 403 -- don't confirm/deny that a share token exists
      // at all to someone who isn't allowed to see it.
      return res.status(404).json({ error: 'Link not found, or you do not have access to this payslip.' });
    }

    if (!canAccessPayslip(payslip, req.user)) {
      return res.status(404).json({ error: 'Link not found, or you do not have access to this payslip.' });
    }

    return await servePayslipPdf(payslip, res);
  } catch (err) {
    console.error('downloadPayslipPdfByShareToken error:', err);
    return res.status(500).json({ error: 'Failed to retrieve payslip PDF.' });
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

module.exports = { downloadPayslipPdf, downloadPayslipPdfByShareToken, verifyPayslip };
